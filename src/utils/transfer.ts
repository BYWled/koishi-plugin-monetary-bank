import type { Context } from 'koishi'
import { logger, logInfo } from './log'

export function calculateTransferFee(
  amount: number,
  feeConfig?: { rate?: number; fixed?: number; minFee?: number; maxFee?: number }
): number {
  if (!feeConfig) return 0
  const rate = feeConfig.rate ?? 0
  const fixed = feeConfig.fixed ?? 0
  const minFee = feeConfig.minFee ?? 0
  const maxFee = feeConfig.maxFee ?? 0

  let fee = Math.floor(amount * (rate / 100)) + fixed
  if (minFee > 0 && fee < minFee) fee = minFee
  if (maxFee > 0 && fee > maxFee) fee = maxFee
  return Math.max(0, fee)
}

export async function checkCreditScore(
  ctx: Context,
  uid: number
): Promise<{ pass: boolean; score: number }> {
  try {
    // @ts-ignore
    if (ctx.monetaryCredit && typeof ctx.monetaryCredit.getScore === 'function') {
      // @ts-ignore
      const score = await ctx.monetaryCredit.getScore(uid)
      return { pass: true, score }
    }
  } catch (e) {}

  // 未接入或默认时返回满基准分 100
  return { pass: true, score: 100 }
}

export async function resolveTargetUid(
  ctx: Context,
  session: any,
  targetStr: string
): Promise<{ uid: number; userId: string; username?: string } | null> {
  if (!targetStr) return null

  let userId = ''
  const atMatch = targetStr.match(/<at[^>]*\bid=["']?([^"'\s/>]+)["']?[^>]*\/?>/)
  if (atMatch) {
    userId = atMatch[1]
  } else {
    const stripped = targetStr.replace(/<[^>]+>/g, '').trim()
    if (/^@(.+)$/.test(stripped)) {
      userId = stripped.slice(1)
    } else {
      userId = stripped
    }
  }

  if (!userId) return null

  let targetUid: number | null = null
  const platform = session.platform || 'onebot'

  try {
    // 严格按当前会话平台匹配绑定（与 koishi core getUser 的解析语义一致），
    // 避免命中其他平台/历史会话的同名账号导致转账进"幽灵账户"
    const bindings = await ctx.database.get('binding', { pid: userId, platform })
    if (bindings && bindings.length > 0) {
      targetUid = Number(bindings[0].aid)
    }
  } catch (e) {}

  if (targetUid === null && /^\d+$/.test(userId)) {
    try {
      const users = await ctx.database.get('user', { id: Number(userId) })
      if (users && users.length > 0) {
        targetUid = users[0].id
      }
    } catch (e) {}
  }

  // 没有开户的情况自动建档
  if (targetUid === null) {
    try {
      const newUser = await ctx.database.create('user', { authority: 1 })
      targetUid = newUser.id
      try {
        await ctx.database.create('binding', {
          aid: newUser.id,
          platform,
          pid: userId
        })
      } catch (e) {}
      logInfo(`已为收款人自动建档: pid=${userId}, platform=${platform}, uid=${targetUid}`)
    } catch (err) {
      logger.error(`为收款人建档失败: ${userId}`, err)
      return null
    }
  }

  // 解析收款人展示昵称：优先 user.name（适配器/插件维护的平台昵称），
  // 其次当前平台绑定中的 pid（沙盒即为用户名，onebot 为 QQ 号），最后回退原始输入
  let username = userId
  try {
    const [targetUser] = await ctx.database.get('user', { id: targetUid }, ['id', 'name'])
    if (targetUser?.name) {
      username = targetUser.name
    } else {
      const targetBindings = await ctx.database.get('binding', { aid: targetUid })
      const preferred = targetBindings.find((b: any) => b.platform === platform) || targetBindings[0]
      if (preferred?.pid) username = preferred.pid
    }
  } catch (e) {}

  return {
    uid: targetUid,
    userId,
    username
  }
}
