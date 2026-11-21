import type { Context } from 'koishi'
import type { Config } from '../index'
import type { BankRender } from '../render'
import { logger } from '../utils/log'
import { getMonetaryBalance } from '../utils/monetary'
import { resolveTargetUid } from '../utils/transfer'

export function registerBankCommands(ctx: Context, config: Config, render: BankRender) {
  const { renderBankHomePage, renderBankBalanceImage } = render

    // 1. 注册主命令：银行首页（仅保留用户信息，小字提醒输入 bank.help）
  ctx.command('bank', '银行服务')
    .userFields(['id'])
    .action(async ({ session }) => {
      let uid = Number(session.user?.id)
      if (Number.isNaN(uid)) {
        const resolved = await resolveTargetUid(ctx, session, session.userId)
        if (resolved) uid = resolved.uid
      }
      const currency = (config.defaultCurrency || 'coin').trim()
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar
      
      try {
        const balance = await ctx.monetaryBank.getBalance(uid, currency)
        const cash = await getMonetaryBalance(ctx, uid, currency) || 0
        
        return await renderBankHomePage(
          username,
          avatarUrl,
          balance,
          cash,
          currency,
          config.enableInterest || false,
          uid
        )
      } catch (error) {
        logger.error('获取银行信息失败:', error)
        return '获取银行信息失败，请稍后再试。'
      }
    })

    // 2. 注册命令：查询存款
  ctx.command('bank.bal [currency:string]', '查询银行存款')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }, currencyArg) => {
      const uid = session.user.id
      const currency = options?.currency || currencyArg || config.defaultCurrency || 'coin'
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar

      try {
        const balance = await ctx.monetaryBank.getBalance(uid, currency)
        if (balance.total === 0 && balance.frozen.total === 0) {
          return `您在银行中还没有 ${currency} 存款。`
        }

        const demandRate = config.demandInterest?.rate ?? 0.25
        return await renderBankBalanceImage(username, avatarUrl, balance, currency, demandRate)
      } catch (error) {
        logger.error('查询存款失败:', error)
        return '查询失败，请稍后再试。'
      }
    })
}
