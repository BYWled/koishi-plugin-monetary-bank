import type { Context } from 'koishi'
import type { Config } from '../index'
import type { BankRender } from '../render'
import { logger } from '../utils/log'
import { getMonetaryBalance, changeMonetary } from '../utils/monetary'
import { getBankBalance } from '../services'
import { calculateNextSettlementDate } from '../utils/time'

export function registerFixedCommands(ctx: Context, config: Config, render: BankRender) {
  const {
    renderFixedPlanSelectionPage,
    renderFixedDepositSuccessImage,
    renderFixedDepositListImage,
    renderCancelExtensionPage,
    renderExtensionSuccessPage,
    renderExtensionPlanSelectionPage,
  } = render

    // 7. 注册命令：申请定期存款
  ctx.command('bank.fixed', '申请定期存款')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }) => {
      if (!config.enableInterest) {
        return '利息功能未启用。'
      }
      
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar
      
      const plans = config.fixedInterest || []
      if (plans.length === 0) {
        return '当前没有可用的定期存款方案。'
      }
      
      const cash = await getMonetaryBalance(ctx, uid, currency) || 0
      const balance = await getBankBalance(ctx, uid, currency)
      
      if (ctx.puppeteer) {
        const planImage = await renderFixedPlanSelectionPage(
          username,
          avatarUrl,
          plans,
          cash,
          balance.availableDemand,
          currency
        )
        await session.send(planImage)
      } else {
        let msg = '可选的定期存款方案：\n'
        plans.forEach((plan, index) => {
          const cycleText = plan.cycle === 'day' ? '日' : plan.cycle === 'week' ? '周' : '月'
          msg += `${index + 1}. ${plan.name} - 利率：${plan.rate}% - 周期：${cycleText}\n`
        })
        msg += '\n请输入方案编号选择，或输入 0 取消：'
        await session.send(msg)
      }
      
      const planInput = await session.prompt(30000)
      if (!planInput) return '操作超时，已取消。'
      
      const planIndex = parseInt(planInput.trim()) - 1
      if (planIndex < 0) return '已取消定期存款申请。'
      if (planIndex >= plans.length) return '无效的方案编号。'
      
      const selectedPlan = plans[planIndex]
      
      await session.send(`请输入存入金额（优先使用现金，不足时使用银行活期可用存款）：`)
      const amountInput = await session.prompt(30000)
      if (!amountInput) return '操作超时，已取消。'
      
      const amount = parseInt(amountInput.trim())
      if (!amount || amount <= 0) return '无效的金额。'
      
      try {
        const curCash = await getMonetaryBalance(ctx, uid, currency) || 0
        const curBalance = await getBankBalance(ctx, uid, currency)
        
        const totalAvailable = curCash + curBalance.availableDemand
        if (totalAvailable < amount) {
          return `资金不足！现金：${curCash} ${currency}，活期可用：${curBalance.availableDemand} ${currency}，合计：${totalAvailable} ${currency}`
        }
        
        await session.send(`将存入 ${amount} ${currency} 到定期（${selectedPlan.name}），利率 ${selectedPlan.rate}%。\n确认请输入 yes 或 y：`)
        const confirm = await session.prompt(30000)
        if (!confirm || !['yes', 'y'].includes(confirm.trim().toLowerCase())) {
          return '已取消定期存款申请。'
        }
        
        let remaining = amount
        let fromCash = 0
        let fromDemand = 0
        
        if (curCash > 0) {
          fromCash = Math.min(curCash, remaining)
          remaining -= fromCash
          const newCash = await changeMonetary(ctx, uid, currency, -fromCash)
          if (newCash === null) return '扣除现金失败。'
        }
        
        if (remaining > 0) {
          fromDemand = remaining
          const demandRecords = await ctx.database
            .select('monetary_bank_int')
            .where({ uid, currency, type: 'demand' })
            .orderBy('settlementDate', 'asc')
            .execute()
          
          let toDeduct = fromDemand
          for (const record of demandRecords) {
            if (toDeduct <= 0) break
            
            if (record.amount <= toDeduct) {
              toDeduct -= record.amount
              await ctx.database.remove('monetary_bank_int', { id: record.id })
            } else {
              const newAmount = record.amount - toDeduct
              await ctx.database.set('monetary_bank_int', { id: record.id }, { amount: newAmount })
              toDeduct = 0
            }
          }
        }
        
        const settlementDate = calculateNextSettlementDate(selectedPlan.cycle as any, true)
        await ctx.database.create('monetary_bank_int', {
          uid,
          currency,
          amount,
          type: 'fixed',
          rate: selectedPlan.rate,
          cycle: selectedPlan.cycle as any,
          settlementDate,
          extendRequested: false
        })
        
        const newBalance = await getBankBalance(ctx, uid, currency)
        const newCash = await getMonetaryBalance(ctx, uid, currency) || 0
        
        return await renderFixedDepositSuccessImage(
          username,
          avatarUrl,
          amount,
          currency,
          selectedPlan.name,
          selectedPlan.rate,
          selectedPlan.cycle,
          settlementDate,
          fromCash,
          fromDemand,
          newCash,
          newBalance
        )
      } catch (error) {
        logger.error('定期存款失败:', error)
        return '定期存款失败，请稍后再试。'
      }
    })

    // 8. 注册命令：管理定期延期
  ctx.command('bank.fixed.manage', '管理定期存款延期')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }) => {
      if (!config.enableInterest) {
        return '利息功能未启用。'
      }
      
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar
      
      try {
        const fixedRecords = await ctx.database
          .select('monetary_bank_int')
          .where({ uid, currency, type: 'fixed' })
          .orderBy('settlementDate', 'asc')
          .execute()
        
        if (fixedRecords.length === 0) {
          return '您没有定期存款记录。'
        }
        
        await session.send(await renderFixedDepositListImage(
          username,
          avatarUrl,
          fixedRecords,
          currency
        ))
        await session.send('请输入编号管理，或输入 0 退出：')
        
        const input = await session.prompt(30000)
        if (!input) return '操作超时。'
        
        const recordIndex = parseInt(input.trim()) - 1
        if (recordIndex < 0) return '已退出。'
        if (recordIndex >= fixedRecords.length) return '无效的编号。'
        
        const selectedRecord = fixedRecords[recordIndex]
        
        if (selectedRecord.extendRequested) {
          const cycleText = selectedRecord.nextCycle === 'day' ? '日' : selectedRecord.nextCycle === 'week' ? '周' : '月'
          await session.send(await renderCancelExtensionPage(
            username,
            avatarUrl,
            selectedRecord.amount,
            currency,
            `${selectedRecord.nextRate}% / ${cycleText}`
          ))
          
          const action = await session.prompt(30000)
          if (!action) return '操作超时。'
          if (action.trim().toLowerCase() !== 'yes' && action.trim().toLowerCase() !== 'y') {
            return '已取消操作。'
          }
          
          await ctx.database.set('monetary_bank_int', { id: selectedRecord.id }, {
            extendRequested: false,
            nextRate: null,
            nextCycle: null
          })
          
          return await renderExtensionSuccessPage(
            username,
            avatarUrl,
            'cancel',
            selectedRecord.amount,
            currency
          )
        } else {
          const plans = config.fixedInterest || []
          await session.send(await renderExtensionPlanSelectionPage(
            username,
            avatarUrl,
            plans,
            selectedRecord.amount,
            currency
          ))
          
          const planInput = await session.prompt(30000)
          if (!planInput) return '操作超时。'
          
          const planIndex = parseInt(planInput.trim()) - 1
          if (planIndex < 0) return '已返回。'
          if (planIndex >= plans.length) return '无效的方案编号。'
          
          const newPlan = plans[planIndex]
          
          await ctx.database.set('monetary_bank_int', { id: selectedRecord.id }, {
            extendRequested: true,
            nextRate: newPlan.rate,
            nextCycle: newPlan.cycle as any
          })
          
          return await renderExtensionSuccessPage(
            username,
            avatarUrl,
            'apply',
            selectedRecord.amount,
            currency,
            newPlan.name,
            newPlan.rate,
            newPlan.cycle
          )
        }
      } catch (error) {
        logger.error('管理定期失败:', error)
        return '操作失败，请稍后再试。'
      }
    })
}
