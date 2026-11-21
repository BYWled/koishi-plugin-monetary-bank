import { Context, Schema, Logger, h } from 'koishi'
import {
  getBaseTemplate,
  renderHeader,
  renderBalanceCard,
  renderGridItem,
  renderInfoRow,
  renderPromptBox,
  renderConfirmDialog,
  renderHelpList,
  formatAmount,
  HeaderConfig,
  HelpCommandItem,
  NumberFormatOptions
} from './templates'

export const name = 'monetary-bank'

// 定义配置接口
export interface Config {
  defaultCurrency?: string  // 默认货币名称
  themeMode?: 'auto' | 'light' | 'dark' // 主题模式
  debug?: boolean
  enableInterest?: boolean  // 是否启用定期利息功能
  demandInterest?: {
    enabled?: boolean  // 活期利息是否启用
    rate?: number  // 活期利率（百分比）
    cycle?: 'day' | 'week' | 'month'  // 结算周期
  }
  fixedInterest?: Array<{
    name?: string  // 方案名称
    rate?: number  // 利率（百分比）
    cycle?: 'day' | 'week' | 'month'  // 结算周期
  }>
  header?: {
    showAvatar?: boolean
    showUsername?: boolean
    bankTitle?: string
    showTime?: boolean
  }
  transfer?: {
    enabled?: boolean
    allowCash?: boolean
    fee?: {
      rate?: number
      fixed?: number
      minFee?: number
      maxFee?: number
    }
    creditCheck?: {
      enabled?: boolean
      minPayerScore?: number
      minPayeeScore?: number
    }
    freeze?: {
      autoFreeze?: boolean
      accrual?: boolean
      durationMode?: 'fixed' | 'tiered'
      fixedSeconds?: number
      tieredRules?: Array<{ threshold: number; seconds: number }>
    }
  }
  numberFormat?: {
    unit?: 'none' | 'zh' | 'en' | 'auto'
    threshold?: number
    precision?: number
  }
}

// 配置项定义
export const Config: Schema<Config> = Schema.object({
  defaultCurrency: Schema.string()
    .description('默认货币名称')
    .default('coin'),
  themeMode: Schema.union(['auto', 'light', 'dark'])
    .description('主题模式：auto=跟随时间，light=浅色，dark=深色')
    .default('auto'),
  debug: Schema.boolean()
    .description('开启调试日志（显示 info/success 等非 error/warn 日志）')
    .default(true),
  enableInterest: Schema.boolean()
    .description('是否启用定期利息功能')
    .default(false),
  demandInterest: Schema.object({
    enabled: Schema.boolean()
      .description('是否启用活期利息')
      .default(true),
    rate: Schema.number()
      .description('活期利率（%）')
      .default(0.25),
    cycle: Schema.union(['day', 'week', 'month'])
      .description('结算周期（day=日，week=周，month=月）')
      .default('day')
  }).description('活期利息配置'),
  fixedInterest: Schema.array(Schema.object({
    name: Schema.string()
      .description('方案名称')
      .required(),
    rate: Schema.number()
      .description('利率（%）')
      .required(),
    cycle: Schema.union(['day', 'week', 'month'])
      .description('结算周期（day=日，week=周，month=月）')
      .required()
  })).description('定期利息方案配置').default([
    { name: '周定期', rate: 4.35, cycle: 'week' },
    { name: '月定期', rate: 50, cycle: 'month' }
  ]),
  header: Schema.object({
    showAvatar: Schema.boolean()
      .description('页头是否显示用户头像')
      .default(true),
    showUsername: Schema.boolean()
      .description('页头是否显示用户名')
      .default(true),
    bankTitle: Schema.string()
      .description('页头显示的银行机构名称/副标题')
      .default('MONETARY BANK'),
    showTime: Schema.boolean()
      .description('页头是否显示当前时间')
      .default(false)
  }).description('页头展示配置'),
  transfer: Schema.object({
    enabled: Schema.boolean()
      .description('是否启用转账功能')
      .default(true),
    allowCash: Schema.boolean()
      .description('是否允许参数指定现金支付')
      .default(true),
    fee: Schema.object({
      rate: Schema.number()
        .description('手续费费率（%）')
        .default(0),
      fixed: Schema.number()
        .description('固定基础手续费')
        .default(0),
      minFee: Schema.number()
        .description('最低手续费保底')
        .default(0),
      maxFee: Schema.number()
        .description('最高手续费封顶（0 为不封顶）')
        .default(0)
    }).description('转账手续费配置'),
    creditCheck: Schema.object({
      enabled: Schema.boolean()
        .description('（占位）是否校验双方信用分')
        .default(false),
      minPayerScore: Schema.number()
        .description('转账付款方最低信用分要求')
        .default(60),
      minPayeeScore: Schema.number()
        .description('收款方最低信用分要求')
        .default(0)
    }).description('信用分拦截配置（联动占位）'),
    freeze: Schema.object({
      autoFreeze: Schema.boolean()
        .description('转账到账是否自动冻结资金')
        .default(false),
      accrual: Schema.boolean()
        .description('转账冻结资金是否允许结息（默认不可结息）')
        .default(false),
      durationMode: Schema.union(['fixed', 'tiered'])
        .description('冻结时长计算模式：fixed=固定时长，tiered=按金额阶梯')
        .default('fixed'),
      fixedSeconds: Schema.number()
        .description('固定冻结时长（秒，默认 86400 即 24 小时）')
        .default(86400),
      tieredRules: Schema.array(Schema.object({
        threshold: Schema.number().description('金额阈值').required(),
        seconds: Schema.number().description('对应冻结时长（秒）').required()
      })).description('金额阶梯冻结时长规则').default([
        { threshold: 5000, seconds: 7200 },
        { threshold: 20000, seconds: 86400 }
      ])
    }).description('转账自动冻结配置')
  }).description('转账业务配置'),
  numberFormat: Schema.object({
    unit: Schema.union(['auto', 'zh', 'en', 'none'])
      .description('数字缩写单位：auto=超长自动缩写(万/亿)，zh=中文单位(千/万/亿)，en=英文缩写(K/M/B/T)，none=不缩写')
      .default('auto'),
    threshold: Schema.number()
      .description('自动缩写触发阈值（达到该值时启动缩写）')
      .default(10000000),
    precision: Schema.number()
      .description('缩写时保留的小数位数')
      .default(2)
  }).description('数字与金额排版缩写优化配置')
})

