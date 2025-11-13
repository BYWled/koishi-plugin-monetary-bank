import { Context, Schema, Logger } from 'koishi'

export const name = 'monetary-bank'

// 定义配置接口
export interface Config {
  defaultCurrency?: string  // 默认货币名称
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
}

// 配置项定义
export const Config: Schema<Config> = Schema.object({
  defaultCurrency: Schema.string()
    .description('默认货币名称')
    .default('coin'),
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
  ])
})

// 依赖注入：声明插件需要的服务
export const inject = {
  required: ['database']  // 必须依赖数据库服务
}

// 创建日志记录器
const logger = new Logger('[monetary-bank]')

// 全局 debug 开关（由配置控制），用于控制是否打印 info/success 级别日志
let debugEnabled = true

function logInfo(...args: any[]) {
  if (debugEnabled) {
    // 使用 apply 保证与不同 Logger 签名兼容
    ; (logger as any).info && (logger as any).info.apply(logger, args)
  }
}

function logSuccess(...args: any[]) {
  if (!debugEnabled) return
  // 某些 Logger 可能没有 success，回退到 info
  // @ts-ignore
  if (typeof (logger as any).success === 'function') (logger as any).success.apply(logger, args)
  else (logger as any).info && (logger as any).info.apply(logger, args)
}

/**
 * 数据库表结构声明
 * monetary_bank_int 表用于记录所有存款（活期和定期）
 */
declare module 'koishi' {
  interface Tables {
    monetary_bank_int: MonetaryBankInterest
  }
}

/**
 * 利息记录表结构
 * 用于记录每笔存款的利息计算信息（活期和定期）
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
 * 初始化数据库模型
 * 创建 monetary_bank_int 表用于存储所有存款记录（活期和定期）
 */
async function initDatabase(ctx: Context): Promise<boolean> {
  try {
    const tables = await ctx.database.tables

    // 检查并创建 monetary_bank_int 表
    if (tables && 'monetary_bank_int' in tables) {
      logInfo('检测到 monetary_bank_int 表已存在')
    } else {
      logInfo('monetary_bank_int 表不存在，正在创建...')
      
      ctx.model.extend('monetary_bank_int', {
        id: {
          type: 'unsigned',
          nullable: false,
        },
        uid: {
          type: 'unsigned',
          nullable: false,
        },
        currency: {
          type: 'string',
          nullable: false,
        },
        amount: {
          type: 'unsigned',
          nullable: false,
        },
        type: {
          type: 'string',
          nullable: false,
        },
        rate: {
          type: 'double',
          nullable: false,
        },
        cycle: {
          type: 'string',
          nullable: false,
        },
        settlementDate: {
          type: 'timestamp',
          nullable: false,
        },
        extendRequested: {
          type: 'boolean',
          nullable: false,
        },
        nextRate: {
          type: 'double',
          nullable: true,
        },
        nextCycle: {
          type: 'string',
          nullable: true,
        }
      }, {
        primary: 'id',
        autoInc: true
      })
      
      logSuccess('✓ monetary_bank_int 表创建成功')
    }

    return true

  } catch (error) {
    logger.error('初始化数据库时发生错误:', error)
    return false
  }
}

/**
 * 获取用户在主货币表（monetary）中的记录和数值字段名
 * 返回 { keyQuery, record, valueField } 或 null
 * 优化：合并了查询逻辑，减少重复代码
 */
async function findMonetaryRecord(ctx: Context, uid: number, currency: string): Promise<{ keyQuery: any; record: any; valueField: string } | null> {
  try {
    // 尝试两种主键字段：uid 或 id
    const queryKeys = [{ uid }, { id: uid }]
    
    for (const key of queryKeys) {
      // @ts-ignore
      const recs = await ctx.database.get('monetary', key)
      if (recs && recs.length > 0) {
        // 尝试找到与 currency 匹配的记录
        const record = recs.find((r: any) => r.currency == currency) || recs[0]
        
        // 检测记录中可能的数值字段名
        const numFields = ['value', 'balance', 'amount', 'coin', 'money']
        const valueField = numFields.find((f) => typeof record[f] === 'number') 
          || Object.keys(record).find(k => typeof record[k] === 'number') 
          || 'value'
        
        return { keyQuery: key, record, valueField }
      }
    }
    
    return null
  } catch (err) {
    logger.warn('读取 monetary 表记录时出错：', err)
    return null
  }
}

