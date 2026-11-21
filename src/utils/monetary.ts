import type { Context } from 'koishi'
import { logger, logInfo } from './log'

export async function findMonetaryRecord(ctx: Context, uid: number, currency: string): Promise<{ keyQuery: any; record: any; valueField: string } | null> {
  try {
    const numFields = ['value', 'balance', 'amount', 'coin', 'money']
    
    // 优先按 uid 查询
    try {
      // @ts-ignore
      const recs = await ctx.database.get('monetary', { uid })
      if (recs && recs.length > 0) {
        const record = recs.find((r: any) => r.currency == currency) || recs[0]
        const valueField = numFields.find((f) => typeof record[f] === 'number') 
          || Object.keys(record).find(k => typeof record[k] === 'number') 
          || 'value'
        return { keyQuery: { uid }, record, valueField }
      }
    } catch (e) {}

    // 备用按 id 查询（兼容部分非标准 monetary 插件）
    try {
      // @ts-ignore
      const recs = await ctx.database.get('monetary', { id: uid })
      if (recs && recs.length > 0) {
        const record = recs.find((r: any) => r.currency == currency) || recs[0]
        const valueField = numFields.find((f) => typeof record[f] === 'number') 
          || Object.keys(record).find(k => typeof record[k] === 'number') 
          || 'value'
        return { keyQuery: { id: uid }, record, valueField }
      }
    } catch (e) {}
    
    return null
  } catch (err) {
    logger.warn('读取 monetary 表记录时出错：', err)
    return null
  }
}

/**
 * 在主货币表中创建一条最小化的用户记录
 */
export async function createMonetaryUser(ctx: Context, uid: number, currency: string): Promise<boolean> {
  const attempts = [
    { uid, currency, value: 0 },
    { id: uid, currency, value: 0 }
  ]
  
  for (const data of attempts) {
    try {
      // @ts-ignore
      await ctx.database.create('monetary', data)
      logInfo(`在 monetary 表中创建了新用户记录`, data)
      return true
    } catch (err) {
      continue
    }
  }
  
  logger.warn(`无法自动在 monetary 表中创建用户 uid=${uid}，请手动添加`)
  return false
}

/**
 * 读取用户在主货币表（monetary）中的现金余额
 */
export async function getMonetaryBalance(ctx: Context, uid: number, currency: string): Promise<number | null> {
  const entry = await findMonetaryRecord(ctx, uid, currency)
  if (!entry) return null
  const val = Number(entry.record[entry.valueField] || 0)
  return Number.isNaN(val) ? null : val
}

/**
 * 修改主货币（monetary）余额
 */
export async function changeMonetary(ctx: Context, uid: number, currency: string, delta: number): Promise<number | null> {
  try {
    let entry = await findMonetaryRecord(ctx, uid, currency)
    
    if (!entry) {
      const created = await createMonetaryUser(ctx, uid, currency)
      if (!created) return null
      entry = await findMonetaryRecord(ctx, uid, currency)
      if (!entry) return null
    }
    
    const { keyQuery, record, valueField } = entry
    const current = Number(record[valueField] || 0)
    const newVal = current + delta
    
    if (newVal < 0) return null
    
    // @ts-ignore
    await ctx.database.set('monetary', keyQuery, { [valueField]: newVal })
    return newVal
  } catch (err) {
    logger.error('修改主货币余额失败：', err)
    return null
  }
}