// 依赖注入：声明插件需要的服务
export const inject = {
  required: ['database'],  // 必须依赖数据库服务
  optional: ['puppeteer', 'monetaryBank', 'monetaryCredit']  // 可选依赖puppeteer、monetaryBank和monetaryCredit
}

// 创建日志记录器
const logger = new Logger('[monetary-bank]')

// 全局 debug 开关（由配置控制），用于控制是否打印 info/success 级别日志
let debugEnabled = true

function logInfo(...args: any[]) {
  if (debugEnabled) {
    ; (logger as any).info && (logger as any).info.apply(logger, args)
  }
}

function logSuccess(...args: any[]) {
  if (!debugEnabled) return
  // @ts-ignore
  if (typeof (logger as any).success === 'function') (logger as any).success.apply(logger, args)
  else (logger as any).info && (logger as any).info.apply(logger, args)
}

/**
 * 资产明细结构体
 */
export interface BankBalance {
  total: number           // 银行总资产（活期总额 + 定期总额）
  demand: number          // 活期存款总额
  fixed: number           // 定期存款总额
  availableDemand: number // 可用活期（活期总额 - 活期冻结）
  availableFixed: number  // 可用定期（定期总额 - 定期冻结）
  frozen: {
    total: number         // 冻结总额
    demand: number        // 活期冻结
    fixed: number         // 定期冻结
    demandAccrual: number // 活期可结息冻结（担保金等）
    demandNonAccrual: number // 活期不可结息冻结（转账在途等）
  }
}

/**
 * 转账调用入参选项（供 API 及指令共用，不修改全局配置）
 */
export interface TransferApiOptions {
  fromCash?: boolean       // 是否使用现金支付
  feeRate?: number        // 手续费费率覆盖
  feeFixed?: number       // 固定手续费覆盖
  minFee?: number         // 最低手续费
  maxFee?: number         // 最高手续费
  innerFee?: boolean      // 是否内扣（默认外扣）
  freeze?: boolean        // 是否冻结
  freezeDuration?: number // 冻结时长（秒）
  freezeAccrual?: boolean // 冻结资金是否结息
  reason?: string         // 业务说明
}

/**
 * 转账执行结果
 */
export interface TransferResult {
  success: boolean
  amount?: number
  fee?: number
  netAmount?: number
  innerFee?: boolean
  fromCash?: boolean
  frozen?: boolean
  unfreezeAt?: Date
  error?: string
  newPayerBalance?: BankBalance
  newPayerCash?: number
  newPayeeBalance?: BankBalance
}

/**
 * 数据库表结构声明
 */
declare module 'koishi' {
  interface Tables {
    monetary_bank_int: MonetaryBankInterest
    monetary_bank_freeze: MonetaryBankFreeze
  }
  
  interface Context {
    monetaryBank: MonetaryBankAPI
    puppeteer?: any  // Puppeteer 服务（可选）
  }
  
  interface Services {
    monetaryBank: MonetaryBankAPI
  }
}

/**
 * 银行API接口类
 * 提供给其他插件调用的银行操作接口
 */
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

/**
 * 利息记录表结构
 */
export interface MonetaryBankInterest {
  id: number        // 自增主键
  uid: number       // 用户ID
  currency: string  // 货币类型
  amount: number    // 本金金额
  type: 'demand' | 'fixed'  // 类型：demand=活期，fixed=定期
  rate: number      // 利率（百分比）
  cycle: 'day' | 'week' | 'month'  // 结算周期
  settlementDate: Date  // 下次结算日期
  extendRequested: boolean  // 是否申请延期（仅定期有效）
  nextRate?: number  // 延期后使用的利率（仅定期有效）
  nextCycle?: 'day' | 'week' | 'month'  // 延期后使用的周期（仅定期有效）
}

/**
 * 冻结记录表结构
 */
export interface MonetaryBankFreeze {
  id: number
  uid: number
  currency: string
  amount: number
  sourceType: 'demand' | 'fixed'
  sourceRecordId?: number | null   // 冻结来源记录 id（monetary_bank_int 记录），转账冻结为 null
  senderUid?: number | null        // 转账冻结的付款方 uid（用于付款方首页"转出在途"展示）
  accrual: boolean        // 是否可结息：true 为担保/抵押等，false 为转账在途/消费预占
  reason: string
  frozenAt: Date
  unfreezeAt?: Date | null
  status: 'frozen' | 'unfrozen' | 'forfeited' // forfeited 为抵债没收
}

/**
 * 获取当前主题是否为深色模式
 */
function getTheme(config: Config): boolean {
  if (config.themeMode === 'light') return false
  if (config.themeMode === 'dark') return true
  
  // auto mode: 18:00 - 6:00 is dark
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6
}

/**
 * 初始化数据库模型
 */
