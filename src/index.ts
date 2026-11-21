import { Context, Schema } from 'koishi'
import { initDatabase } from './database'
import { MonetaryBankAPI } from './services'
import { createRender } from './render'
import { setDebugEnabled, logger, logSuccess } from './utils/log'
import { scheduleInterestSettlement } from './utils/interest'
import { registerBankCommands } from './commands/bank'
import { registerDepositCommands } from './commands/deposit'
import { registerTransferCommands } from './commands/transfer'
import { registerHelpCommands } from './commands/help'
import { registerFixedCommands } from './commands/fixed'

export const name = 'monetary-bank'

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

export const inject = {
  required: ['database'],  // 必须依赖数据库服务
  optional: ['puppeteer', 'monetaryBank', 'monetaryCredit']  // 可选依赖puppeteer、monetaryBank和monetaryCredit
}

/**
 * 插件主函数
 */
export async function apply(ctx: Context, config: Config) {
  setDebugEnabled(typeof config?.debug === 'boolean' ? config.debug : true)

  const dbInitSuccess = await initDatabase(ctx)
  if (!dbInitSuccess) {
    logger.error('插件加载失败：数据库初始化未通过')
    return
  }

  logSuccess('✓ monetary-bank 插件加载成功')

  // 注册银行API服务
  const api = new MonetaryBankAPI(ctx, config)
  ctx.set('monetaryBank', api)

  // 渲染工厂（图片渲染 + 文本降级）
  const render = createRender(ctx, config)

  // 注册指令（按业务域拆分）
  registerBankCommands(ctx, config, render)
  registerDepositCommands(ctx, config, render)
  registerTransferCommands(ctx, config, render)
  registerHelpCommands(ctx, config, render)
  registerFixedCommands(ctx, config, render)

  // 利息结算定时任务
  if (config.enableInterest) {
    await scheduleInterestSettlement(ctx, config)
  }
}

// 公共导出：供其他插件与类型系统消费（保持与重构前一致的包导出面）
export * from './types'
export { MonetaryBankAPI } from './services'
