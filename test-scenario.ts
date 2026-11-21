import { App, Bot } from 'koishi'
import * as sqlite from '@koishijs/plugin-database-sqlite'
import monetaryPlugin from 'koishi-plugin-monetary'
import * as bankPlugin from './src/index'
import {
  getBaseTemplate,
  renderHeader,
  renderBalanceCard,
  renderGridItem,
  renderPromptBox,
  renderHelpList,
  renderConfirmDialog,
  renderInfoRow,
  formatAmount
} from './src/templates'
import fs from 'fs'
import path from 'path'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  } else {
    console.log(`✅ ${message}`)
  }
}

async function runAllTests() {
  console.log('==================================================')
  console.log('🚀 启动 Koishi 沙盒环境并进行全功能/全场景测试')
  console.log('==================================================\n')

  const app = new App()

  // 1. 加载内存数据库
  const sqlitePlugin = (sqlite as any).default || sqlite
  app.plugin(sqlitePlugin, { path: ':memory:' })
  // 2. 加载货币服务
  const monPlugin = (monetaryPlugin as any).default || monetaryPlugin
  app.plugin(monPlugin)

  // 3. 加载测试 Bot
  const sentMessages: string[] = []
  class MockBot extends Bot {
    constructor(ctx: any) {
      super(ctx, {}, 'onebot')
      this.selfId = 'testbot'
      this.adapter = { bots: [this] } as any
    }
    async sendMessage(channelId: string, content: any) {
      const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => c.attrs?.content || c.toString()).join('') : content.toString())
      sentMessages.push(text)
      return ['msg-1']
    }
  }
  // @ts-ignore
  MockBot.MessageEncoder = class {
    constructor() {}
    async flush() {}
    async send(content: any) {
      const text = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(c => c.attrs?.content || c.toString()).join('') : content.toString())
      sentMessages.push(text)
      return ['msg-1']
    }
  }
  app.plugin(MockBot)

  // 4. 加载升级后的银行插件
  app.plugin(bankPlugin, {
    defaultCurrency: 'coin',
    enableInterest: true,
    transfer: {
      enabled: true,
      allowCash: true,
      fee: { rate: 2, fixed: 5, minFee: 5, maxFee: 100 }, // 2% + 5 手续费
      creditCheck: { enabled: true, minPayerScore: 60, minPayeeScore: 0 },
      freeze: {
        autoFreeze: false,
        accrual: false,
        durationMode: 'fixed',
        fixedSeconds: 3600
      }
    },
    header: {
      showAvatar: true,
      showUsername: true,
      bankTitle: 'CENTRAL RESERVE BANK',
      showTime: true
    }
  })

  await app.start()
  console.log('🎉 Koishi 实例启动完成，数据表初始化成功！\n')

  const api = app.monetaryBank
  assert(!!api, 'MonetaryBankAPI 成功注入 Context')

  // 初始化用户测试数据
  const user1 = await app.database.create('user', { authority: 1 })
  const user2 = await app.database.create('user', { authority: 1 })
  const uid1 = user1.id
  const uid2 = user2.id
  const currency = 'coin'

  console.log(`\n--- 场景 1: 基础存取款与现金联动 ---`)
  // 给 user1 充值 1000 现金
  await app.monetary.gain(uid1, 1000, currency)
  const initialBal1 = await api.getBalance(uid1, currency)
  assert(initialBal1.total === 0, '初始银行总存款为 0')
  assert(initialBal1.availableDemand === 0, '初始可用活期为 0')

  // 存入 600 现金到银行活期
  const depRes = await api.deposit(uid1, currency, 600)
  assert(depRes.success === true, '存款 600 成功')
  assert(depRes.newCash === 400, '现金扣除为 400')
  assert(depRes.newBalance?.demand === 600, '活期存款更新为 600')
  assert(depRes.newBalance?.availableDemand === 600, '可用活期为 600')

  // 从银行活期取出 100
  const witRes = await api.withdraw(uid1, currency, 100)
  assert(witRes.success === true, '取款 100 成功')
  assert(witRes.newCash === 500, '现金恢复为 500')
  assert(witRes.newBalance?.demand === 500, '活期存款更新为 500')

  console.log(`\n--- 场景 2: API 直接打款与扣款（仅活期） ---`)
  // 直接打款 300 到 user1 活期（不扣现金）
  const credRes = await api.creditDemand(uid1, currency, 300, { reason: '系统活动奖励' })
  assert(credRes.success === true, 'API 打款 300 成功')
  assert(credRes.newBalance?.demand === 800, '打款后活期存款为 800')

  // 直接扣除 200 活期存款（不进现金）
  const debRes = await api.debitDemand(uid1, currency, 200, { reason: '服务费扣减' })
  assert(debRes.success === true, 'API 扣款 200 成功')
  assert(debRes.newBalance?.demand === 600, '扣款后活期存款为 600')

  console.log(`\n--- 场景 3: 资金冻结与解冻机制 ---`)
  // user1 当前活期 600，冻结 250（不可结息类型）
  const freezeRes1 = await api.freeze(uid1, currency, 250, 'demand', {
    accrual: false,
    reason: '交易在途冻结'
  })
  assert(freezeRes1.success === true && !!freezeRes1.freezeId, '冻结活期 250 成功')
  const balAfterFreeze = await api.getBalance(uid1, currency)
  assert(balAfterFreeze.demand === 600, '冻结后活期总存款仍为 600（资金仍在户内）')
  assert(balAfterFreeze.availableDemand === 350, '可用活期计算正确：600 - 250 = 350')
  assert(balAfterFreeze.frozen.demand === 250, '已冻结金额记录为 250')
  assert(balAfterFreeze.frozen.demandNonAccrual === 250, '不可结息冻结为 250')

  // 测试冻结资金拦截消费/取款：尝试取款 400（可用仅 350）
  const overWithdraw = await api.withdraw(uid1, currency, 400)
  assert(overWithdraw.success === false, '取款 400 被系统拦截（可用活期不足）')

  // 解冻 250
  const unfreezeRes = await api.unfreeze(freezeRes1.freezeId!)
  assert(unfreezeRes.success === true, '手动解冻成功')
  const balAfterUnfreeze = await api.getBalance(uid1, currency)
  assert(balAfterUnfreeze.availableDemand === 600, '解冻后可用活期恢复为 600')

  console.log(`\n--- 场景 4: 定期存款抵押与意外处置（没收抵债） ---`)
  // 为 user1 创建一条定期存款记录（存入 1000 定期）
  const now = new Date()
  const fixedRecord = await app.database.create('monetary_bank_int', {
    uid: uid1,
    currency,
    amount: 1000,
    type: 'fixed',
    rate: 10,
    cycle: 'month',
    settlementDate: new Date(now.getTime() + 30 * 86400 * 1000),
    extendRequested: false
  })
  const balWithFixed = await api.getBalance(uid1, currency)
  assert(balWithFixed.fixed === 1000, '定期本金 1000 录入成功')

  // 冻结该笔定期作为借贷担保/抵押金（可结息类型）
  const freezeFixedRes = await api.freeze(uid1, currency, 1000, 'fixed', {
    accrual: true,
    sourceRecordId: fixedRecord.id,
    reason: '贷款抵押担保金'
  })
  assert(freezeFixedRes.success === true, '定期抵押冻结成功（可结息模式）')
  const balFixedFrozen = await api.getBalance(uid1, currency)
  assert(balFixedFrozen.availableFixed === 0, '可用定期降为 0')
  assert(balFixedFrozen.frozen.fixed === 1000, '冻结定期记录为 1000')

  // 模拟意外情况：发生借贷违约抵债，定期未满期利息作废并没收
  const forfeitRes = await api.forfeitFixedFreeze(freezeFixedRes.freezeId!, { reason: '债务清偿没收' })
  assert(forfeitRes.success === true, '定期抵债没收接口执行成功')
  const balAfterForfeit = await api.getBalance(uid1, currency)
  assert(balAfterForfeit.fixed === 0, '定期本金已被扣除抵债（未结算利息作废）')
  assert(balAfterForfeit.frozen.fixed === 0, '定期冻结记录已核销')

  console.log(`\n--- 场景 5: 转账功能全场景验证 ---`)
  // 5.1 默认外扣手续费转账：user1 (活期 600) 向 user2 转账 100
  // 手续费配置为 2% + 5 = 2 + 5 = 7
  // 外扣模式：user1 扣除 100 + 7 = 107，user2 实到 100
  const tr1 = await api.transfer(uid1, uid2, currency, 100)
  assert(tr1.success === true, '外扣转账 100 执行成功')
  assert(tr1.fee === 7, '手续费计算正确：100 * 2% + 5 = 7')
  assert(tr1.netAmount === 100, '收款方实到金额为 100')
  assert(tr1.newPayerBalance?.demand === 493, '付款方活期扣除 107：600 - 107 = 493')
  assert(tr1.newPayeeBalance?.demand === 100, '收款方活期到账 100')

  // 5.2 内扣手续费转账：user1 向 user2 转账 100，指定 innerFee=true
  // 内扣模式：user1 扣除 100，手续费 7，user2 实到 100 - 7 = 93
  const tr2 = await api.transfer(uid1, uid2, currency, 100, { innerFee: true })
  assert(tr2.success === true, '内扣转账 100 执行成功')
  assert(tr2.innerFee === true, '正确标记内扣模式')
  assert(tr2.netAmount === 93, '收款方实到金额内扣为 93')
  assert(tr2.newPayerBalance?.demand === 393, '付款方扣款 100：493 - 100 = 393')
  assert(tr2.newPayeeBalance?.demand === 193, '收款方活期总计 100 + 93 = 193')

  // 5.3 指定现金支付转账：fromCash=true
  // user1 当前现金 500，转账 200，外扣手续费 200 * 2% + 5 = 9，共需现金 209
  const tr3 = await api.transfer(uid1, uid2, currency, 200, { fromCash: true })
  assert(tr3.success === true, '现金支付转账成功')
  assert(tr3.fromCash === true, '正确标记为现金支付')
  assert(tr3.newPayerCash === 291, '现金扣除 209：500 - 209 = 291')
  assert(tr3.newPayeeBalance?.demand === 393, '收款方到账为银行活期账户：193 + 200 = 393')

  // 5.4 转账自动冻结测试：freeze=true，冻结时长 3600 秒
  const tr4 = await api.transfer(uid1, uid2, currency, 50, { freeze: true, freezeDuration: 3600 })
  assert(tr4.success === true && tr4.frozen === true, '转账并自动冻结成功')
  assert(!!tr4.unfreezeAt, '正确生成解冻时间戳')
  const payeeBalAfterFrozenTransfer = await api.getBalance(uid2, currency)
  assert(payeeBalAfterFrozenTransfer.frozen.demand === 50, '收款方活期冻结增加 50')
  assert(payeeBalAfterFrozenTransfer.availableDemand === 393, '收款方可用活期不包含冻结的 50')

  // 5.5 到期自动解冻验证（模拟时间流逝）
  // 插入一条 10 秒前已过期的冻结记录
  await app.database.create('monetary_bank_freeze', {
    uid: uid2,
    currency,
    amount: 30,
    sourceType: 'demand',
    sourceRecordId: null,
    accrual: false,
    reason: '历史冻结',
    frozenAt: new Date(Date.now() - 60000),
    unfreezeAt: new Date(Date.now() - 10000),
    status: 'frozen'
  })
  // 查询余额时应自动触发惰性解冻
  const balLazyUnfreeze = await api.getBalance(uid2, currency)
  const expiredFreeze = await app.database.get('monetary_bank_freeze', { uid: uid2, reason: '历史冻结' })
  assert(expiredFreeze[0].status === 'unfrozen', '过期冻结资金被自动解冻更新为 unfrozen')

  console.log(`\n--- 场景 6: HTML 模板、排版及新页头验证 ---`)
  // 6.1 验证新页头（标题左侧，用户名与头像右侧）
  const headerHtml1 = renderHeader('bank', '银行首页', '测试用户', 'https://q1.qlogo.cn/g?b=qq&nk=123456&s=100', {
    showAvatar: true,
    showUsername: true,
    bankTitle: 'CENTRAL BANK',
    showTime: true
  })
  assert(headerHtml1.includes('header-left'), '页头包含左侧容器 .header-left')
  assert(headerHtml1.includes('header-right'), '页头包含右侧容器 .header-right')
  assert(headerHtml1.includes('user-avatar-img'), '页头成功渲染用户头像 <img>')
  assert(headerHtml1.includes('CENTRAL BANK'), '页头成功渲染自定义副标题')

  // 6.2 验证无头像时优雅回退为首字母字母头像
  const headerHtml2 = renderHeader('bank', '银行首页', 'Alice', undefined, { showAvatar: true, showUsername: true })
  assert(headerHtml2.includes('user-avatar-text') && headerHtml2.includes('A'), '无头像 URL 时自动回退首字母头像徽标')

  // 6.3 验证大字号功能列表 (bank.help)
  const helpListHtml = renderHelpList([
    {
      name: 'bank.transfer',
      syntax: 'bank.transfer <@用户> <金额>',
      desc: '支持转账与冻结机制的大字号卡片展示',
      options: '-m: 现金支付',
      category: '转账'
    }
  ])
  assert(helpListHtml.includes('help-card'), '生成大字号 .help-card 容器')
  assert(helpListHtml.includes('help-cmd-name'), '指令名包含大字号 class')
  assert(helpListHtml.includes('help-cmd-badge'), '包含分类 Badge')

  // 6.4 验证金额与超长排版缩写函数 formatAmount
  assert(formatAmount(12500000) === '1250万', 'formatAmount 默认对千万级数值自动缩写为万')
  assert(formatAmount(50000, { unit: 'en' }) === '50K', 'formatAmount 英文单位正确缩写为 50K')
  assert(formatAmount(1000, { unit: 'zh' }) === '1千', 'formatAmount 中文单位正确缩写为 1千')
  assert(formatAmount(850000000, { unit: 'zh' }) === '8.5亿', 'formatAmount 中文单位正确缩写为 8.5亿')

  // 6.5 组装完整页面 HTML 并输出样本以供检查（验证定期与活期同行、常态展示冻结与现金、统一样式与大字号）
  const samplePage = getBaseTemplate(`
    ${headerHtml1}
    ${renderBalanceCard('银行总资产', 99999, 'coin', '含钱包现金总计: 101,999 coin')}
    <div class="grid">
      ${renderGridItem('demand', '活期存款', 8000, '可用: 7,500 | 冻结: 500', 'demand')}
      ${renderGridItem('fixed', '定期资产', 10000, '可用: 10,000 | 享受定期利息', 'fixed')}
      ${renderGridItem('cash', '现金余额', 2000, '钱包可用现金', 'cash')}
      ${renderGridItem('clock', '冻结资金', 500, '活期 500 | 定期 0', 'frozen')}
    </div>
    ${renderPromptBox('💡 指令提示', '输入 bank.help 查看全部可用指令', 'info')}
    ${helpListHtml}
  `, 860, true)

  const outputDir = path.resolve(__dirname, 'test-artifacts')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const htmlPath = path.join(outputDir, 'sample_verified_page.html')
  fs.writeFileSync(htmlPath, samplePage, 'utf-8')
  console.log(`📄 已生成测试 HTML 样本至: ${htmlPath}`)

  assert(samplePage.includes('--card-bg'), '深色模式 CSS 变量正确注入')
  assert(samplePage.includes('grid-item frozen'), '包含新增的冻结资产网格样式 .grid-item.frozen')
  assert(samplePage.includes('balance-sublabel'), '包含总身家 sublabel 样式')
  assert(samplePage.includes('header-time'), '包含与用户名头像高度和圆角一致的时间徽章')

  // 6.6 验证窄屏与超窄屏自动响应隐藏机制（防重叠与自动收起）
  const sampleNarrowPage = getBaseTemplate(`
    ${headerHtml1}
    ${renderBalanceCard('存款金额', 500, 'coin')}
    ${renderPromptBox('温馨提示', '页面过窄时自动隐藏时间与副标题，用户名自动折叠为头像圆胶囊', 'info')}
  `, 520, true)
  assert(sampleNarrowPage.includes('is-narrow'), '520px 页面自动挂载 is-narrow 标志')
  assert(sampleNarrowPage.includes('is-compact'), '520px 页面自动挂载 is-compact 标志')
  assert(sampleNarrowPage.includes('page-container'), '容器正确声明 inline-size container-name')
  assert(sampleNarrowPage.includes('.is-compact .user-capsule'), '包含窄屏用户名收起为单头像样式规则')

  const narrowHtmlPath = path.join(outputDir, 'sample_narrow_page.html')
  fs.writeFileSync(narrowHtmlPath, sampleNarrowPage, 'utf-8')
  console.log(`📄 已生成测试窄屏 HTML 样本至: ${narrowHtmlPath}`)

  console.log(`\n--- 场景 7: 指令层（交互/降级/自动建档）全功能沙盒验证 ---`)
  // 绑定 user1 到平台账号 '111111'
  await app.database.create('binding', {
    aid: uid1,
    platform: 'onebot',
    pid: '111111'
  })
  // 绑定 user2 到平台账号 '222222'
  await app.database.create('binding', {
    aid: uid2,
    platform: 'onebot',
    pid: '222222'
  })

  const bot = app.bots[0]
  function createSession(pid: string, aid: number, name: string) {
    return bot.session({
      type: 'message',
      isDirect: true,
      channel: { id: `private:${pid}`, type: 1 },
      user: { id: pid, name }
    })
  }

  function getLastSentText(): string {
    const last = sentMessages[sentMessages.length - 1]
    if (!last) return ''
    if (typeof last === 'string') return last
    return String(last)
  }

  const session1 = createSession('111111', uid1, 'UserOne')

  // 7.1 测试 bank 命令 (首页：无指令列表，包含小字提示)
  sentMessages.length = 0
  const execRes = await session1.execute('bank')
  console.log('DEBUG: execRes =', execRes, 'sentMessages =', sentMessages)
  const bankHomeOutput = getLastSentText()
  assert(bankHomeOutput.includes('【银行服务中心】'), 'bank 指令返回文本降级首页')
  assert(bankHomeOutput.includes('bank.help'), 'bank 首页包含 bank.help 小字引导')
  assert(!bankHomeOutput.includes('可用命令：\nbank.bal'), 'bank 首页已彻底剥离原指令列表')

  // 7.2 测试 bank.help 命令 (大字号功能清单)
  sentMessages.length = 0
  await session1.execute('bank.help')
  const bankHelpOutput = getLastSentText()
  assert(bankHelpOutput.includes('【银行功能指令列表】'), 'bank.help 指令成功返回功能清单')
  assert(bankHelpOutput.includes('bank.transfer'), '清单包含 bank.transfer 说明')

  // 7.3 测试 bank.transfer 指令向已有用户 @222222 转账 (带 -y)
  sentMessages.length = 0
  await session1.execute('bank.transfer <at id="222222"/> 50 -y')
  const transferOutput = getLastSentText()
  assert(transferOutput.includes('转账成功'), 'bank.transfer @222222 指令执行成功')
  assert(transferOutput.includes('对方实到：50 coin'), '转账结果展示收款实到 50')

  // 7.3.1 验证转账冻结提示文案极简格式与双方银行首页展示
  const session2 = createSession('222222', uid2, 'UserTwo')
  sentMessages.length = 0
  await session2.execute('bank')
  const bankHome2Output = getLastSentText()
  assert(bankHome2Output.includes('冻结资金：50 coin'), '收款方 (User2) 输入 bank 首页正常显示冻结资金 50')

  sentMessages.length = 0
  await session1.execute('bank')
  const bankHome1Output = getLastSentText()
  assert(bankHome1Output.includes('转出在途冻结：50 coin'), '付款方 (User1) 输入 bank 首页副标题正常展示转出在途冻结 50 coin')

  // 7.4 测试 bank.transfer 向从未见过的全新 QQ 号 (999888777) 转账 (自动建档验证)
  sentMessages.length = 0
  await session1.execute('bank.transfer 999888777 30 -y')
  const transferNewUserOutput = getLastSentText()
  assert(transferNewUserOutput.includes('转账成功'), '向未知用户转账指令执行成功')
  const newBinding = await app.database.get('binding', { pid: '999888777' })
  assert(newBinding.length > 0, '系统成功为未知收款人自动创建了账号建档 (binding + user)')
  const newPayeeBal = await api.getBalance(newBinding[0].aid, currency)
  assert(newPayeeBal.demand === 30, '新建档用户的银行账户成功收到了 30 存款')

  console.log('\n==================================================')
  console.log('✅ 所有测试场景 100% 验证通过！无任何逻辑与渲染异常！')
  console.log('==================================================')

  process.exit(0)
}

runAllTests().catch((err) => {
  console.error('测试运行异常终止:', err)
  process.exit(1)
})
