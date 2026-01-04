import { Context, Schema, Logger } from 'koishi'

export const name = 'monetary-bank'

// 定义配置接口
export interface Config {
  defaultCurrency?: string  // 默认货币名称
  debug?: boolean
}

// 配置项定义
export const Config: Schema<Config> = Schema.object({
  defaultCurrency: Schema.string()
    .description('默认货币名称')
    .default('coin')
  , debug: Schema.boolean()
    .description('开启调试日志（显示 info/success 等非 error/warn 日志）')
    .default(true)
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
 * 数据库表结构声明（仅作类型提示）
 * 表 `monetary_bank` 用于记录插件内的银行账户余额信息。
 * 字段约定：
 *  - uid: 用户唯一 ID（由上层用户系统提供）
 *  - currency: 货币标识（例如 "coin"）
 *  - value: 存款数值（数值类型）
 * 注意：此处为类型声明与文档说明，不会主动修改数据库结构。
 */
declare module 'koishi' {
  interface Tables {
    monetary_bank: MonetaryBank
  }
}

export interface MonetaryBank {
  uid: number       // 用户ID，用于匹配用户
  currency: string  // 货币类型
  value: number     // 存款数额
}

/**
 * 初始化并校验数据库模型
 * 说明：
 *  - 在插件加载时检查是否存在 `monetary_bank` 表；若不存在则调用 `ctx.model.extend` 创建表模型。
 *  - 若表已存在，尝试对其字段做宽松校验并打印调试信息以便诊断，但不会强制修改已有表结构。
 * 返回值：
 *  - true: 初始化与校验通过，插件可以继续加载
 *  - false: 校验失败或发生异常，调用方应中止插件加载以避免潜在的数据损坏
 */
async function initDatabase(ctx: Context): Promise<boolean> {
  try {
    // 获取所有表信息
    const tables = await ctx.database.tables

    // 检查 monetary_bank 表是否存在
    if (tables && 'monetary_bank' in tables) {
      logInfo('检测到 monetary_bank 表已存在，正在验证表结构...')

      // 获取表结构定义（兼容不同数据源返回的多种格式）
      const tableFields = tables['monetary_bank']

      // 将 tableFields 规范化为 { columnName: typeString }
      const normalizeColumns = (raw: any): Record<string, string> => {
        const map: Record<string, string> = {}
        if (!raw) return map
        // 情况 1: 数组 [{ name, type }, ...]
        if (Array.isArray(raw)) {
          for (const col of raw) {
            if (!col) continue
            if (col.name && col.type) map[col.name] = String(col.type)
            else if (col.field && col.type) map[col.field] = String(col.type)
            else if (typeof col === 'string') map[col] = 'unknown'
          }
          return map
        }
        // 情况 2: 对象 { columns: { name: { type } } }
        if (raw.columns && typeof raw.columns === 'object') {
          for (const [k, v] of Object.entries(raw.columns)) {
            if (v && typeof v === 'object') {
              // 使用类型断言并安全读取常见字段
              const vv = v as any
              map[k] = (vv.type || vv.dataType || vv.typeName || JSON.stringify(vv)).toString()
            } else {
              map[k] = String(v)
            }
          }
          return map
        }
        // 情况 3: 直接映射 { name: { type } }
        if (typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw)) {
            if (v && typeof v === 'object') {
              // 常见 shape: { type: 'string' } 或 { type: { name: 'varchar' } }
              if ((v as any).type && typeof (v as any).type === 'string') map[k] = (v as any).type
              else if ((v as any).type && typeof (v as any).type === 'object') map[k] = JSON.stringify((v as any).type)
              else if ((v as any).dataType) map[k] = (v as any).dataType
              else map[k] = JSON.stringify(v)
            } else {
              map[k] = String(v)
            }
          }
          return map
        }
        return map
      }

      const columns = normalizeColumns(tableFields)

      // 调试信息：记录原始表结构（便于诊断）
      logInfo('monetary_bank 表结构（规范化）:', columns)

      // // 验证必需字段是否存在且类型正确（使用宽松匹配）
      // const requiredFields = {
      //   uid: 'integer',      // uid 应该是整数类型
      //   currency: 'string',  // currency 应该是字符串类型
      //   value: 'number'      // value 应该是数值类型
      // }

      let structureValid = true
      const missingFields: string[] = []
      const incompatibleFields: string[] = []

      // const detectType = (rawType: string | undefined): string => {
      //   if (!rawType) return 'unknown'
      //   const t = rawType.toLowerCase()
      //   if (t.includes('int') || t.includes('unsigned') || t.includes('number')) return 'integer'
      //   if (t.includes('char') || t.includes('text') || t.includes('string') || t.includes('varchar')) return 'string'
      //   if (t.includes('float') || t.includes('double') || t.includes('real') || t.includes('decimal')) return 'number'
      //   return 'unknown'
      // }

      // 如果表结构不正确，发出警告并阻止加载
      if (!structureValid) {
        logger.error('❌ monetary_bank 表结构与插件要求不一致！')
        if (missingFields.length > 0) {
          logger.error(`  缺少字段: ${missingFields.join(', ')}`)
        }
        if (incompatibleFields.length > 0) {
          logger.error(`  字段类型不兼容: ${incompatibleFields.join(', ')}`)
        }
        logger.error('  插件将不会加载以防止数据损坏。')
        logger.error('  请检查数据库表结构或删除现有表后重启插件。')
        return false
      }

      logSuccess('✓ 表结构验证通过')
      return true

    } else {
      // 表不存在，创建新表
      logInfo('monetary_bank 表不存在，正在创建...')

      // 扩展数据库模型，定义表结构
      ctx.model.extend('monetary_bank', {
        uid: {
          type: 'unsigned',
          nullable: false,
        },
        currency: {
          type: 'string',
          nullable: false,
        },
        value: {
          type: 'unsigned',
          nullable: false,
        }
      }, {
        primary: ['uid', 'currency'],  // 联合主键：用户ID + 货币类型
        autoInc: false  // 不自增
      })

      logSuccess('✓ monetary_bank 表创建成功')
      return true
    }

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
 * 注意：此函数只创建最小字段集，不会对外部表结构做额外假设或变更。
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
        // 直接查询银行存款，无需预先创建记录
        const records = await ctx.database.get('monetary_bank', {
          uid,
          currency
        })

        if (!records || records.length === 0) {
          return `您在银行中还没有 ${currency} 存款。`
        }

        const balance = records[0].value
        return `您的银行存款：${balance} ${currency}`

      } catch (error) {
        logger.error('查询存款失败:', error)
        return '查询失败，请稍后再试。'
      }
    })  // 注册命令：存款
  ctx.command('bank.in <amount:number>', '存入货币到银行')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }, amount) => {
      if (!amount || amount <= 0) {
        return '请输入有效的存款金额（正整数）。'
      }

      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'

      try {
        // 1. 检查用户现金是否充足（同时确保 monetary 表记录存在）
        let cash = await getMonetaryBalance(ctx, uid, currency)
        if (cash === null) {
          // 尝试创建 monetary 用户记录
          const created = await createMonetaryUser(ctx, uid, currency)
          if (!created) return '无法验证/创建主货币账户（monetary），请联系管理员。'
          cash = 0  // 新创建的用户现金为 0
        }
        if (cash < amount) return `现金不足！当前现金：${cash} ${currency}`

        // 2. 扣除现金
        const newCash = await changeMonetary(ctx, uid, currency, -amount)
        if (newCash === null) return '扣除现金失败，操作已中止。'

        // 3. 增加银行存款（按需创建记录 - lazy-create）
        const records = await ctx.database.get('monetary_bank', { uid, currency })
        let newValue: number

        if (!records || records.length === 0) {
          // 首次存款，直接创建记录
          await ctx.database.create('monetary_bank', { uid, currency, value: amount })
          newValue = amount
          logInfo(`首次存款，创建 monetary_bank 记录 uid=${uid}, currency=${currency}, value=${amount}`)
        } else {
          // 已有记录，累加存款
          const current = Number(records[0].value) || 0
          newValue = current + amount
          await ctx.database.set('monetary_bank', { uid, currency }, { value: newValue })
        }

        return `成功存入 ${amount} ${currency}！现金余额：${newCash} ${currency}；银行存款：${newValue} ${currency}`

      } catch (error) {
        logger.error('存款失败:', error)
        return '存款失败，请稍后再试。'
      }
    })

  // 注册命令：取款
  ctx.command('bank.out <amount:number>', '从银行取出货币')
    .userFields(['id'])
    .option('currency', '-c <currency:string> 指定货币类型')
    .action(async ({ session, options }, amount) => {
      if (!amount || amount <= 0) {
        return '请输入有效的取款金额（正整数）。'
      }

      const uid = session.user.id
      const currency = options?.currency || config.defaultCurrency || 'coin'

      try {
        // 1. 查询银行存款余额
        const records = await ctx.database.get('monetary_bank', { uid, currency })
        if (!records || records.length === 0) {
          return `您在银行中没有 ${currency} 存款。`
        }

        const currentBalance = Number(records[0].value || 0)

        // 2. 检查银行余额是否足够
        if (currentBalance < amount) {
          return `余额不足！当前存款：${currentBalance} ${currency}`
        }

        // 3. 先从银行扣除
        const newBankValue = currentBalance - amount
        await ctx.database.set('monetary_bank', { uid, currency }, { value: newBankValue })

        // 4. 增加用户现金余额
        const newCash = await changeMonetary(ctx, uid, currency, amount)
        if (newCash === null) {
          // 回滚：尝试把银行余额恢复
          await ctx.database.set('monetary_bank', { uid, currency }, { value: currentBalance })
          return '转账到现金失败，操作已回滚，请联系管理员。'
        }

        return `成功取出 ${amount} ${currency}！现金余额：${newCash} ${currency}；银行剩余：${newBankValue} ${currency}`

      } catch (error) {
        logger.error('取款失败:', error)
        return '取款失败，请稍后再试。'
      }
    })
}
