import type { Context } from 'koishi'
import type { Config } from '../index'
import type { MonetaryBankInterest } from '../types'
import { logger, logInfo, logSuccess } from './log'
import { checkAndUnfreeze } from './freeze'
import { calculateNextSettlementDate } from './time'
import { getBankBalance } from '../services'

export async function scheduleInterestSettlement(ctx: Context, config: Config) {
  if (!config.enableInterest) return
  
  function getMillisecondsUntilMidnight(): number {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.getTime() - now.getTime()
  }
  
  async function performSettlement() {
    try {
      logInfo('开始执行利息结算任务与到期解冻检查...')
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // 每日0点自动解冻到期记录
      await checkAndUnfreeze(ctx)
      
      const records = await ctx.database.get('monetary_bank_int', {})
      
      for (const record of records) {
        const settlementDate = new Date(record.settlementDate)
        settlementDate.setHours(0, 0, 0, 0)
        
        if (settlementDate <= today) {
          await settleInterest(ctx, config, record)
        }
      }
      
      await mergeDemandRecords(ctx)

      logSuccess('利息结算任务执行完成')
    } catch (error) {
      logger.error('利息结算任务执行失败:', error)
    }
  }
  
  setTimeout(async () => {
    await performSettlement()
    setInterval(async () => {
      await performSettlement()
    }, 24 * 60 * 60 * 1000)
  }, getMillisecondsUntilMidnight())
  
  logInfo('利息结算定时任务已启动，将在每日0点执行')
}

export async function settleInterest(ctx: Context, config: Config, record: MonetaryBankInterest) {
  try {
    if (record.type === 'demand') {
      // 检查该用户是否存在不可结息的冻结款项
      const balance = await getBankBalance(ctx, record.uid, record.currency)
      let accrualRatio = 1
      if (balance.demand > 0 && balance.frozen.demandNonAccrual > 0) {
        const accrualDemand = Math.max(0, balance.demand - balance.frozen.demandNonAccrual)
        accrualRatio = accrualDemand / balance.demand
      }

      const baseInterest = record.amount * record.rate / 100
      const interest = Math.floor(baseInterest * accrualRatio)

      const newAmount = record.amount + interest
      const nextSettlement = calculateNextSettlementDate(record.cycle, false)
      
      await ctx.database.set('monetary_bank_int', { id: record.id }, {
        amount: newAmount,
        settlementDate: nextSettlement
      })
      
      logInfo(`活期利息结算: uid=${record.uid}, 本金=${record.amount}, 可结息比例=${(accrualRatio * 100).toFixed(1)}%, 利息=${interest}, 新本金=${newAmount}`)
    } else {
      // 定期：默认属于可结息的冻结（担保金/抵押金）
      const interest = Math.floor(record.amount * record.rate / 100)

      if (record.extendRequested && record.nextRate !== undefined && record.nextCycle) {
        const newAmount = record.amount + interest
        const nextSettlement = calculateNextSettlementDate(record.nextCycle, false)
        
        await ctx.database.set('monetary_bank_int', { id: record.id }, {
          amount: newAmount,
          rate: record.nextRate,
          cycle: record.nextCycle,
          settlementDate: nextSettlement,
          extendRequested: false,
          nextRate: null,
          nextCycle: null
        })
        
        logInfo(`定期延期结算: uid=${record.uid}, 本金=${record.amount}, 利息=${interest}, 新本金=${newAmount}`)
      } else {
        await ctx.database.remove('monetary_bank_int', { id: record.id })
        
        const totalAmount = record.amount + interest
        const demandConfig = config.demandInterest || { enabled: true, rate: 0.25, cycle: 'day' }
        
        if (demandConfig.enabled) {
          const nextSettlement = calculateNextSettlementDate(demandConfig.cycle as any, false)
          
          await ctx.database.create('monetary_bank_int', {
            uid: record.uid,
            currency: record.currency,
            amount: totalAmount,
            type: 'demand',
            rate: demandConfig.rate,
            cycle: demandConfig.cycle as any,
            settlementDate: nextSettlement,
            extendRequested: false
          })
        }

        // 若有针对该特定定期的冻结记录，将其解绑转为活期冻结
        const freezeRecords = await ctx.database.get('monetary_bank_freeze', {
          uid: record.uid,
          currency: record.currency,
          sourceType: 'fixed',
          sourceRecordId: record.id,
          status: 'frozen'
        })
        for (const fr of freezeRecords) {
          await ctx.database.set('monetary_bank_freeze', { id: fr.id }, {
            sourceType: 'demand',
            sourceRecordId: null
          })
        }
        
        logInfo(`定期到期结算: uid=${record.uid}, 本金=${record.amount}, 利息=${interest}, 转活期=${totalAmount}`)
      }
    }
  } catch (error) {
    logger.error(`结算利息失败 id=${record.id}:`, error)
  }
}

export async function mergeDemandRecords(ctx: Context) {
  try {
    const records = await ctx.database
      .select('monetary_bank_int')
      .where({ type: 'demand' })
      .execute()

    const groups: Record<string, { ids: number[]; uid: number; currency: string; settlementDate: Date; rate: number; cycle: string; total: number }> = {}

    for (const r of records) {
      const sd = new Date(r.settlementDate)
      sd.setHours(0, 0, 0, 0)
      const key = `${r.uid}|${r.currency}|${sd.getTime()}|${r.rate}|${r.cycle}`

      if (!groups[key]) {
        groups[key] = { ids: [], uid: r.uid, currency: r.currency, settlementDate: sd, rate: r.rate, cycle: r.cycle, total: 0 }
      }
      groups[key].ids.push(r.id)
      groups[key].total += Number(r.amount || 0)
    }

    for (const key of Object.keys(groups)) {
      const g = groups[key]
      if (g.ids.length <= 1) continue

      for (const id of g.ids) {
        try {
          await ctx.database.remove('monetary_bank_int', { id })
        } catch (e) {
          logger.warn(`合并活期记录时删除 id=${id} 失败：`, e)
        }
      }

      try {
        await ctx.database.create('monetary_bank_int', {
          uid: g.uid,
          currency: g.currency,
          amount: g.total,
          type: 'demand',
          rate: g.rate,
          cycle: g.cycle as any,
          settlementDate: g.settlementDate,
          extendRequested: false
        })
        logInfo(`合并活期记录: uid=${g.uid}, currency=${g.currency}, settlementDate=${g.settlementDate.toISOString()}, 合并后金额=${g.total}`)
      } catch (e) {
        logger.error('创建合并后活期记录失败：', e)
      }
    }
  } catch (err) {
    logger.error('合并活期记录失败：', err)
  }
}
