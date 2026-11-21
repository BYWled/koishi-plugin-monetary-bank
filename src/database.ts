import type { Context } from 'koishi'
import { logger, logInfo, logSuccess } from './utils/log'

export async function initDatabase(ctx: Context): Promise<boolean> {
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
