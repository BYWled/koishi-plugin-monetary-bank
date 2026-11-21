import type { MonetaryBankAPI } from './services'

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