async function initDatabase(ctx: Context): Promise<boolean> {
  try {
    const tables = await ctx.database.tables

    // 1. 检查并创建 monetary_bank_int 表
    if (tables && 'monetary_bank_int' in tables) {
      logInfo('检测到 monetary_bank_int 表已存在')
    } else {
      logInfo('monetary_bank_int 表不存在，正在创建...')
      
      ctx.model.extend('monetary_bank_int', {
        id: { type: 'unsigned', nullable: false },
        uid: { type: 'unsigned', nullable: false },
        currency: { type: 'string', nullable: false },
        amount: { type: 'double', nullable: false },
        type: { type: 'string', nullable: false },
        rate: { type: 'double', nullable: false },
        cycle: { type: 'string', nullable: false },
        settlementDate: { type: 'timestamp', nullable: false },
        extendRequested: { type: 'boolean', nullable: false },
        nextRate: { type: 'double', nullable: true },
        nextCycle: { type: 'string', nullable: true }
      }, {
        primary: 'id',
        autoInc: true
      })
      
      logSuccess('✓ monetary_bank_int 表创建成功')
    }

    // 2. 检查并创建 monetary_bank_freeze 表
    if (tables && 'monetary_bank_freeze' in tables) {
      logInfo('检测到 monetary_bank_freeze 表已存在')
    } else {
      logInfo('monetary_bank_freeze 表不存在，正在创建...')

      ctx.model.extend('monetary_bank_freeze', {
        id: { type: 'unsigned', nullable: false },
        uid: { type: 'unsigned', nullable: false },
        currency: { type: 'string', nullable: false },
        amount: { type: 'double', nullable: false },
        sourceType: { type: 'string', nullable: false },
        sourceRecordId: { type: 'unsigned', nullable: true },
        senderUid: { type: 'unsigned', nullable: true },
        accrual: { type: 'boolean', nullable: false },
        reason: { type: 'string', nullable: false },
        frozenAt: { type: 'timestamp', nullable: false },
        unfreezeAt: { type: 'timestamp', nullable: true },
        status: { type: 'string', nullable: false }
      }, {
        primary: 'id',
        autoInc: true
      })

      logSuccess('✓ monetary_bank_freeze 表创建成功')
    }

    return true
  } catch (error) {
    logger.error('初始化数据库时发生错误:', error)
    return false
  }
}

/**
 * 自动解冻检查函数
 */
