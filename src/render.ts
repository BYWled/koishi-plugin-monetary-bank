import { Context, h } from 'koishi'
import type { Config } from './index'
import type { BankBalance } from './types'
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
} from './templates'
import type { HelpCommandItem } from './templates'
import { logger } from './utils/log'
import { formatDurationText, formatShortUnfreezeTime } from './utils/format'

export function getTheme(config: Config): boolean {
  if (config.themeMode === 'light') return false
  if (config.themeMode === 'dark') return true
  
  // auto mode: 18:00 - 6:00 is dark
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6
}

export function generateDepositConfirmMessage(amount: number, currency: string, cash: number): string {
  return `您将存入 ${amount} ${currency} 到银行，当前现金：${cash} ${currency}。\n确认操作请回复 yes 或 y，取消请回复其他内容。`
}

export function generateWithdrawConfirmMessage(amount: number, currency: string, availableBalance: number): string {
  return `您将从银行取出 ${amount} ${currency}，当前可用活期：${availableBalance} ${currency}。\n确认操作请回复 yes 或 y，取消请回复其他内容。`
}

export function generateTransferConfirmText(
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
 * 渲染工厂：持有 ctx/config 闭包，产出全部页面渲染函数与文本降级
 */
export function createRender(ctx: Context, config: Config) {
    /**
   * 通用图片渲染函数
   */
  async function renderToImage(html: string, fallbackText: string) {
    if (!ctx.puppeteer) {
      return fallbackText
    }

    let page: any = null
    try {
      page = await ctx.puppeteer.page()
      // 设置渲染超时，避免 networkidle0 因外部资源不 settle 导致永久挂起
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 })
      const element = await page.$('.container')
      const screenshot = await element.screenshot({ type: 'png' })
      return h.image(screenshot, 'image/png')
    } catch (error) {
      logger.error('图形渲染失败:', error)
      return fallbackText
    } finally {
      // 无论成功失败都关闭页面，防止渲染异常导致页面泄漏、后续渲染挂死
      if (page) {
        try { await page.close() } catch (e) {}
      }
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

  return {
    renderToImage,
    renderBankHomePage,
    renderBankHelpPage,
    renderTransferConfirmPage,
    renderTransferSuccessImage,
    renderTransferFailedPage,
    renderDepositConfirmPage,
    renderWithdrawConfirmPage,
    renderBankBalanceImage,
    renderDepositSuccessImage,
    renderWithdrawSuccessImage,
    renderFixedDepositListImage,
    renderFixedPlanSelectionPage,
    renderFixedDepositSuccessImage,
    renderExtensionPlanSelectionPage,
    renderCancelExtensionPage,
    renderExtensionSuccessPage,
  }
}

export type BankRender = ReturnType<typeof createRender>
