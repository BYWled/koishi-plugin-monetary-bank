import type { Context } from 'koishi'
import type { Config } from './index'
import type { BankBalance, TransferApiOptions, TransferResult, MonetaryBankFreeze } from './types'
import { logger, logInfo } from './utils/log'
import { getMonetaryBalance, createMonetaryUser, changeMonetary } from './utils/monetary'
import { checkAndUnfreeze } from './utils/freeze'
import { calculateNextSettlementDate } from './utils/time'
import { calculateTransferFee } from './utils/transfer'

export async function getBankBalance(ctx: Context, uid: number, currency: string): Promise<BankBalance> {
  const numericUid = Number(uid)
  await checkAndUnfreeze(ctx, numericUid)

  const records = await ctx.database.get('monetary_bank_int', { uid: numericUid, currency })
  
  let demand = 0
  let fixed = 0
  
  for (const record of records) {
    if (record.type === 'demand') {
      demand += record.amount
    } else {
      fixed += record.amount
    }
  }

  const freezeRecords = await ctx.database.get('monetary_bank_freeze', {
    uid: numericUid,
    currency,
    status: 'frozen'
  })

  let frozenDemand = 0
  let frozenDemandAccrual = 0
  let frozenDemandNonAccrual = 0
  let frozenFixed = 0

  for (const fr of freezeRecords) {
    if (fr.sourceType === 'demand') {
      frozenDemand += fr.amount
      if (fr.accrual) {
        frozenDemandAccrual += fr.amount
      } else {
        frozenDemandNonAccrual += fr.amount
      }
    } else {
      frozenFixed += fr.amount
    }
  }

  const frozenTotal = frozenDemand + frozenFixed
  const availableDemand = Math.max(0, demand - frozenDemand)
  const availableFixed = Math.max(0, fixed - frozenFixed)

  return {
    total: demand + fixed,
    demand,
    fixed,
    availableDemand,
    availableFixed,
    frozen: {
      total: frozenTotal,
      demand: frozenDemand,
      fixed: frozenFixed,
      demandAccrual: frozenDemandAccrual,
      demandNonAccrual: frozenDemandNonAccrual
    }
  }
}

export class MonetaryBankAPI {
  constructor(private ctx: Context, private config: Config) {}

  /**
   * 查询用户银行资产与冻结明细
   */
  async getBalance(uid: number, currency: string): Promise<BankBalance> {
    return await getBankBalance(this.ctx, uid, currency)
  }

  /**
   * 存款（从用户现金存入银行，自动转为活期）
   */
  async deposit(uid: number, currency: string, amount: number): Promise<{ success: boolean; newCash?: number; newBalance?: BankBalance; error?: string }> {
    try {
      if (!amount || amount <= 0) {
        return { success: false, error: '金额必须大于0' }
      }

      // 检查现金余额
      let cash = await getMonetaryBalance(this.ctx, uid, currency)
      if (cash === null) {
        const created = await createMonetaryUser(this.ctx, uid, currency)
        if (!created) return { success: false, error: '无法验证/创建主货币账户' }
        cash = 0
      }

      if (cash < amount) {
        return { success: false, error: `现金不足，当前现金：${cash} ${currency}` }
      }

      // 扣除现金
      const newCash = await changeMonetary(this.ctx, uid, currency, -amount)
      if (newCash === null) {
        return { success: false, error: '扣除现金失败' }
      }

      // 创建活期记录
      const demandConfig = this.config.demandInterest || { enabled: true, rate: 0.25, cycle: 'day' }
      const settlementDate = calculateNextSettlementDate(demandConfig.cycle as any, true)
      
      await this.ctx.database.create('monetary_bank_int', {
        uid,
        currency,
        amount,
        type: 'demand',
        rate: demandConfig.rate || 0.25,
        cycle: demandConfig.cycle as any || 'day',
        settlementDate,
        extendRequested: false
      })
      
      const newBalance = await getBankBalance(this.ctx, uid, currency)
      logInfo(`API存款: uid=${uid}, amount=${amount}`)

      return { success: true, newCash, newBalance }
    } catch (error) {
      logger.error('API存款失败:', error)
      return { success: false, error: '存款操作失败' }
    }
  }