async function checkAndUnfreeze(ctx: Context, uid?: number): Promise<number> {
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

/**
 * 获取用户在主货币表（monetary）中的记录和数值字段名
 */
async function findMonetaryRecord(ctx: Context, uid: number, currency: string): Promise<{ keyQuery: any; record: any; valueField: string } | null> {
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
async function createMonetaryUser(ctx: Context, uid: number, currency: string): Promise<boolean> {
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
async function getMonetaryBalance(ctx: Context, uid: number, currency: string): Promise<number | null> {
  const entry = await findMonetaryRecord(ctx, uid, currency)
  if (!entry) return null
  const val = Number(entry.record[entry.valueField] || 0)
  return Number.isNaN(val) ? null : val
}

/**
 * 修改主货币（monetary）余额
 */
async function changeMonetary(ctx: Context, uid: number, currency: string, delta: number): Promise<number | null> {
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

/**
 * 计算下次结算日期（T+1方案）
 */
function calculateNextSettlementDate(cycle: 'day' | 'week' | 'month', isNew: boolean = false): Date {
  const now = new Date()
  const settlement = new Date(now)
  
  settlement.setHours(0, 0, 0, 0)
  
  if (isNew) {
    settlement.setDate(settlement.getDate() + 1)
  }
  
  switch (cycle) {
    case 'day':
      settlement.setDate(settlement.getDate() + 1)
      break
    case 'week':
      settlement.setDate(settlement.getDate() + 7)
      break
    case 'month':
      settlement.setDate(settlement.getDate() + 30)
      break
  }
  
  return settlement
}

/**
 * 利息结算定时任务
 */
async function scheduleInterestSettlement(ctx: Context, config: Config) {
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

/**
 * 结算单条利息记录
 */
async function settleInterest(ctx: Context, config: Config, record: MonetaryBankInterest) {
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

/**
 * 计算用户银行总余额与冻结资产明细
 */
async function getBankBalance(ctx: Context, uid: number, currency: string): Promise<BankBalance> {
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

/**
 * 合并活期记录（仅对 type='demand' 有效）
 */
async function mergeDemandRecords(ctx: Context) {
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

/**
 * 计算转账手续费
 */
function calculateTransferFee(
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

/**
 * 校验信用分（Alpha 占位机制）
 */
async function checkCreditScore(
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

/**
 * 解析转账目标用户（支持 at 或 QQ/平台 ID，未开户自动建档）
 */
async function resolveTargetUid(
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

/**
 * 生成存款确认文本
 */
function generateDepositConfirmMessage(amount: number, currency: string, cash: number): string {
  return `您将存入 ${amount} ${currency} 到银行，当前现金：${cash} ${currency}。\n确认操作请回复 yes 或 y，取消请回复其他内容。`
}

/**
 * 生成取款确认文本
 */
function generateWithdrawConfirmMessage(amount: number, currency: string, availableBalance: number): string {
  return `您将从银行取出 ${amount} ${currency}，当前可用活期：${availableBalance} ${currency}。\n确认操作请回复 yes 或 y，取消请回复其他内容。`
}

/**
 * 格式化冻结时长文本（避免 60 秒等较短时长变成 0 小时）
 */
function formatDurationText(seconds: number): string {
  if (seconds <= 0) return '0秒'
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
  if (seconds % 3600 === 0) return `${seconds / 3600}小时`
  return `${(seconds / 3600).toFixed(1)}小时`
}

/**
 * 极简短格式化解冻时间（防长文本换行，例如：已冻结至 11-20 14:30）
 */
function formatShortUnfreezeTime(unfreezeAt: Date | undefined): string {
  if (!unfreezeAt) return '即时可用'
  const d = new Date(unfreezeAt)
  if (isNaN(d.getTime())) return '即时可用'
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `已冻结至 ${m}-${day} ${h}:${min}`
}

/**
 * 生成转账确认文本
 */
function generateTransferConfirmText(
  payeeDisplay: string,
  amount: number,
  currency: string,
  fee: number,
  innerFee: boolean,
  fromCash: boolean,
  willFreeze: boolean,
  freezeSeconds: number
): string {
  const deductType = innerFee ? '内扣（转账金额内扣除）' : '外扣（额外支付）'
  const source = fromCash ? '现金账户' : '银行活期可用余额'
  const net = innerFee ? amount - fee : amount
  const freezeNotice = willFreeze ? `\n- 到账状态：收款方到账冻结 ${formatDurationText(freezeSeconds)}（不可结息）` : ''

  return `请确认转账信息：\n- 收款用户：${payeeDisplay}\n- 转账金额：${amount} ${currency}\n- 扣款来源：${source}\n- 手续费用：${fee} ${currency}（${deductType}）\n- 收款实到：${net} ${currency}（活期存款）${freezeNotice}\n\n确认转账请输入 yes 或 y，取消请输入其他内容。`
}

/**
 * 插件主函数
 */
export async function apply(ctx: Context, config: Config) {
  debugEnabled = typeof config?.debug === 'boolean' ? config.debug : true

  const dbInitSuccess = await initDatabase(ctx)
  if (!dbInitSuccess) {
    logger.error('插件加载失败：数据库初始化未通过')
    return
  }

  logSuccess('✓ monetary-bank 插件加载成功')

  // 注册银行API服务
  const api = new MonetaryBankAPI(ctx, config)
  ctx.set('monetaryBank', api)

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

  // 6. 注册命令：银行功能列表（大字号大图展示）
  ctx.command('bank.help', '查看银行功能指令列表')
    .action(async ({ session }) => {
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar
      return await renderBankHelpPage(username, avatarUrl)
    })

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

  if (config.enableInterest) {
    await scheduleInterestSettlement(ctx, config)
  }

  // --- 图形渲染包装函数 ---

  /**
   * 通用图片渲染函数
   */
  async function renderToImage(html: string, fallbackText: string) {
    if (!ctx.puppeteer) {
      return fallbackText
    }

    try {
      const page = await ctx.puppeteer.page()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const element = await page.$('.container')
      const screenshot = await element.screenshot({ type: 'png' })
      await page.close()
      return h.image(screenshot, 'image/png')
    } catch (error) {
      logger.error('图形渲染失败:', error)
      return fallbackText
    }
  }

  /**
   * 渲染银行首页（仅展示用户信息及资产明细，小字引导输入 bank.help）
   */
  async function renderBankHomePage(
    username: string,
    avatarUrl: string | undefined,
    balance: BankBalance,
    cash: number,
    currency: string,
    interestEnabled: boolean,
    currentUid?: number
  ) {
    const numOpt = config.numberFormat
    const demandSub = balance.frozen.demand > 0
      ? `可用 ${formatAmount(balance.availableDemand, numOpt)} (冻结 ${formatAmount(balance.frozen.demand, numOpt)})`
      : `可用: ${formatAmount(balance.availableDemand, numOpt)} | 随存随取`

    const fixedSub = balance.frozen.fixed > 0
      ? `可用 ${formatAmount(balance.availableFixed, numOpt)} (质押 ${formatAmount(balance.frozen.fixed, numOpt)})`
      : (interestEnabled ? '享受定期生息' : '到期自动转活期')

    const cashSub = '钱包可用现金'

    // 检查是否有由当前用户转出且对方仍在冻结期的在途记录
    let outgoingFrozenTotal = 0
    if (currentUid !== undefined && !Number.isNaN(Number(currentUid))) {
      try {
        const outRecords = await ctx.database.get('monetary_bank_freeze', {
          currency,
          senderUid: Number(currentUid),
          status: 'frozen'
        })
        for (const r of outRecords) outgoingFrozenTotal += r.amount
      } catch (e) {}
    }

    let frozenSub = '状态正常 无冻结资金'
    if (balance.frozen.total > 0) {
      frozenSub = `活期 ${formatAmount(balance.frozen.demand, numOpt)} | 定期 ${formatAmount(balance.frozen.fixed, numOpt)}`
    } else if (outgoingFrozenTotal > 0) {
      frozenSub = `户内无冻结 (转出在途冻结 ${formatAmount(outgoingFrozenTotal, numOpt)})`
    }

    const totalAssets = balance.total + cash
    const subLabel = `含钱包现金总计: ${formatAmount(totalAssets, numOpt)} ${currency}`

    const content = `
      ${renderHeader('bank', '银行服务中心', username, avatarUrl, config.header)}
      ${renderBalanceCard('银行总资产', balance.total, currency, subLabel, numOpt)}
      
      <div class="grid">
        ${renderGridItem('demand', '活期存款', balance.demand, demandSub, 'demand', numOpt)}
        ${renderGridItem('fixed', '定期资产', balance.fixed, fixedSub, 'fixed', numOpt)}
        ${renderGridItem('cash', '现金余额', cash, cashSub, 'cash', numOpt)}
        ${renderGridItem('clock', '冻结资金', balance.frozen.total, frozenSub, 'frozen', numOpt)}
      </div>
      
      ${renderPromptBox('💡 功能与指令指引', '银行首页仅保留资产信息。请输入 bank.help 查看所有可用银行功能与指令说明。', 'info')}
    `

    const html = getBaseTemplate(content, 780, getTheme(config))
    const outgoingNote = outgoingFrozenTotal > 0 ? `（转出在途冻结：${outgoingFrozenTotal} ${currency}）` : ''
    const fallback = `【银行服务中心】\n\n用户：${username}\n现金余额：${cash} ${currency}\n银行总资产：${balance.total} ${currency}\n  - 活期存款：${balance.demand} ${currency}（可用：${balance.availableDemand} ${currency}）\n  - 定期存款：${balance.fixed} ${currency}\n  - 冻结资金：${balance.frozen.total} ${currency}${outgoingNote}\n\n💡 输入 bank.help 查看银行所有可用指令及使用说明`
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染银行功能列表（.help 大字号大卡片，免点开清晰可见）
   */
  async function renderBankHelpPage(
    username: string,
    avatarUrl: string | undefined
  ) {
    const commands: HelpCommandItem[] = [
      {
        name: 'bank',
        syntax: 'bank',
        desc: '查看个人银行账户资产总览，展示现金、活期、定期与冻结明细。',
        category: '首页'
      },
      {
        name: 'bank.bal',
        syntax: 'bank.bal [-c <货币>]',
        desc: '详细查询银行存款明细，展示活期可用、冻结资金、定期本金及利率占比。',
        options: '-c: 指定货币类型（默认配置币种）',
        category: '查询'
      },
      {
        name: 'bank.in',
        syntax: 'bank.in <金额|all> [-y]',
        desc: '将个人现金存入银行活期账户，存入后可享受活期计息，可随时取出。',
        options: '-y: 跳过二次确认直接执行',
        category: '存取'
      },
      {
        name: 'bank.out',
        syntax: 'bank.out <金额|all> [-y]',
        desc: '从银行活期可用余额取出至个人现金钱包，冻结资金不可取出。',
        options: '-y: 跳过二次确认直接执行',
        category: '存取'
      },
      {
        name: 'bank.transfer',
        syntax: 'bank.transfer <@用户|QQ号> <金额> [-m] [-i] [-y]',
        desc: '向其他用户银行账户转账，支持现金支付、手续费内扣/外扣与自动冻结机制。',
        options: '-m/--cash: 使用现金支付 | -i/--inner-fee: 手续费内扣 | -y: 跳过确认',
        category: '转账'
      },
      {
        name: 'bank.fixed',
        syntax: 'bank.fixed',
        desc: '申请定期存款，优先扣除现金，不足时扣除活期可用，享受高额利息收益。',
        category: '定期'
      },
      {
        name: 'bank.fixed.manage',
        syntax: 'bank.fixed.manage',
        desc: '管理已存入的定期存款，可申请到期自动按新方案延期续存或取消延期。',
        category: '定期'
      },
      {
        name: 'bank.help',
        syntax: 'bank.help',
        desc: '调出本功能列表，查看所有可用指令与参数说明。',
        category: '帮助'
      }
    ]

    const content = `
      ${renderHeader('manage', '银行功能指令大全', username, avatarUrl, config.header)}
      ${renderPromptBox('📖 使用指南', '带有 [-y] 参数的指令可直接跳过二次确认完成操作；转账收款方未开户将自动建档。', 'info')}
      ${renderHelpList(commands)}
    `

    const html = getBaseTemplate(content, 860, getTheme(config))
    const fallback = `【银行功能指令列表】\n\n${commands.map(c => `• ${c.name} (${c.syntax})\n  ${c.desc}${c.options ? `\n  选项: ${c.options}` : ''}`).join('\n\n')}\n\n💡 带有 [-y] 参数的指令可跳过确认直接执行`

    return await renderToImage(html, fallback)
  }

  /**
   * 渲染转账确认页面
   */
  async function renderTransferConfirmPage(
    username: string,
    avatarUrl: string | undefined,
    payeeDisplay: string,
    amount: number,
    currency: string,
    fee: number,
    innerFee: boolean,
    fromCash: boolean,
    willFreeze: boolean,
    freezeSeconds: number
  ) {
    const numOpt = config.numberFormat
    const feeText = fee > 0 ? `${formatAmount(fee, numOpt)} ${currency}（${innerFee ? '内扣' : '外扣'}）` : '免费'
    const netAmount = innerFee ? amount - fee : amount
    const sourceText = fromCash ? '现金账户' : '银行活期可用余额'
    const freezeText = willFreeze ? `收款方到账冻结 ${formatDurationText(freezeSeconds)}（不可结息）` : '直接到账可用'

    const content = `
      ${renderHeader('transfer', '转账确认', username, avatarUrl, config.header)}
      ${renderConfirmDialog('请确认本次转账信息', [
        { label: '收款用户', value: payeeDisplay },
        { label: '转账金额', value: `${formatAmount(amount, numOpt)} ${currency}` },
        { label: '扣款来源', value: sourceText },
        { label: '转账手续费', value: feeText },
        { label: '收款方实到', value: `${formatAmount(netAmount, numOpt)} ${currency}（活期）` },
        { label: '资金冻结状态', value: freezeText }
      ])}
      ${renderPromptBox('安全提醒', '资金将直接汇入对方银行账户；若开启自动冻结，冻结期间收款方不可转出与消费。', 'warning')}
    `

    const html = getBaseTemplate(content, 600, getTheme(config))
    const fallback = generateTransferConfirmText(payeeDisplay, amount, currency, fee, innerFee, fromCash, willFreeze, freezeSeconds)
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染转账成功页面
   */
  async function renderTransferSuccessImage(
    username: string,
    avatarUrl: string | undefined,
    payeeDisplay: string,
    amount: number,
    currency: string,
    fee: number,
    innerFee: boolean,
    fromCash: boolean,
    frozen: boolean,
    unfreezeAt: Date | undefined,
    newPayerCash: number,
    newPayerBalance: BankBalance
  ) {
    const numOpt = config.numberFormat
    const netAmount = innerFee ? amount - fee : amount
    const feeDesc = fee > 0 ? `${formatAmount(fee, numOpt)} ${currency}（${innerFee ? '内扣' : '外扣'}）` : '无'
    const unfreezeText = formatShortUnfreezeTime(unfreezeAt)

    const content = `
      ${renderHeader('success', '转账成功', username, avatarUrl, config.header)}
      ${renderBalanceCard('汇出金额', amount, currency, undefined, numOpt)}
      
      <div class="card success">
        ${renderInfoRow('收款账户', payeeDisplay)}
        ${renderInfoRow('扣款账户', fromCash ? '个人现金' : '银行活期')}
        ${renderInfoRow('手续费', feeDesc)}
        ${renderInfoRow('对方实到', `${formatAmount(netAmount, numOpt)} ${currency}（银行活期）`, 'success')}
        ${frozen ? renderInfoRow('收款到账状态', unfreezeText, 'highlight') : ''}
      </div>

      <div class="grid">
        ${renderGridItem('cash', '当前现金余额', newPayerCash, '现金钱包', 'cash', numOpt)}
        ${renderGridItem('demand', '银行可用活期', newPayerBalance.availableDemand, `活期总额 ${formatAmount(newPayerBalance.demand, numOpt)}`, 'demand', numOpt)}
      </div>

      ${renderPromptBox('温馨提示', frozen ? `资金已直接汇入对方银行账户并自动冻结（${unfreezeText}），期间收款方不可转出或消费，到期自动解冻；您的付款已成功划扣。` : '转账记录已写入账本，对方可登录银行查看到账存款。', 'info')}
    `

    const html = getBaseTemplate(content, 600, getTheme(config))
    const fallback = `转账成功！\n- 收款用户：${payeeDisplay}\n- 转账金额：${amount} ${currency}\n- 对方实到：${netAmount} ${currency}\n- 手续费用：${feeDesc}\n- 当前现金余额：${newPayerCash} ${currency}\n- 银行可用活期：${newPayerBalance.availableDemand} ${currency}${frozen ? `\n- 收款到账状态：${unfreezeText}` : ''}`

    return await renderToImage(html, fallback)
  }

  /**
   * 渲染转账失败/拦截页面
   */
  function renderTransferFailedPage(
    username: string,
    avatarUrl: string | undefined,
    title: string,
    reason: string
  ): string {
    const content = `
      ${renderHeader('warning', title, username, avatarUrl, config.header)}
      <div class="card danger">
        ${renderInfoRow('处理结果', '操作被拦截 / 失败', 'error')}
        <div style="padding: 12px 0; font-size: 14px; line-height: 1.6; color: var(--danger-color);">
          ${reason}
        </div>
      </div>
      ${renderPromptBox('帮助提示', '如对拦截结果有疑问，请联系管理员或稍后重试。', 'warning')}
    `
    return getBaseTemplate(content, 520, getTheme(config))
  }

  /**
   * 渲染存款确认页面
   */
  async function renderDepositConfirmPage(
    username: string,
    avatarUrl: string | undefined,
    amount: number,
    currency: string,
    cash: number
  ) {
    const content = `
      ${renderHeader('deposit', '存款确认', username, avatarUrl, config.header)}
      
      ${renderConfirmDialog('请确认存款信息', [
        { label: '存款金额', value: `${amount.toLocaleString()} ${currency}` },
        { label: '存款类型', value: '活期存款' },
        { label: '当前现金', value: `${cash.toLocaleString()} ${currency}` },
        { label: '存款后现金', value: `${(cash - amount).toLocaleString()} ${currency}` }
      ])}
      
      ${renderPromptBox('温馨提示', '存入后将自动转为活期存款，可随时取出', 'info')}
    `

    const html = getBaseTemplate(content, 520, getTheme(config))
    const fallback = generateDepositConfirmMessage(amount, currency, cash)
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染取款确认页面
   */
  async function renderWithdrawConfirmPage(
    username: string,
    avatarUrl: string | undefined,
    amount: number,
    currency: string,
    availableBalance: number
  ) {
    const content = `
      ${renderHeader('withdraw', '取款确认', username, avatarUrl, config.header)}
      
      ${renderConfirmDialog('请确认取款信息', [
        { label: '取款金额', value: `${amount.toLocaleString()} ${currency}` },
        { label: '取款来源', value: '活期可用余额' },
        { label: '可用活期', value: `${availableBalance.toLocaleString()} ${currency}` },
        { label: '取款后活期', value: `${(availableBalance - amount).toLocaleString()} ${currency}` }
      ])}
      
      ${renderPromptBox('温馨提示', '仅可从活期可用余额中取出，冻结资金与定期不可提取', 'warning')}
    `

    const html = getBaseTemplate(content, 520, getTheme(config))
    const fallback = generateWithdrawConfirmMessage(amount, currency, availableBalance)
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染银行余额信息为HTML图片
   */
  async function renderBankBalanceImage(
    username: string,
    avatarUrl: string | undefined,
    balance: BankBalance,
    currency: string,
    demandRate: number = 0.25
  ) {
    const numOpt = config.numberFormat
    const demandPercent = balance.total > 0 ? (balance.demand / balance.total * 100).toFixed(1) : '0'
    const fixedPercent = balance.total > 0 ? (balance.fixed / balance.total * 100).toFixed(1) : '0'

    const demandSub = `利率 ${demandRate}% | 占比 ${demandPercent}%`
    const fixedSub = `占比 ${fixedPercent}% | 可用 ${formatAmount(balance.availableFixed, numOpt)}`
    const availableSub = `随时可转账/取款`
    const frozenSub = balance.frozen.total > 0
      ? `活期 ${formatAmount(balance.frozen.demand, numOpt)} | 定期 ${formatAmount(balance.frozen.fixed, numOpt)}`
      : '状态正常 无冻结资金'

    const content = `
      ${renderHeader('balance', '银行资产明细', username, avatarUrl, config.header)}
      ${renderBalanceCard('总资产', balance.total, currency, undefined, numOpt)}
      <div class="grid">
        ${renderGridItem('demand', '活期存款', balance.demand, demandSub, 'demand', numOpt)}
        ${renderGridItem('fixed', '定期资产', balance.fixed, fixedSub, 'fixed', numOpt)}
        ${renderGridItem('cash', '活期可用', balance.availableDemand, availableSub, 'cash', numOpt)}
        ${renderGridItem('clock', '已冻结资金', balance.frozen.total, frozenSub, 'frozen', numOpt)}
      </div>
    `

    const html = getBaseTemplate(content, 640, getTheme(config))
    const fallback = `您的银行资产：\n总资产：${balance.total} ${currency}\n可用资产（活期）：${balance.availableDemand} ${currency} (利率 ${demandRate}%)\n冻结资金：${balance.frozen.total} ${currency}\n定期资产：${balance.fixed} ${currency}`
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染存款成功页面
   */
  async function renderDepositSuccessImage(
    username: string,
    avatarUrl: string | undefined,
    amount: number,
    currency: string,
    newCash: number,
    newBalance: BankBalance
  ) {
    const content = `
      ${renderHeader('success', '存款成功', username, avatarUrl, config.header)}
      ${renderBalanceCard('存入金额', amount, currency)}
      <div class="card success">
        ${renderInfoRow('存款类型', '活期存款')}
        ${renderInfoRow('当前现金', `${newCash.toLocaleString()} ${currency}`)}
        ${renderInfoRow('银行总资产', `${newBalance.total.toLocaleString()} ${currency}`, 'success')}
      </div>
      <div class="grid">
        ${renderGridItem('demand', '活期可用', newBalance.availableDemand, '可随时取出/转账', 'demand')}
        ${renderGridItem('fixed', '定期资产', newBalance.fixed, '到期自动转活期', 'fixed')}
      </div>
    `

    const html = getBaseTemplate(content, 520, getTheme(config))
    const fallback = `成功存入 ${amount} ${currency}（活期）！\n现金余额：${newCash} ${currency}\n银行总资产：${newBalance.total} ${currency}\n可用活期：${newBalance.availableDemand} ${currency}`
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染取款成功页面
   */
  async function renderWithdrawSuccessImage(
    username: string,
    avatarUrl: string | undefined,
    amount: number,
    currency: string,
    newCash: number,
    newBalance: BankBalance
  ) {
    const content = `
      ${renderHeader('success', '取款成功', username, avatarUrl, config.header)}
      ${renderBalanceCard('取出金额', amount, currency)}
      <div class="card success">
        ${renderInfoRow('取款来源', '活期存款')}
        ${renderInfoRow('当前现金', `${newCash.toLocaleString()} ${currency}`, 'success')}
        ${renderInfoRow('银行总资产', `${newBalance.total.toLocaleString()} ${currency}`)}
      </div>
      <div class="grid">
        ${renderGridItem('cash', '现金余额', newCash, '可用于消费/转账', 'cash')}
        ${renderGridItem('demand', '可用活期', newBalance.availableDemand, '继续生息', 'demand')}
      </div>
    `

    const html = getBaseTemplate(content, 520, getTheme(config))
    const fallback = `成功取出 ${amount} ${currency}！\n现金余额：${newCash} ${currency}\n银行总资产：${newBalance.total} ${currency}\n可用活期：${newBalance.availableDemand} ${currency}`
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染定期存款列表
   */
  async function renderFixedDepositListImage(
    username: string,
    avatarUrl: string | undefined,
    records: any[],
    currency: string
  ) {
    let listHtml = ''
    records.forEach((record, index) => {
      const cycleText = record.cycle === 'day' ? '日' : record.cycle === 'week' ? '周' : '月'
      const statusText = record.extendRequested ? '已申请延期' : '未延期'
      const statusClass = record.extendRequested ? 'pending' : 'active'
      const dueDate = new Date(record.settlementDate).toLocaleDateString()
      
      listHtml += `
        <div class="list-item">
          <div class="list-left">
            <div class="list-title">${index + 1}. ${record.rate}% / ${cycleText}</div>
            <div class="list-subtitle">到期日：${dueDate}</div>
          </div>
          <div class="list-right">
            <div class="list-amount">${record.amount.toLocaleString()} ${currency}</div>
            <span class="list-status ${statusClass}">${statusText}</span>
          </div>
        </div>
      `
    })

    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0)

    const content = `
      ${renderHeader('manage', '定期存款管理', username, avatarUrl, config.header)}
      ${renderBalanceCard('定期总额', totalAmount, currency)}
      ${renderPromptBox('管理说明', '请输入编号选择要管理的定期存款，输入 0 退出', 'info')}
      <div style="margin-bottom: 20px;">
        ${listHtml}
      </div>
    `

    const html = getBaseTemplate(content, 900, getTheme(config))
    const fallback = '您的定期存款：\n' + records.map((r, i) => 
      `${i+1}. ${r.rate}%/${r.cycle} - ${r.amount} ${currency}`
    ).join('\n')
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染定期申请方案选择页面
   */
  async function renderFixedPlanSelectionPage(
    username: string,
    avatarUrl: string | undefined,
    plans: Array<{ name?: string; rate?: number; cycle?: 'day' | 'week' | 'month' }>,
    cash: number,
    demand: number,
    currency: string
  ) {
    const planItems = plans.map((plan, index) => {
      const cycleText = plan.cycle === 'day' ? '日' : plan.cycle === 'week' ? '周' : '月'
      return `
        <div class="list-item">
          <div class="list-left">
            <div class="list-title">${index + 1}. ${plan.name || '未命名'}</div>
            <div class="list-subtitle">利率：${plan.rate || 0}% / 周期：${cycleText}</div>
          </div>
          <div class="list-right">
            <span class="list-status active">可选</span>
          </div>
        </div>
      `
    }).join('')

    const content = `
      ${renderHeader('fixed', '申请定期存款', username, avatarUrl, config.header)}
      
      <div class="grid">
        ${renderGridItem('cash', '可用现金', cash, '优先扣除', 'cash')}
        ${renderGridItem('demand', '可用活期存款', demand, '现金不足时扣除', 'demand')}
      </div>
      
      ${renderPromptBox('方案选择', '请输入方案编号，或输入 0 取消', 'info')}
      
      <div style="margin-bottom: 20px;">
        ${planItems}
      </div>
    `

    const html = getBaseTemplate(content, 900, getTheme(config))
    const fallback = '可选方案：\n' + plans.map((p, i) => 
      `${i+1}. ${p.name} - ${p.rate}% / ${p.cycle}`
    ).join('\n')
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染定期存款成功页面
   */
  async function renderFixedDepositSuccessImage(
    username: string,
    avatarUrl: string | undefined,
    amount: number,
    currency: string,
    planName: string,
    rate: number,
    cycle: 'day' | 'week' | 'month',
    settlementDate: Date,
    fromCash: number,
    fromDemand: number,
    newCash: number,
    newBalance: BankBalance
  ) {
    const cycleText = cycle === 'day' ? '日' : cycle === 'week' ? '周' : '月'
    const dueDate = settlementDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

    const content = `
      ${renderHeader('success', '定期存款成功', username, avatarUrl, config.header)}
      ${renderBalanceCard('存入金额', amount, currency)}
      
      <div class="card success">
        ${renderInfoRow('存款方案', `${planName} (${rate}% / ${cycleText})`, 'success')}
        ${renderInfoRow('资金来源', `现金 ${fromCash.toLocaleString()} + 活期 ${fromDemand.toLocaleString()}`)}
        ${renderInfoRow('到期日期', dueDate)}
      </div>
      
      <div class="grid">
        ${renderGridItem('cash', '当前现金', newCash, '可用于消费', 'cash')}
        ${renderGridItem('bank', '银行总资产', newBalance.total, `活期 ${newBalance.demand} + 定期 ${newBalance.fixed}`, 'bank')}
      </div>
      
      ${renderPromptBox('温馨提示', '定期存款到期后将自动转为活期，或可在管理中申请延期续存', 'info')}
    `

    const html = getBaseTemplate(content, 520, getTheme(config))
    const fallback = `成功申请定期存款！\n方案：${planName}\n金额：${amount} ${currency}\n利率：${rate}% / ${cycleText}\n来源：现金 ${fromCash} + 活期 ${fromDemand}\n到期日：${dueDate}\n银行总资产：${newBalance.total} ${currency}`
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染延期方案选择页面
   */
  async function renderExtensionPlanSelectionPage(
    username: string,
    avatarUrl: string | undefined,
    plans: Array<{ name?: string; rate?: number; cycle?: 'day' | 'week' | 'month' }>,
    currentAmount: number,
    currency: string
  ) {
    const planItems = plans.map((plan, index) => {
      const cycleText = plan.cycle === 'day' ? '日' : plan.cycle === 'week' ? '周' : '月'
      return `
        <div class="list-item">
          <div class="list-left">
            <div class="list-title">${index + 1}. ${plan.name || '未命名'}</div>
            <div class="list-subtitle">利率 ${plan.rate || 0}% / 周期 ${cycleText}</div>
          </div>
          <div class="list-right">
            <span class="list-status active">可选</span>
          </div>
        </div>
      `
    }).join('')

    const content = `
      ${renderHeader('clock', '申请延期续存', username, avatarUrl, config.header)}
      ${renderBalanceCard('当前定期金额', currentAmount, currency)}
      ${renderPromptBox('延期说明', '到期后将按选择的新方案继续存款，本金+利息自动续存', 'info')}
      <div style="margin-bottom: 20px;">
        ${planItems}
      </div>
      ${renderPromptBox('操作提示', '请输入方案编号，或输入 0 返回', 'warning')}
    `

    const html = getBaseTemplate(content, 800, getTheme(config))
    const fallback = '可选续期方案：\n' + plans.map((p, i) => 
      `${i+1}. ${p.name} - ${p.rate}% / ${p.cycle === 'day' ? '日' : p.cycle === 'week' ? '周' : '月'}`
    ).join('\n')
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染取消延期确认页面
   */
  async function renderCancelExtensionPage(
    username: string,
    avatarUrl: string | undefined,
    amount: number,
    currency: string,
    currentPlan: string
  ) {
    const content = `
      ${renderHeader('warning', '取消延期申请', username, avatarUrl, config.header)}
      ${renderBalanceCard('定期金额', amount, currency)}
      
      ${renderConfirmDialog('请确认取消延期', [
        { label: '当前延期方案', value: currentPlan },
        { label: '取消后处理', value: '到期自动转为活期' },
        { label: '是否确认取消', value: '请输入 yes 或 y 确认' }
      ])}
      
      ${renderPromptBox('注意', '取消后，定期存款到期将自动转为活期存款', 'warning')}
    `

    const html = getBaseTemplate(content, 520, getTheme(config))
    const fallback = `当前已申请延期至：${currentPlan}\n取消后到期将自动转为活期\n确认取消请输入 yes 或 y`
    
    return await renderToImage(html, fallback)
  }

  /**
   * 渲染延期操作成功页面
   */
  async function renderExtensionSuccessPage(
    username: string,
    avatarUrl: string | undefined,
    action: 'apply' | 'cancel',
    amount: number,
    currency: string,
    planName?: string,
    rate?: number,
    cycle?: 'day' | 'week' | 'month'
  ) {
    if (action === 'cancel') {
      const content = `
        ${renderHeader('success', '取消成功', username, avatarUrl, config.header)}
        ${renderBalanceCard('定期金额', amount, currency)}
        
        <div class="card success">
          ${renderInfoRow('操作结果', '已取消延期申请', 'success')}
          ${renderInfoRow('到期处理', '自动转为活期存款')}
        </div>
        
        ${renderPromptBox('提示', '到期后本金+利息将转入活期账户，可随时取出', 'info')}
      `

      const html = getBaseTemplate(content, 520, getTheme(config))
      const fallback = `已取消延期申请\n定期金额：${amount} ${currency}\n到期后将自动转为活期`
      
      return await renderToImage(html, fallback)
    } else {
      const cycleText = cycle === 'day' ? '日' : cycle === 'week' ? '周' : '月'
      const content = `
        ${renderHeader('success', '延期申请成功', username, avatarUrl, config.header)}
        ${renderBalanceCard('定期金额', amount, currency)}
        
        <div class="card success">
          ${renderInfoRow('延期方案', `${planName} (${rate}% / ${cycleText})`, 'success')}
          ${renderInfoRow('到期处理', '按新方案自动续存')}
        </div>
        
        ${renderPromptBox('提示', '到期后本金+利息将按新方案继续存入定期', 'info')}
      `

      const html = getBaseTemplate(content, 520, getTheme(config))
      const fallback = `延期申请成功！\n方案：${planName}\n利率：${rate}% / ${cycleText}\n定期金额：${amount} ${currency}`
      
      return await renderToImage(html, fallback)
    }
  }
}