/**
 * 在主货币表中创建一条最小化的用户记录（按需调用）
 * 行为说明：
 *  - 尝试使用常见字段插入记录（优先使用 uid，其次尝试 id）以兼容不同项目的表结构
 *  - 插入成功返回 true；所有尝试失败则返回 false（调用者可据此决定是否继续）
 * 注意：此函数只创建最小字段集，不会对外部表结构做额外假设或变更
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
      // 继续尝试下一种方式
      continue
    }
  }
  
  logger.warn(`无法自动在 monetary 表中创建用户 uid=${uid}，请手动添加`)
  return false
}

/**
 * 读取用户在主货币表（monetary）中的余额并返回数值
 * 返回值：
 *  - number: 表示当前余额（若记录存在且字段可解析为数字）
 *  - null: 表示无法读取（例如表不存在、查询异常或未能推断出余额字段）
 */
async function getMonetaryBalance(ctx: Context, uid: number, currency: string): Promise<number | null> {
  const entry = await findMonetaryRecord(ctx, uid, currency)
  if (!entry) return null
  const val = Number(entry.record[entry.valueField] || 0)
  return Number.isNaN(val) ? null : val
}

/**
 * 修改主货币（monetary）余额（增/减）并返回修改后的余额
 * 参数：
 *  - delta: 数值变化（正值增加现金，负值减少现金）
 * 返回：修改后的余额（number）或 null（表示失败，如余额不足或写入错误）
 * 逻辑要点：
 *  - 若用户不存在则尝试创建一条最小记录（createMonetaryUser）以保证后续写入成功
 *  - 更新前会读取当前字段并做防护，避免产生负余额
 */