  /**
   * 取款（从银行取出到用户现金，仅可取活期可用余额）
   */
  async withdraw(uid: number, currency: string, amount: number): Promise<{ success: boolean; newCash?: number; newBalance?: BankBalance; error?: string }> {
    try {
      if (!amount || amount <= 0) {
        return { success: false, error: '金额必须大于0' }
      }

      // 查询活期余额（考虑冻结资金）
      const balance = await getBankBalance(this.ctx, uid, currency)
      
      if (balance.availableDemand < amount) {
        return {
          success: false,
          error: `可用活期余额不足，当前可用活期：${balance.availableDemand} ${currency}（已冻结：${balance.frozen.demand}）`
        }
      }

      // 按时间顺序扣除活期记录
      let remaining = amount
      const demandRecords = await this.ctx.database
        .select('monetary_bank_int')
        .where({ uid, currency, type: 'demand' })
        .orderBy('settlementDate', 'asc')
        .execute()
      
      for (const record of demandRecords) {
        if (remaining <= 0) break
        
        if (record.amount <= remaining) {
          remaining -= record.amount
          await this.ctx.database.remove('monetary_bank_int', { id: record.id })
        } else {
          const newAmount = record.amount - remaining
          await this.ctx.database.set('monetary_bank_int', { id: record.id }, { amount: newAmount })
          remaining = 0
        }
      }
      
      // 增加现金
      const newCash = await changeMonetary(this.ctx, uid, currency, amount)
      if (newCash === null) {
        return { success: false, error: '转账到现金失败' }
      }

      const newBalance = await getBankBalance(this.ctx, uid, currency)
      logInfo(`API取款: uid=${uid}, amount=${amount}`)

      return { success: true, newCash, newBalance }
    } catch (error) {
      logger.error('API取款失败:', error)
      return { success: false, error: '取款操作失败' }
    }
  }

  /**
   * 打款接口（直接向活期账户注入资金，只能操作活期存款）
   */
  async creditDemand(
    uid: number,
    currency: string,
    amount: number,
    options?: { reason?: string }
  ): Promise<{ success: boolean; newBalance?: BankBalance; error?: string }> {
    try {
      if (!amount || amount <= 0) {
        return { success: false, error: '打款金额必须大于 0' }
      }

      const demandConfig = this.config.demandInterest || { enabled: true, rate: 0.25, cycle: 'day' }
      const settlementDate = calculateNextSettlementDate(demandConfig.cycle as any, true)

      await this.ctx.database.create('monetary_bank_int', {
        uid,
        currency,
        amount,
        type: 'demand',
        rate: demandConfig.rate || 0.25,
        cycle: demandConfig.cycle as any || 'day',
        settlementDate,
        extendRequested: false
      })

      const newBalance = await getBankBalance(this.ctx, uid, currency)
      logInfo(`API打款: uid=${uid}, amount=${amount}, reason=${options?.reason || 'API'}`)
      return { success: true, newBalance }
    } catch (error) {
      logger.error('API打款失败:', error)
      return { success: false, error: '打款操作失败' }
    }
  }

  /**
   * 扣款接口（直接从活期账户扣减资金，只能操作活期存款，严格限制不可扣减冻结资金）
   */
  async debitDemand(
    uid: number,
    currency: string,
    amount: number,
    options?: { reason?: string }
  ): Promise<{ success: boolean; newBalance?: BankBalance; error?: string }> {
    try {
      if (!amount || amount <= 0) {
        return { success: false, error: '扣款金额必须大于 0' }
      }

      const balance = await getBankBalance(this.ctx, uid, currency)
      if (balance.availableDemand < amount) {
        return {
          success: false,
          error: `活期可用余额不足，当前可用活期：${balance.availableDemand} ${currency}（已冻结：${balance.frozen.demand}）`
        }
      }

      let remaining = amount
      const demandRecords = await this.ctx.database
        .select('monetary_bank_int')
        .where({ uid, currency, type: 'demand' })
        .orderBy('settlementDate', 'asc')
        .execute()

      for (const record of demandRecords) {
        if (remaining <= 0) break
        if (record.amount <= remaining) {
          remaining -= record.amount
          await this.ctx.database.remove('monetary_bank_int', { id: record.id })
        } else {
          const newAmount = record.amount - remaining
          await this.ctx.database.set('monetary_bank_int', { id: record.id }, { amount: newAmount })
          remaining = 0
        }
      }

      const newBalance = await getBankBalance(this.ctx, uid, currency)
      logInfo(`API扣款: uid=${uid}, amount=${amount}, reason=${options?.reason || 'API'}`)
      return { success: true, newBalance }
    } catch (error) {
      logger.error('API扣款失败:', error)
      return { success: false, error: '扣款操作失败' }
    }
  }

