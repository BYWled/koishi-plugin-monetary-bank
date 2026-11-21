import type { Context } from 'koishi'
import type { Config } from '../index'
import type { BankRender } from '../render'
import { logger } from '../utils/log'
import { resolveTargetUid, calculateTransferFee, checkCreditScore } from '../utils/transfer'
import { getMonetaryBalance } from '../utils/monetary'
import { generateTransferConfirmText } from '../render'

export function registerTransferCommands(ctx: Context, config: Config, render: BankRender) {
  const { renderToImage, renderTransferConfirmPage, renderTransferSuccessImage, renderTransferFailedPage } = render

    // 5. 注册命令：转账
  ctx.command('bank.transfer <target:string> [amount:string]', '向他人银行账户转账')
    .alias('转账')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .option('cash', '-m, --cash 使用现金支付（默认从银行活期可用余额扣除）')
    .option('innerFee', '-i, --inner-fee 手续费从转账金额中扣除（内扣，默认外扣）')
    .option('yes', '-y 跳过确认直接执行')
    .action(async ({ session, options }, target, amount) => {
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar

      if (!config.transfer?.enabled) {
        return '转账功能暂未开启。'
      }

      if (!target) {
        return '请输入转账目标用户（支持 @用户 或 平台ID/QQ号），例如：bank.transfer @张三 100'
      }

      // 解析收款人
      const payee = await resolveTargetUid(ctx, session, target)
      if (!payee) {
        return '未能解析该收款人，请检查输入或确保账号正确。'
      }
      if (payee.uid === uid) {
        return '不能向自己转账。'
      }

      // 交互式输入金额
      if (!amount) {
        await session.send(`请输入向 ${payee.username || payee.userId} 转账的金额（正整数）：`)
        const amountInput = await session.prompt(30000)
        if (!amountInput) return '操作超时，已取消转账。'
        amount = amountInput.trim()
      }

      const amountNum = parseInt(String(amount || '').trim(), 10)
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        return '请输入有效的转账金额（正整数）。'
      }

      // 验证双方信用分（占位拦截）
      if (config.transfer?.creditCheck?.enabled) {
        const payerCredit = await checkCreditScore(ctx, uid)
        const payeeCredit = await checkCreditScore(ctx, payee.uid)
        const minPayer = config.transfer.creditCheck.minPayerScore ?? 60
        const minPayee = config.transfer.creditCheck.minPayeeScore ?? 0

        if (payerCredit.score < minPayer) {
          const failHtml = renderTransferFailedPage(
            username, avatarUrl, '转账被系统拦截',
            `您的信用分（${payerCredit.score}）低于系统转账门槛（${minPayer}），转账已被安全系统拦截。`
          )
          const fallback = `【转账拦截】您的信用分（${payerCredit.score}）低于系统转账门槛（${minPayer}），转账已被拦截。`
          return await renderToImage(failHtml, fallback)
        }
        if (payeeCredit.score < minPayee) {
          const failHtml = renderTransferFailedPage(
            username, avatarUrl, '转账被系统拦截',
            `收款方信用分（${payeeCredit.score}）低于系统接收门槛（${minPayee}），转账已被安全系统拦截。`
          )
          const fallback = `【转账拦截】收款方信用分（${payeeCredit.score}）低于系统要求（${minPayee}），转账已被拦截。`
          return await renderToImage(failHtml, fallback)
        }
      }

      const fromCash = !!options?.cash
      const innerFee = !!options?.innerFee
      const fee = calculateTransferFee(amountNum, config.transfer?.fee)
      const totalDeduct = innerFee ? amountNum : amountNum + fee
      const netAmount = innerFee ? amountNum - fee : amountNum

      if (innerFee && netAmount <= 0) {
        return `转账金额（${amountNum}）不足以支付手续费（${fee}）。`
      }

      // 检查余额
      if (fromCash) {
        const cash = await getMonetaryBalance(ctx, uid, currency) ?? 0
        if (cash < totalDeduct) {
          return `现金不足！转账需要 ${totalDeduct} ${currency}（含手续费 ${fee}），当前现金：${cash} ${currency}`
        }
      } else {
        const bal = await ctx.monetaryBank.getBalance(uid, currency)
        if (bal.availableDemand < totalDeduct) {
          return `活期可用余额不足！需要 ${totalDeduct} ${currency}（含手续费 ${fee}），可用活期：${bal.availableDemand} ${currency}（已冻结：${bal.frozen.demand}）`
        }
      }

      // 计算冻结时长
      const willFreeze = config.transfer?.freeze?.autoFreeze ?? false
      let freezeDurationSeconds = 0
      if (willFreeze) {
        const freezeCfg = config.transfer?.freeze
        if (freezeCfg?.durationMode === 'tiered' && freezeCfg.tieredRules?.length) {
          const matched = [...freezeCfg.tieredRules]
            .sort((a, b) => b.threshold - a.threshold)
            .find(r => netAmount >= r.threshold)
          freezeDurationSeconds = matched ? matched.seconds : (freezeCfg.fixedSeconds ?? 86400)
        } else {
          freezeDurationSeconds = freezeCfg?.fixedSeconds ?? 86400
        }
      }

      // 二次确认
      if (!options?.yes) {
        if (ctx.puppeteer) {
          const confirmImage = await renderTransferConfirmPage(
            username,
            avatarUrl,
            payee.username || payee.userId,
            amountNum,
            currency,
            fee,
            innerFee,
            fromCash,
            willFreeze,
            freezeDurationSeconds
          )
          await session.send(confirmImage)
        } else {
          await session.send(generateTransferConfirmText(payee.username || payee.userId, amountNum, currency, fee, innerFee, fromCash, willFreeze, freezeDurationSeconds))
        }

        const input = await session.prompt(30000)
        if (!input) return '操作超时，已取消转账。'
        if (!['yes', 'y'].includes(input.trim().toLowerCase())) {
          return '已取消转账操作。'
        }
      }

      // 执行转账
      const result = await ctx.monetaryBank.transfer(uid, payee.uid, currency, amountNum, {
        fromCash,
        innerFee,
        freeze: willFreeze,
        freezeDuration: freezeDurationSeconds,
        reason: '用户指令转账'
      })

      if (!result.success) {
        return result.error || '转账失败'
      }

      return await renderTransferSuccessImage(
        username,
        avatarUrl,
        payee.username || payee.userId,
        amountNum,
        currency,
        result.fee || 0,
        result.innerFee || false,
        result.fromCash || false,
        result.frozen || false,
        result.unfreezeAt,
        result.newPayerCash || 0,
        result.newPayerBalance || await ctx.monetaryBank.getBalance(uid, currency)
      )
    })
}
