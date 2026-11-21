import type { Context } from 'koishi'
import type { Config } from '../index'
import type { BankRender } from '../render'
import { logger } from '../utils/log'
import { getMonetaryBalance, createMonetaryUser } from '../utils/monetary'
import {
  generateDepositConfirmMessage,
  generateWithdrawConfirmMessage,
} from '../render'

export function registerDepositCommands(ctx: Context, config: Config, render: BankRender) {
  const {
    renderDepositConfirmPage,
    renderDepositSuccessImage,
    renderWithdrawConfirmPage,
    renderWithdrawSuccessImage,
  } = render

    // 3. 注册命令：存款
  ctx.command('bank.in [amount:string]', '存入货币到银行活期')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .option('yes', '-y 跳过确认直接执行')
    .action(async ({ session, options }, amount) => {
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar

      try {
        let cash = await getMonetaryBalance(ctx, uid, currency)
        if (cash === null) {
          const created = await createMonetaryUser(ctx, uid, currency)
          if (!created) return '无法验证/创建主货币账户（monetary），请联系管理员。'
          cash = 0
        }

        if (!amount) {
          await session.send(`请输入存款金额（正整数或 all）：`)
          const amountInput = await session.prompt(30000)
          if (!amountInput) return '操作超时，已取消存款。'
          amount = amountInput.trim()
        }

        const amountInput = String(amount || '').trim().toLowerCase()
        let amountNum: number
        
        if (amountInput === 'all') {
          amountNum = Math.floor(cash)
          if (amountNum <= 0) return `没有可存入的现金。当前现金：${cash} ${currency}`
        } else {
          amountNum = parseInt(amountInput, 10)
          if (Number.isNaN(amountNum) || amountNum <= 0) {
            return '请输入有效的存款金额（正整数或 all）。'
          }
        }

        if (!options?.yes) {
          if (ctx.puppeteer) {
            const confirmImage = await renderDepositConfirmPage(
              username,
              avatarUrl,
              amountNum,
              currency,
              cash
            )
            await session.send(confirmImage)
          } else {
            const confirmMsg = generateDepositConfirmMessage(amountNum, currency, cash)
            await session.send(confirmMsg)
          }
          
          const userInput = await session.prompt(30000)
          if (!userInput) return '操作超时，已取消存款。'
          
          const confirmed = userInput.trim().toLowerCase()
          if (confirmed !== 'yes' && confirmed !== 'y') {
            return '已取消存款操作。'
          }
        }

        const result = await ctx.monetaryBank.deposit(uid, currency, amountNum)
        if (!result.success) {
          return result.error || '存款失败'
        }

        return await renderDepositSuccessImage(
          username,
          avatarUrl,
          amountNum,
          currency,
          result.newCash,
          result.newBalance
        )
      } catch (error) {
        logger.error('存款失败:', error)
        return '存款失败，请稍后再试。'
      }
    })

    // 4. 注册命令：取款（仅从活期可用余额扣除）
  ctx.command('bank.out [amount:string]', '从银行取出货币')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .option('yes', '-y 跳过确认直接执行')
    .action(async ({ session, options }, amount) => {
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar

      try {
        const balance = await ctx.monetaryBank.getBalance(uid, currency)
        
        if (balance.availableDemand <= 0) {
          return `没有可取出的存款。当前可用活期：${balance.availableDemand} ${currency}（已冻结：${balance.frozen.demand}）`
        }

        if (!amount) {
          await session.send(`请输入取款金额（正整数或 all）：\n当前可用余额：${balance.availableDemand} ${currency}`)
          const amountInput = await session.prompt(30000)
          if (!amountInput) return '操作超时，已取消取款。'
          amount = amountInput.trim()
        }

        const amountInput = String(amount || '').trim().toLowerCase()
        let amountNum: number
        
        if (amountInput === 'all') {
          amountNum = Math.floor(balance.availableDemand)
        } else {
          amountNum = parseInt(amountInput, 10)
          if (Number.isNaN(amountNum) || amountNum <= 0) {
            return '请输入有效的取款金额（正整数或 all）。'
          }
        }

        if (!options?.yes) {
          if (ctx.puppeteer) {
            const confirmImage = await renderWithdrawConfirmPage(
              username,
              avatarUrl,
              amountNum,
              currency,
              balance.availableDemand
            )
            await session.send(confirmImage)
          } else {
            const confirmMsg = generateWithdrawConfirmMessage(amountNum, currency, balance.availableDemand)
            await session.send(confirmMsg)
          }
          
          const userInput = await session.prompt(30000)
          if (!userInput) return '操作超时，已取消取款。'
          
          const confirmed = userInput.trim().toLowerCase()
          if (confirmed !== 'yes' && confirmed !== 'y') {
            return '已取消取款操作。'
          }
        }

        const result = await ctx.monetaryBank.withdraw(uid, currency, amountNum)
        if (!result.success) {
          return result.error || '取款失败'
        }

        return await renderWithdrawSuccessImage(
          username,
          avatarUrl,
          amountNum,
          currency,
          result.newCash,
          result.newBalance
        )
      } catch (error) {
        logger.error('取款失败:', error)
        return '取款失败，请稍后再试。'
      }
    })
}