  /**
   * 冻结接口（支持活期与定期存款冻结，可指定结息属性、时长与原因）
   */
  async freeze(
    uid: number,
    currency: string,
    amount: number,
    type: 'demand' | 'fixed',
    options?: { duration?: number; unfreezeAt?: Date; accrual?: boolean; reason?: string; sourceRecordId?: number }
  ): Promise<{ success: boolean; freezeId?: number; newBalance?: BankBalance; error?: string }> {
    try {
      if (!amount || amount <= 0) {
        return { success: false, error: '冻结金额必须大于 0' }
      }

      const balance = await getBankBalance(this.ctx, uid, currency)
      if (type === 'demand') {
        if (balance.availableDemand < amount) {
          return { success: false, error: `活期可用余额不足以冻结，当前可用活期：${balance.availableDemand} ${currency}` }
        }
      } else {
        if (balance.availableFixed < amount) {
          return { success: false, error: `定期可用余额不足以冻结，当前可用定期：${balance.availableFixed} ${currency}` }
        }
      }

      let unfreezeAt = options?.unfreezeAt
      if (!unfreezeAt && options?.duration && options.duration > 0) {
        unfreezeAt = new Date(Date.now() + options.duration * 1000)
      }

      // 定期冻结（担保金/抵押金）默认可结息；活期冻结默认不可结息
      const accrual = options?.accrual ?? (type === 'fixed' ? true : false)

      const record = await this.ctx.database.create('monetary_bank_freeze', {
        uid,
        currency,
        amount,
        sourceType: type,
        sourceRecordId: options?.sourceRecordId || null,
        accrual,
        reason: options?.reason || 'API资金冻结',
        frozenAt: new Date(),
        unfreezeAt: unfreezeAt || null,
        status: 'frozen'
      })

      const newBalance = await getBankBalance(this.ctx, uid, currency)
      logInfo(`资金冻结成功: id=${record.id}, uid=${uid}, amount=${amount}, type=${type}, accrual=${accrual}`)

      return { success: true, freezeId: record.id, newBalance }
    } catch (error) {
      logger.error('冻结资金失败:', error)
      return { success: false, error: '冻结操作失败' }
    }
  }

  /**
   * 解冻接口
   */
  async unfreeze(
    freezeId: number
  ): Promise<{ success: boolean; newBalance?: BankBalance; error?: string }> {
    try {
      const [record] = await this.ctx.database.get('monetary_bank_freeze', { id: freezeId })
      if (!record) {
        return { success: false, error: '未找到该冻结记录' }
      }
      if (record.status !== 'frozen') {
        return { success: false, error: `该记录已是 ${record.status} 状态` }
      }

      await this.ctx.database.set('monetary_bank_freeze', { id: freezeId }, { status: 'unfrozen' })
      const newBalance = await getBankBalance(this.ctx, record.uid, record.currency)
      logInfo(`资金解冻成功: id=${freezeId}, uid=${record.uid}, amount=${record.amount}`)

      return { success: true, newBalance }
    } catch (error) {
      logger.error('解冻资金失败:', error)
      return { success: false, error: '解冻操作失败' }
    }
  }