async function changeMonetary(ctx: Context, uid: number, currency: string, delta: number): Promise<number | null> {
  try {
    // 查找现有记录
    let entry = await findMonetaryRecord(ctx, uid, currency)
    
    // 如果不存在，尝试创建
    if (!entry) {
      const created = await createMonetaryUser(ctx, uid, currency)
      if (!created) return null
      
      // 重新查询
      entry = await findMonetaryRecord(ctx, uid, currency)
      if (!entry) return null
    }
    
    const { keyQuery, record, valueField } = entry
    const current = Number(record[valueField] || 0)
    const newVal = current + delta
    
    // 检查余额是否足够
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
 * @param cycle 结算周期
 * @param isNew 是否为新存款（新存款使用T+1）
 * @returns 下次结算日期
 */
function calculateNextSettlementDate(cycle: 'day' | 'week' | 'month', isNew: boolean = false): Date {
  const now = new Date()
  const settlement = new Date(now)
  
  // 设置为当天0点
  settlement.setHours(0, 0, 0, 0)
  
  // 新存款T+1，从明天开始计算
  if (isNew) {
    settlement.setDate(settlement.getDate() + 1)
  }
  
  // 根据周期计算下次结算日期
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
 * 每日0点检查并结算到期的利息
 */
async function scheduleInterestSettlement(ctx: Context, config: Config) {
  if (!config.enableInterest) return
  
  // 计算距离明天0点的毫秒数
  function getMillisecondsUntilMidnight(): number {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.getTime() - now.getTime()
  }
  
  // 立即执行一次结算检查
  async function performSettlement() {
    try {
      logInfo('开始执行利息结算任务...')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // 查询今天需要结算的记录
      const records = await ctx.database.get('monetary_bank_int', {})
      
      for (const record of records) {
        const settlementDate = new Date(record.settlementDate)
        settlementDate.setHours(0, 0, 0, 0)
        
        // 如果结算日期是今天或之前
        if (settlementDate <= today) {
          await settleInterest(ctx, config, record)
        }
      }
      
      logSuccess('利息结算任务执行完成')
    } catch (error) {
      logger.error('利息结算任务执行失败:', error)
    }
  }
  
  // 首次延迟到明天0点执行
  setTimeout(async () => {
    await performSettlement()
    
    // 之后每24小时执行一次
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
    // 计算利息
    const interest = Math.floor(record.amount * record.rate / 100)
    
    if (record.type === 'demand') {
      // 活期：利滚利，更新本金和下次结算日期
      const newAmount = record.amount + interest
      const nextSettlement = calculateNextSettlementDate(record.cycle, false)
      
      await ctx.database.set('monetary_bank_int', { id: record.id }, {
        amount: newAmount,
        settlementDate: nextSettlement
      })
      
      logInfo(`活期利息结算: uid=${record.uid}, 本金=${record.amount}, 利息=${interest}, 新本金=${newAmount}`)
    } else {
      // 定期
      if (record.extendRequested && record.nextRate !== undefined && record.nextCycle) {
        // 申请了延期，使用新利率和周期继续
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
        
        logInfo(`定期延期结算: uid=${record.uid}, 本金=${record.amount}, 利息=${interest}, 新本金=${newAmount}, 新利率=${record.nextRate}%, 新周期=${record.nextCycle}`)
      } else {
        // 未延期，转为活期
        await ctx.database.remove('monetary_bank_int', { id: record.id })
        
        // 本金+利息转为活期
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
        
        logInfo(`定期到期结算: uid=${record.uid}, 本金=${record.amount}, 利息=${interest}, 转活期=${totalAmount}`)
      }
    }
  } catch (error) {
    logger.error(`结算利息失败 id=${record.id}:`, error)
  }
}

/**
 * 计算用户银行总余额（通过 int 表聚合）
 */
async function getBankBalance(ctx: Context, uid: number, currency: string): Promise<{ total: number; demand: number; fixed: number }> {
  const records = await ctx.database.get('monetary_bank_int', { uid, currency })
  
  let demand = 0
  let fixed = 0
  
  for (const record of records) {
    if (record.type === 'demand') {
      demand += record.amount
    } else {
      fixed += record.amount
    }
  }
  
  return { total: demand + fixed, demand, fixed }
}

/**
 * 生成存款确认消息（接口函数，便于后续扩展内容）
 * @param amount 存款金额
 * @param currency 货币类型
 * @param cash 当前现金余额
 * @returns 确认消息文本
 */
function generateDepositConfirmMessage(amount: number, currency: string, cash: number): string {
  return `您将存入 ${amount} ${currency} 到银行，当前现金：${cash} ${currency}。\n确认操作请回复 yes 或 y，取消请回复其他内容。`
}

/**
 * 生成取款确认消息（接口函数，便于后续扩展内容）
 * @param amount 取款金额
 * @param currency 货币类型
 * @param bankBalance 当前银行余额
 * @returns 确认消息文本
 */
function generateWithdrawConfirmMessage(amount: number, currency: string, bankBalance: number): string {
  return `您将从银行取出 ${amount} ${currency}，当前存款：${bankBalance} ${currency}。\n确认操作请回复 yes 或 y，取消请回复其他内容。`
}

/**
 * 插件主函数
 */
export async function apply(ctx: Context, config: Config) {
  // 根据配置设置 debug 开关（必须在 initDatabase 前设置以便输出可控）
  debugEnabled = typeof config?.debug === 'boolean' ? config.debug : true

  // 在插件启动前初始化数据库
  const dbInitSuccess = await initDatabase(ctx)

  // 如果数据库初始化失败，停止加载插件
  if (!dbInitSuccess) {
    logger.error('插件加载失败：数据库初始化未通过')
    return
  }

  logSuccess('✓ monetary-bank 插件加载成功')

  // 注册命令：查询存款
  ctx.command('bank.bal', '查询银行存款')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }) => {
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'

      try {
        const balance = await getBankBalance(ctx, uid, currency)
        
        if (balance.total === 0) {
          return `您在银行中还没有 ${currency} 存款。`
        }

        return `您的银行资产：\n总资产：${balance.total} ${currency}\n可用资产：${balance.demand} ${currency}\n不可用资产：${balance.fixed} ${currency}`

      } catch (error) {
        logger.error('查询存款失败:', error)
        return '查询失败，请稍后再试。'
      }
    })

  // 注册命令：存款（自动转为活期）
  ctx.command('bank.in <amount:string>', '存入货币到银行（自动转为活期）')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .option('yes', '-y 跳过确认直接执行')
    .action(async ({ session, options }, amount) => {
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'

      try {
        // 解析金额（支持 all 关键字）
        let cash = await getMonetaryBalance(ctx, uid, currency)
        if (cash === null) {
          const created = await createMonetaryUser(ctx, uid, currency)
          if (!created) return '无法验证/创建主货币账户（monetary），请联系管理员。'
          cash = 0
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

        if (cash < amountNum) return `现金不足！当前现金：${cash} ${currency}`

        // 二次确认
        if (!options?.yes) {
          const confirmMsg = generateDepositConfirmMessage(amountNum, currency, cash)
          await session.send(confirmMsg)
          
          const userInput = await session.prompt(30000)
          if (!userInput) return '操作超时，已取消存款。'
          
          const confirmed = userInput.trim().toLowerCase()
          if (confirmed !== 'yes' && confirmed !== 'y') {
            return '已取消存款操作。'
          }
        }

        // 扣除现金
        const newCash = await changeMonetary(ctx, uid, currency, -amountNum)
        if (newCash === null) return '扣除现金失败，操作已中止。'

        // 创建活期记录（存入现金自动转为活期）
        const demandConfig = config.demandInterest || { enabled: true, rate: 0.25, cycle: 'day' }
        const settlementDate = calculateNextSettlementDate(demandConfig.cycle as any, true)
        
        await ctx.database.create('monetary_bank_int', {
          uid,
          currency,
          amount: amountNum,
          type: 'demand',
          rate: demandConfig.rate || 0.25,
          cycle: demandConfig.cycle as any || 'day',
          settlementDate,
          extendRequested: false
        })
        
        const balance = await getBankBalance(ctx, uid, currency)
        logInfo(`创建活期记录 uid=${uid}, amount=${amountNum}`)

        return `成功存入 ${amountNum} ${currency}（活期）！\n现金余额：${newCash} ${currency}\n银行总资产：${balance.total} ${currency}`

      } catch (error) {
        logger.error('存款失败:', error)
        return '存款失败，请稍后再试。'
      }
    })

  // 注册命令：取款（仅从活期扣除）
  ctx.command('bank.out <amount:string>', '从银行取出货币（仅可取活期）')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .option('yes', '-y 跳过确认直接执行')
    .action(async ({ session, options }, amount) => {
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'

      try {
        // 查询活期余额
        const balance = await getBankBalance(ctx, uid, currency)
        
        if (balance.demand === 0) {
          return `没有可取出的活期存款。当前活期：${balance.demand} ${currency}`
        }

        // 解析金额（支持 all 关键字）
        const amountInput = String(amount || '').trim().toLowerCase()
        let amountNum: number
        
        if (amountInput === 'all') {
          amountNum = Math.floor(balance.demand)
        } else {
          amountNum = parseInt(amountInput, 10)
          if (Number.isNaN(amountNum) || amountNum <= 0) {
            return '请输入有效的取款金额（正整数或 all）。'
          }
        }

        if (balance.demand < amountNum) {
          return `活期余额不足！当前活期：${balance.demand} ${currency}`
        }

        // 二次确认
        if (!options?.yes) {
          const confirmMsg = generateWithdrawConfirmMessage(amountNum, currency, balance.demand)
          await session.send(confirmMsg)
          
          const userInput = await session.prompt(30000)
          if (!userInput) return '操作超时，已取消取款。'
          
          const confirmed = userInput.trim().toLowerCase()
          if (confirmed !== 'yes' && confirmed !== 'y') {
            return '已取消取款操作。'
          }
        }

        // 按时间顺序扣除活期记录
        let remaining = amountNum
        const demandRecords = await ctx.database
          .select('monetary_bank_int')
          .where({ uid, currency, type: 'demand' })
          .orderBy('settlementDate', 'asc')
          .execute()
        
        for (const record of demandRecords) {
          if (remaining <= 0) break
          
          if (record.amount <= remaining) {
            remaining -= record.amount
            await ctx.database.remove('monetary_bank_int', { id: record.id })
            logInfo(`完全扣除活期记录 id=${record.id}, amount=${record.amount}`)
          } else {
            const newAmount = record.amount - remaining
            await ctx.database.set('monetary_bank_int', { id: record.id }, { amount: newAmount })
            logInfo(`部分扣除活期记录 id=${record.id}, 扣除=${remaining}, 剩余=${newAmount}`)
            remaining = 0
          }
        }
        
        // 增加现金
        const newCash = await changeMonetary(ctx, uid, currency, amountNum)
        if (newCash === null) {
          return '转账到现金失败，请联系管理员。'
        }

        const newBalance = await getBankBalance(ctx, uid, currency)
        return `成功取出 ${amountNum} ${currency}！\n现金余额：${newCash} ${currency}\n银行总资产：${newBalance.total} ${currency}`

      } catch (error) {
        logger.error('取款失败:', error)
        return '取款失败，请稍后再试。'
      }
    })

  // 注册命令：申请定期存款
  ctx.command('bank.fixed', '申请定期存款')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }) => {
      if (!config.enableInterest) {
        return '利息功能未启用。'
      }
      
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'
      
      // 显示可用的定期方案
      const plans = config.fixedInterest || []
      if (plans.length === 0) {
        return '当前没有可用的定期存款方案。'
      }
      
      let msg = '可选的定期存款方案：\n'
      plans.forEach((plan, index) => {
        const cycleText = plan.cycle === 'day' ? '日' : plan.cycle === 'week' ? '周' : '月'
        msg += `${index + 1}. ${plan.name} - 利率：${plan.rate}% - 周期：${cycleText}\n`
      })
      msg += '\n请输入方案编号选择，或输入 0 取消：'
      
      await session.send(msg)
      
      const planInput = await session.prompt(30000)
      if (!planInput) return '操作超时，已取消。'
      
      const planIndex = parseInt(planInput.trim()) - 1
      if (planIndex < 0) return '已取消定期存款申请。'
      if (planIndex >= plans.length) return '无效的方案编号。'
      
      const selectedPlan = plans[planIndex]
      
      // 询问金额
      await session.send(`请输入存入金额（可使用现金和活期存款）：`)
      const amountInput = await session.prompt(30000)
      if (!amountInput) return '操作超时，已取消。'
      
      const amount = parseInt(amountInput.trim())
      if (!amount || amount <= 0) return '无效的金额。'
      
      try {
        // 检查用户资金
        const cash = await getMonetaryBalance(ctx, uid, currency) || 0
        const balance = await getBankBalance(ctx, uid, currency)
        
        const totalAvailable = cash + balance.demand
        if (totalAvailable < amount) {
          return `资金不足！现金：${cash} ${currency}，活期存款：${balance.demand} ${currency}，合计：${totalAvailable} ${currency}`
        }
        
        // 确认
        await session.send(`将存入 ${amount} ${currency} 到定期（${selectedPlan.name}），利率 ${selectedPlan.rate}%。\n确认请输入 yes 或 y：`)
        const confirm = await session.prompt(30000)
        if (!confirm || !['yes', 'y'].includes(confirm.trim().toLowerCase())) {
          return '已取消定期存款申请。'
        }
        
        // 扣款逻辑：优先扣现金，不足时扣活期
        let remaining = amount
        let fromCash = 0
        let fromDemand = 0
        
        if (cash > 0) {
          fromCash = Math.min(cash, remaining)
          remaining -= fromCash
          const newCash = await changeMonetary(ctx, uid, currency, -fromCash)
          if (newCash === null) return '扣除现金失败。'
        }
        
        if (remaining > 0) {
          fromDemand = remaining
          // 从活期记录中扣除
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
        
        // 创建定期记录
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
        return `成功申请定期存款！\n方案：${selectedPlan.name}\n金额：${amount} ${currency}\n来源：现金 ${fromCash} + 活期 ${fromDemand}\n到期日：${settlementDate.toLocaleDateString()}\n银行总资产：${newBalance.total} ${currency}`
        
      } catch (error) {
        logger.error('定期存款失败:', error)
        return '定期存款失败，请稍后再试。'
      }
    })

  // 注册命令：管理定期延期
  ctx.command('bank.fixed.manage', '管理定期存款延期')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }) => {
      if (!config.enableInterest) {
        return '利息功能未启用。'
      }
      
      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'
      
      try {
        // 查询用户的定期记录
        const fixedRecords = await ctx.database
          .select('monetary_bank_int')
          .where({ uid, currency, type: 'fixed' })
          .orderBy('settlementDate', 'asc')
          .execute()
        
        if (fixedRecords.length === 0) {
          return '您没有定期存款记录。'
        }
        
        let msg = '您的定期存款：\n'
        fixedRecords.forEach((record, index) => {
          const cycleText = record.cycle === 'day' ? '日' : record.cycle === 'week' ? '周' : '月'
          const currentPlan = `${record.rate}%/${cycleText}`
          let status = '[未延期]'
          if (record.extendRequested && record.nextRate !== undefined && record.nextCycle) {
            const nextCycleText = record.nextCycle === 'day' ? '日' : record.nextCycle === 'week' ? '周' : '月'
            status = `[已延期至: ${record.nextRate}%/${nextCycleText}]`
          }
          msg += `${index + 1}. ${currentPlan} -【 ${record.amount} ${currency} 】- 到期：${new Date(record.settlementDate).toLocaleDateString()} ${status}\n`
        })
        msg += '\n请输入编号管理，或输入 0 退出：'
        
        await session.send(msg)
        
        const input = await session.prompt(30000)
        if (!input) return '操作超时。'
        
        const recordIndex = parseInt(input.trim()) - 1
        if (recordIndex < 0) return '已退出。'
        if (recordIndex >= fixedRecords.length) return '无效的编号。'
        
        const selectedRecord = fixedRecords[recordIndex]
        
        // 显示操作选项
        if (selectedRecord.extendRequested) {
          const nextCycleText = selectedRecord.nextCycle === 'day' ? '日' : selectedRecord.nextCycle === 'week' ? '周' : '月'
          await session.send(`当前已申请延期至：${selectedRecord.nextRate}%/${nextCycleText}\n输入 1 取消延期申请，输入 0 返回：`)
          const action = await session.prompt(30000)
          if (!action || action.trim() === '0') return '已返回。'
          
          if (action.trim() === '1') {
            await ctx.database.set('monetary_bank_int', { id: selectedRecord.id }, {
              extendRequested: false,
              nextRate: null,
              nextCycle: null
            })
            return '已取消延期申请，到期后将自动转为活期。'
          }
        } else {
          // 显示可选的续期方案
          const plans = config.fixedInterest || []
          let planMsg = '可选的续期方案：\n'
          plans.forEach((plan, index) => {
            const cycleText = plan.cycle === 'day' ? '日' : plan.cycle === 'week' ? '周' : '月'
            planMsg += `${index + 1}. ${plan.name} - 利率：${plan.rate}% - 周期：${cycleText}\n`
          })
          planMsg += '\n请输入方案编号申请延期，或输入 0 返回：'
          
          await session.send(planMsg)
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
          
          return `已申请延期！到期后将按：${newPlan.name}（利率 ${newPlan.rate}%）继续存款。`
        }
        
      } catch (error) {
        logger.error('管理定期失败:', error)
        return '操作失败，请稍后再试。'
      }
    })

  // 启动利息结算定时任务
  if (config.enableInterest) {
    await scheduleInterestSettlement(ctx, config)
  }
}
