import type { Context } from 'koishi'
import { logger, logInfo } from './log'

export async function checkAndUnfreeze(ctx: Context, uid?: number): Promise<number> {
  try {
    const now = Date.now()
    const query: any = { status: 'frozen' }
    if (uid !== undefined) query.uid = Number(uid)

    const records = await ctx.database.get('monetary_bank_freeze', query)
    let unfreezedCount = 0

    for (const r of records) {
      if (r.unfreezeAt) {
        const unfreezeTime = typeof r.unfreezeAt === 'number'
          ? r.unfreezeAt
          : new Date(r.unfreezeAt).getTime()
        if (!isNaN(unfreezeTime) && unfreezeTime <= now) {
          await ctx.database.set('monetary_bank_freeze', { id: r.id }, { status: 'unfrozen' })
          unfreezedCount++
          logInfo(`资金到期自动解冻: id=${r.id}, uid=${r.uid}, amount=${r.amount} ${r.currency}, reason=${r.reason}`)
        }
      }
    }

    return unfreezedCount
  } catch (err) {
    logger.error('检查自动解冻时出错:', err)
    return 0
  }
}