  /**
   * 定期抵债没收接口（意外情况处置：定期未满利息不再发放，扣除定期本金）
   */
  async forfeitFixedFreeze(
    freezeId: number,
    options?: { reason?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [freeze] = await this.ctx.database.get('monetary_bank_freeze', { id: freezeId })
      if (!freeze) {
        return { success: false, error: '未找到该冻结记录' }
      }
      if (freeze.status !== 'frozen') {
        return { success: false, error: `该记录非冻结状态（${freeze.status}）` }
      }
      if (freeze.sourceType !== 'fixed') {
        return { success: false, error: '非定期冻结记录，无法执行定期抵债' }
      }

      // 扣除对应定期记录本金，未结利息直接作废
      let remaining = freeze.amount
      if (freeze.sourceRecordId) {
        const [fixedRec] = await this.ctx.database.get('monetary_bank_int', { id: freeze.sourceRecordId })
        if (fixedRec) {
          if (fixedRec.amount <= remaining) {
            remaining -= fixedRec.amount
            await this.ctx.database.remove('monetary_bank_int', { id: fixedRec.id })
          } else {
            await this.ctx.database.set('monetary_bank_int', { id: fixedRec.id }, { amount: fixedRec.amount - remaining })
            remaining = 0
          }
        }
      }

      if (remaining > 0) {
        const fixedRecs = await this.ctx.database
          .select('monetary_bank_int')
          .where({ uid: freeze.uid, currency: freeze.currency, type: 'fixed' })
          .orderBy('settlementDate', 'asc')
          .execute()

        for (const fr of fixedRecs) {
          if (remaining <= 0) break
          if (fr.amount <= remaining) {
            remaining -= fr.amount
            await this.ctx.database.remove('monetary_bank_int', { id: fr.id })
          } else {
            await this.ctx.database.set('monetary_bank_int', { id: fr.id }, { amount: fr.amount - remaining })
            remaining = 0
          }
        }
      }

      // 将冻结记录状态设为 forfeited
      await this.ctx.database.set('monetary_bank_freeze', { id: freezeId }, {
        status: 'forfeited',
        reason: `${freeze.reason} (抵债处置: ${options?.reason || '未满期利息作废'})`
      })

      logInfo(`定期冻结抵债扣除成功: freezeId=${freezeId}, uid=${freeze.uid}, amount=${freeze.amount}`)
      return { success: true }
    } catch (error) {
      logger.error('定期抵债处置失败:', error)
      return { success: false, error: '定期抵债处置失败' }
    }
  }

  /**
   * 查询用户冻结资产明细
   */
  async getFrozenBalance(
    uid: number,
    currency: string
  ): Promise<{ total: number; demand: number; fixed: number; records: MonetaryBankFreeze[] }> {
    await checkAndUnfreeze(this.ctx, uid)
    const records = await this.ctx.database.get('monetary_bank_freeze', {
      uid,
      currency,
      status: 'frozen'
    })

    let demand = 0
    let fixed = 0
    for (const r of records) {
      if (r.sourceType === 'demand') demand += r.amount
      else fixed += r.amount
    }

    return {
      total: demand + fixed,
      demand,
      fixed,
      records
    }
  }

