import { App } from 'koishi'
import * as sqlite from '@koishijs/plugin-database-sqlite'
import monetaryPlugin from 'koishi-plugin-monetary'
import * as bankPlugin from './src/index'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ ${message}`)
}

async function runAllTests() {
  console.log('==================================================')
  console.log('🚀 启动 Koishi 沙盒：7 个开放 API 全覆盖测试')
  console.log('==================================================\n')

  const app = new App()
  const sqlitePlugin = (sqlite as any).default || sqlite
  app.plugin(sqlitePlugin, { path: ':memory:' })
  const monPlugin = (monetaryPlugin as any).default || monetaryPlugin
  app.plugin(monPlugin)
  const bank = (bankPlugin as any).default || bankPlugin
  app.plugin(bank, {
    defaultCurrency: 'coin',
    debug: false,
    demandInterest: { enabled: true, rate: 0.25, cycle: 'day' },
    transfer: {
      enabled: true,
      fee: { rate: 10, fixed: 1, minFee: 1 },
      freeze: { autoFreeze: true, fixedSeconds: 120 }
    }
  } as any)

  await app.start()
  const ctx: any = app
  const bankApi = ctx.monetaryBank
  assert(!!bankApi && typeof bankApi.transfer === 'function', 'monetaryBank 服务已注册且可访问')

  // ---- 用户准备 ----
  const u1 = (await ctx.database.create('user', { authority: 1 })).id
  const u2 = (await ctx.database.create('user', { authority: 1 })).id
  await ctx.database.create('monetary', { uid: u1, currency: 'coin', value: 5000 })
  await ctx.database.create('monetary', { uid: u2, currency: 'coin', value: 0 })
  console.log(`用户准备完成: u1=${u1}(现金5000), u2=${u2}(现金0)\n`)

  // ---- A. creditDemand ----
  const rA = await bankApi.creditDemand(u1, 'coin', 1000)
  assert(rA.success === true, 'A1 creditDemand 成功')
  let bal = await bankApi.getBalance(u1, 'coin')
  assert(bal.demand === 1000 && bal.availableDemand === 1000, `A2 creditDemand 后活期=1000 (实际 ${bal.demand})`)

  const rA2 = await bankApi.creditDemand(u1, 'coin', 0)
  assert(rA2.success === false, 'A3 creditDemand 金额 0 被拒绝')

  // ---- B. debitDemand ----
  const rB = await bankApi.debitDemand(u1, 'coin', 300)
  assert(rB.success === true, 'B1 debitDemand 成功')
  bal = await bankApi.getBalance(u1, 'coin')
  assert(bal.demand === 700, `B2 debitDemand 后活期=700 (实际 ${bal.demand})`)

  const rB2 = await bankApi.debitDemand(u1, 'coin', 99999)
  assert(rB2.success === false && /不足/.test(rB2.error || ''), 'B3 debitDemand 余额不足被拦截')

  // ---- C. freeze（活期，不可结息）----
  const rC = await bankApi.freeze(u1, 'coin', 200, 'demand', { duration: 3600, accrual: false, reason: '测试在途冻结' })
  assert(rC.success === true && rC.freezeId! > 0, 'C1 freeze(活期) 成功并返回 freezeId')
  const freezeId1 = rC.freezeId!
  const frozen = await bankApi.getFrozenBalance(u1, 'coin')
  assert(frozen.demand === 200 && frozen.total === 200 && frozen.fixed === 0, `C2 getFrozenBalance demand=200 (实际 demand=${frozen.demand}, total=${frozen.total})`)
  bal = await bankApi.getBalance(u1, 'coin')
  assert(bal.availableDemand === 500 && bal.frozen.demandNonAccrual === 200, `C3 冻结后可用=500 且计入不可结息 (实际 available=${bal.availableDemand})`)
  assert(frozen.records.every((r: any) => r.senderUid === null || r.senderUid === undefined), 'C4 API 冻结的 senderUid 为空（非转账来源）')

  const rC2 = await bankApi.freeze(u1, 'coin', 99999, 'demand', {})
  assert(rC2.success === false && /不足/.test(rC2.error || ''), 'C5 freeze 超出可用额度被拦截')

  // ---- B4. 冻结期间 debitDemand 按可用额度拦截 ----
  const rB4 = await bankApi.debitDemand(u1, 'coin', 600)
  assert(rB4.success === false, `B4 冻结期间 debitDemand 600 > 可用 500 被拦截`)

  // ---- D. unfreeze ----
  const rD = await bankApi.unfreeze(freezeId1)
  assert(rD.success === true, 'D1 unfreeze 成功')
  const frozen2 = await bankApi.getFrozenBalance(u1, 'coin')
  assert(frozen2.total === 0, `D2 解冻后冻结总额=0 (实际 ${frozen2.total})`)
  const rD2 = await bankApi.unfreeze(freezeId1)
  assert(rD2.success === false && /状态/.test(rD2.error || ''), 'D3 重复 unfreeze 被拒绝')

  // ---- E. 固定定期 + freeze(fixed) + forfeitFixedFreeze ----
  const fixedRec = await ctx.database.create('monetary_bank_int', {
    uid: u1,
    currency: 'coin',
    amount: 500,
    type: 'fixed',
    rate: 4.35,
    cycle: 'week',
    settlementDate: new Date(Date.now() + 7 * 86400 * 1000),
    extendRequested: false
  })
  const rE1 = await bankApi.freeze(u1, 'coin', 300, 'fixed', { sourceRecordId: fixedRec.id, accrual: true, reason: '质押担保' })
  assert(rE1.success === true, 'E1 freeze(定期, 指定源记录) 成功')
  const freezeId2 = rE1.freezeId!
  bal = await bankApi.getBalance(u1, 'coin')
  assert(bal.frozen.fixed === 300 && bal.availableFixed === 200, `E2 定期冻结后 availableFixed=200 (实际 ${bal.availableFixed})`)

  const rE2a = await bankApi.freeze(u1, 'coin', 100, 'demand', { duration: 3600, reason: '待 forfeit 的活期冻结' })
  assert(rE2a.success === true, 'E3-prep 新建一笔活期冻结用于 forfeit 拒绝测试')
  const rE2 = await bankApi.forfeitFixedFreeze(rE2a.freezeId!, '非定期记录')
  assert(rE2.success === false && /非定期/.test(rE2.error || ''), 'E3 对活期冻结执行 forfeit 被拒绝')

  const rE3 = await bankApi.forfeitFixedFreeze(freezeId2, '违约测试')
  assert(rE3.success === true, 'E4 forfeitFixedFreeze 成功')
  const [fixedAfter] = await ctx.database.get('monetary_bank_int', { id: fixedRec.id })
  assert(fixedAfter && fixedAfter.amount === 200, `E5 违约后定期本金 500-300=200 (实际 ${fixedAfter ? fixedAfter.amount : '记录被删'})`)
  const [freezeAfter] = await ctx.database.get('monetary_bank_freeze', { id: freezeId2 })
  assert(freezeAfter.status === 'forfeited', `E6 冻结记录状态=forfeited (实际 ${freezeAfter.status})`)
  const frozen3 = await bankApi.getFrozenBalance(u1, 'coin')
  assert(frozen3.fixed === 0, `E7 违约后不再计入冻结 (实际 fixed=${frozen3.fixed})`)

  // ---- F. transfer API：入参覆盖全局费率 + 冻结 + senderUid ----
  const rF = await bankApi.transfer(u1, u2, 'coin', 100, {
    feeRate: 5, feeFixed: 0, minFee: 0, maxFee: 0,
    freeze: true, freezeDuration: 3600, reason: 'API转账测试'
  })
  assert(rF.success === true, 'F1 transfer API 成功')
  assert(rF.fee === 5, `F2 入参 feeRate 5% 覆盖全局配置: fee=5 (实际 ${rF.fee})`)
  bal = await bankApi.getBalance(u1, 'coin')
  assert(bal.demand === 595, `F3 付款方活期 700-105=595 (实际 ${bal.demand})`)
  const balU2 = await bankApi.getBalance(u2, 'coin')
  assert(balU2.demand === 100 && balU2.availableDemand === 0 && balU2.frozen.demandNonAccrual === 100, `F4 收款方到账 100 且全部冻结不可用 (实际 demand=${balU2.demand}, available=${balU2.availableDemand})`)
  const [apiFreezeRec] = await ctx.database.get('monetary_bank_freeze', { uid: u2, status: 'frozen' })
  assert(apiFreezeRec && apiFreezeRec.senderUid === u1 && apiFreezeRec.sourceRecordId === null, `F5 转账冻结记录 senderUid=${u1} 且 sourceRecordId=null`)
  assert(apiFreezeRec.unfreezeAt && new Date(apiFreezeRec.unfreezeAt).getTime() - Date.now() > 3500 * 1000, 'F6 转账冻结时长≈3600 秒')

  // ---- G. transfer API：内扣 ----
  const rG = await bankApi.transfer(u1, u2, 'coin', 100, { innerFee: true, feeRate: 10, feeFixed: 0, minFee: 0, maxFee: 0 })
  assert(rG.success === true && rG.netAmount === 90, `G1 内扣: fee=10, 实到 90 (实际 net=${rG.netAmount})`)
  const balU2b = await bankApi.getBalance(u2, 'coin')
  assert(balU2b.demand === 190, `G2 收款方累计 100+90=190 (实际 ${balU2b.demand})`)
  assert(rG.newPayerBalance!.demand === 495, `G3 内扣只扣 100: 付款方 595-100=495 (实际 ${rG.newPayerBalance!.demand})`)

  // ---- H. transfer API：现金支付 ----
  const rH = await bankApi.transfer(u1, u2, 'coin', 50, { fromCash: true, feeRate: 10, feeFixed: 0, minFee: 0, maxFee: 0 })
  assert(rH.success === true && rH.newPayerCash === 4945, `H1 现金支付: 现金 5000-55=4945 (实际 ${rH.newPayerCash})`)
  const balU2c = await bankApi.getBalance(u2, 'coin')
  assert(balU2c.demand === 240, `H2 现金转账到收款方活期: 190+50=240 (实际 ${balU2c.demand})`)

  // ---- I. transfer API：异常路径 ----
  const rI1 = await bankApi.transfer(u1, u1, 'coin', 10)
  assert(rI1.success === false && /自己/.test(rI1.error || ''), 'I1 不能向自己转账')
  const rI2 = await bankApi.transfer(u1, u2, 'coin', 0)
  assert(rI2.success === false, 'I2 金额 0 被拒绝')
  const rI3 = await bankApi.transfer(u1, u2, 'coin', 100000, { fromCash: true, feeRate: 0, feeFixed: 0, minFee: 0 })
  assert(rI3.success === false && /不足/.test(rI3.error || ''), 'I3 现金不足被拦截')
  const rI4 = await bankApi.transfer(u1, u2, 'coin', 99999)
  assert(rI4.success === false && /不足/.test(rI4.error || ''), 'I4 活期可用不足被拦截')

  // ---- J. getBalance 结构完整性 ----
  bal = await bankApi.getBalance(u1, 'coin')
  assert(
    typeof bal.total === 'number' && typeof bal.demand === 'number' && typeof bal.fixed === 'number'
    && typeof bal.availableDemand === 'number' && typeof bal.availableFixed === 'number'
    && bal.frozen && typeof bal.frozen.demandAccrual === 'number' && typeof bal.frozen.demandNonAccrual === 'number',
    'J1 getBalance 返回结构完整（含 frozen 细分）'
  )

  console.log('\n==================================================')
  console.log('🎉 全部 API 测试通过')
  console.log('==================================================')
  await app.stop()
  process.exit(0)
}

runAllTests().catch((err) => {
  console.error('\n💥 测试失败:', err.message)
  process.exit(1)
})