  /**
   * 转账接口（支持自定义转账可配置项，不污染银行全局配置）
   */
  async transfer(
    fromUid: number,
    toUid: number,
    currency: string,
    amount: number,
    options?: TransferApiOptions
  ): Promise<TransferResult> {
    try {
      if (!amount || amount <= 0) {
        return { success: false, error: '转账金额必须大于 0' }
      }
      if (fromUid === toUid) {
        return { success: false, error: '不能向自己转账' }
      }

      const fromCash = options?.fromCash ?? false
      const innerFee = options?.innerFee ?? false

      // 计算手续费（优先入参覆盖，回退全局配置）
      const feeConfig = {
        rate: options?.feeRate ?? this.config.transfer?.fee?.rate ?? 0,
        fixed: options?.feeFixed ?? this.config.transfer?.fee?.fixed ?? 0,
        minFee: options?.minFee ?? this.config.transfer?.fee?.minFee ?? 0,
        maxFee: options?.maxFee ?? this.config.transfer?.fee?.maxFee ?? 0,
      }
      const fee = calculateTransferFee(amount, feeConfig)

      let totalDeduct: number
      let netAmount: number

      if (innerFee) {
        totalDeduct = amount
        netAmount = amount - fee
        if (netAmount <= 0) {
          return { success: false, error: `转账金额（${amount}）不足以扣除手续费（${fee}）` }
        }
      } else {
        totalDeduct = amount + fee
        netAmount = amount
      }

      // 1. 付款方扣除
      let newPayerCash: number | undefined
      if (fromCash) {
        let cash = await getMonetaryBalance(this.ctx, fromUid, currency)
        if (cash === null) {
          await createMonetaryUser(this.ctx, fromUid, currency)
          cash = 0
        }
        if (cash < totalDeduct) {
          return {
            success: false,
            error: `现金余额不足，需要 ${totalDeduct} ${currency}（含手续费 ${fee}），当前现金：${cash} ${currency}`
          }
        }
        const updatedCash = await changeMonetary(this.ctx, fromUid, currency, -totalDeduct)
        if (updatedCash === null) {
          return { success: false, error: '扣除现金失败' }
        }
        newPayerCash = updatedCash
      } else {
        const payerBal = await getBankBalance(this.ctx, fromUid, currency)
        if (payerBal.availableDemand < totalDeduct) {
          return {
            success: false,
            error: `银行活期可用余额不足，需要 ${totalDeduct} ${currency}（含手续费 ${fee}），可用活期：${payerBal.availableDemand} ${currency}（已冻结：${payerBal.frozen.demand}）`
          }
        }

        let remaining = totalDeduct
        const demandRecords = await this.ctx.database
          .select('monetary_bank_int')
          .where({ uid: fromUid, currency, type: 'demand' })
          .orderBy('settlementDate', 'asc')
          .execute()

        for (const record of demandRecords) {
          if (remaining <= 0) break
          if (record.amount <= remaining) {
            remaining -= record.amount
            await this.ctx.database.remove('monetary_bank_int', { id: record.id })
          } else {
            const newAmount = record.amount - remaining
            await this.ctx.database.set('monetary_bank_int', { id: record.id }, { amount: newAmount })
            remaining = 0
          }
        }
      }

      // 2. 收款方到账（只能到银行活期账户）
      const demandConfig = this.config.demandInterest || { enabled: true, rate: 0.25, cycle: 'day' }
      const settlementDate = calculateNextSettlementDate(demandConfig.cycle as any, true)
      
      await this.ctx.database.create('monetary_bank_int', {
        uid: toUid,
        currency,
        amount: netAmount,
        type: 'demand',
        rate: demandConfig.rate || 0.25,
        cycle: demandConfig.cycle as any || 'day',
        settlementDate,
        extendRequested: false
      })

      // 3. 检查是否自动冻结到账资金（转账冻结默认不可结息）
      const freezeCfg = this.config.transfer?.freeze
      const shouldFreeze = options?.freeze ?? freezeCfg?.autoFreeze ?? false
      let unfreezeAt: Date | undefined

      if (shouldFreeze) {
        let freezeSeconds = options?.freezeDuration
        if (freezeSeconds === undefined) {
          if (freezeCfg?.durationMode === 'tiered' && freezeCfg.tieredRules?.length) {
            const matched = [...freezeCfg.tieredRules]
              .sort((a, b) => b.threshold - a.threshold)
              .find(r => netAmount >= r.threshold)
            freezeSeconds = matched ? matched.seconds : (freezeCfg.fixedSeconds ?? 86400)
          } else {
            freezeSeconds = freezeCfg?.fixedSeconds ?? 86400
          }
        }

        const isAccrual = options?.freezeAccrual ?? freezeCfg?.accrual ?? false
        unfreezeAt = new Date(Date.now() + freezeSeconds * 1000)

        await this.ctx.database.create('monetary_bank_freeze', {
          uid: toUid,
          currency,
          amount: netAmount,
          sourceType: 'demand',
          sourceRecordId: null,
          senderUid: fromUid,
          accrual: isAccrual,
          reason: options?.reason || `转账到账自动冻结(转自uid:${fromUid})`,
          frozenAt: new Date(),
          unfreezeAt,
          status: 'frozen'
        })
      }

      const newPayerBalance = await getBankBalance(this.ctx, fromUid, currency)
      const newPayeeBalance = await getBankBalance(this.ctx, toUid, currency)
      if (newPayerCash === undefined) {
        newPayerCash = await getMonetaryBalance(this.ctx, fromUid, currency) ?? 0
      }

      logInfo(`转账完成: from=${fromUid}, to=${toUid}, amount=${amount}, fee=${fee}, net=${netAmount}, fromCash=${fromCash}, frozen=${shouldFreeze}`)

      return {
        success: true,
        amount,
        fee,
        netAmount,
        innerFee,
        fromCash,
        frozen: shouldFreeze,
        unfreezeAt,
        newPayerBalance,
        newPayerCash,
        newPayeeBalance
      }
    } catch (error) {
      logger.error('转账执行异常:', error)
      return { success: false, error: '转账操作失败，请稍后重试' }
    }
  }
}
