<h1 align="center">koishi-plugin-monetary-bank</h1>

<p align="center">
  为 monetary 插件（或外部项目中的主货币表）提供轻量级银行功能，支持活期/定期存款与利息结算。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/koishi-plugin-monetary-bank"><img src="https://img.shields.io/npm/v/koishi-plugin-monetary-bank?style=for-the-badge&logo=npm" alt="npm" /></a>
  <a href="https://github.com/BYWled/koishi-plugin-monetary-bank"><img src="https://img.shields.io/github/stars/BYWled/koishi-plugin-monetary-bank?style=for-the-badge&logo=github" alt="GitHub Stars" /></a>
</p>

<p align="center">
  <a href="https://gitee.com/BYWled/koishi-plugin-monetary-bank"><img src="https://img.shields.io/badge/Gitee-代码镜像-C71D23?style=for-the-badge&logo=gitee&logoColor=white" alt="Gitee Mirror" /></a>
</p>

<p align="center">
  <a href="https://github.com/BYWled/koishi-plugin-monetary-bank">GitHub</a> ·
  <a href="https://gitee.com/BYWled/koishi-plugin-monetary-bank">Gitee</a>
</p>

> 版本：**2.3.0-Alpha.1**

## ✨ 特点

- **多模式交互**: 支持精美的图形化界面，同时也完全兼容纯文本操作。
- **完整银行功能**: 支持活期存款、定期存款、取款、余额查询与用户间转账。
- **转账系统**: 支持 `@用户`/平台号/数字 ID 定位收款人（未开户自动建档），手续费费率/固定/保底/封顶可配置，内扣/外扣/现金支付可选，收款昵称自动解析。
- **资金冻结机制**: 转账到账自动冻结（固定/按金额阶梯时长），区分可结息与不可结息冻结，惰性到期自动解冻；付款方首页可见"转出在途冻结"。
- **利息系统**: 支持活期/定期利息结算，可配置结算周期（日/周/月）；不可结息冻结按比例折算利息。
- **定期管理**: 支持定期存款的自动转存、延期续期管理。
- **开放 API**: 暴露 `monetaryBank` 服务 7+ 接口（打款/扣款/冻结/解冻/抵债/冻结查询/转账）供其他插件调用。
- **高兼容性**: 兼容 `monetary` 表的多种字段命名（`uid`/`id`, `value`/`balance` 等）。

## 📦 安装与依赖

### 基础依赖
- **必需**: `database` 服务（需在 Koishi 中配置数据库插件）。
- **数据库表**: 
  - `monetary_bank_int`: 记录银行存款（活期/定期）。
  - `monetary` (或配置的表名): 用户主货币表。

### 图形化依赖（可选）
要启用图形化界面，请安装 `puppeteer` 插件：

```bash
# 在 Koishi 插件市场搜索安装
puppeteer
```

若未安装 puppeteer，插件将自动以**纯文本模式**运行，功能不受影响。

### ⚠️ 重要提示：热重载与服务注册

本插件使用 `ctx.provide()` 注册 `monetaryBank` 服务供其他插件调用。为了支持热重载（配置修改后自动重启），插件内部已实现**服务注册检测机制**：

- ✅ **正常情况**: 插件会检测服务是否已注册，避免重复注册。
- ⚠️ **可能的报错**: 在某些 Koishi 环境下，热重载时可能仍会出现以下警告：
  ```
  service monetaryBank has been registered
  ```
  或
  ```
  property monetaryBank is not registered
  ```

**解决方案**：
1. **忽略警告**: 这些警告也许不影响插件正常使用，仅为服务注册的重复检测提示。
2. **重启 Koishi**: 如果遇到功能异常，完全重启 Koishi 进程即可解决。
3. **避免频繁热重载**: 尽量在配置完成后再启用插件，减少热重载次数。

**技术说明**: 插件已实现 `ctx.registry` 检测 + `try/catch` 防护，但不同版本的 Koishi 对服务注册的处理机制可能存在差异，导致警告仍可能出现。这不会影响插件核心功能的稳定性。

## ⚙️ 配置说明

在 Koishi 插件配置中：

```yaml
plugins:
  'monetary-bank':
    defaultCurrency: 'coin'    # 默认货币
    debug: true                # 输出调试日志
    enableInterest: true       # 启用利息与定期功能
    
    # 活期利息配置
    demandInterest:
      enabled: true
      rate: 0.25               # 利率 (%)
      cycle: 'day'             # 结算周期: day/week/month
      
    # 定期方案列表
    fixedInterest:
      - name: '周定期'
        rate: 4.35
        cycle: 'week'
      - name: '月定期'
        rate: 50.0
        cycle: 'month'

    # 页头展示
    header:
      showAvatar: true          # 用户头像胶囊
      showUsername: true
      bankTitle: 'MONETARY BANK'
      showTime: false           # 时间徽章

    # 主题：auto（随时间）/ light / dark
    themeMode: 'auto'

    # 转账业务
    transfer:
      enabled: true
      allowCash: true
      fee:
        rate: 10                # 费率 (%)
        fixed: 1                # 固定手续费
        minFee: 1               # 保底
        maxFee: 0               # 封顶（0 不封顶）
      creditCheck:
        enabled: false          # 信用分校验（占位机制，需 monetaryCredit 服务）
        minPayerScore: 60
        minPayeeScore: 0
      freeze:
        autoFreeze: true        # 到账自动冻结
        accrual: false          # 冻结资金可否结息
        durationMode: 'fixed'   # fixed=固定 / tiered=按金额阶梯
        fixedSeconds: 60
        tieredRules:            # [{ threshold, seconds }] 降序匹配
          - threshold: 5000
            seconds: 7200

    # 数字与金额排版缩写（仅图形化）
    numberFormat:
      unit: 'auto'              # auto/zh/en/none
      threshold: 10000000
      precision: 2
```

## 🎮 命令与功能

本插件提供了一套完整的银行指令。当 puppeteer 可用时，这些命令将展示精美的图形化界面。

### 🏠 银行首页 `bank`
- **功能**: 查看账户总览（活期/定期/现金/冻结四卡片 + 银行总资产大卡）。
- **图形化**: 深浅主题自适应页头（机构名/时间徽章/用户胶囊可配置），冻结卡片展示"转出在途冻结"明细。
- **文本模式**: 显示简单的账户余额和帮助信息。

### 💰 余额查询 `bank.bal`
- **选项**: `-c <currency>` 指定货币。
- **图形化**: 大标题展示总资产，网格布局展示活期/定期占比及百分比可视化。

### 📥 存款 `bank.in <amount>`
- **参数**: `amount` (金额或 `all`)。
- **选项**: `-c <currency>` 指定货币，`-y` 跳过确认。
- **流程**: 
  1. 输入金额。
  2. **确认页面**（图形化）：显示存款前后余额对比、温馨提示。
  3. **成功页面**（图形化）：展示存入金额、最新资产分布。

### 📤 取款 `bank.out <amount>`
- **参数**: `amount` (金额或 `all`)。
- **选项**: `-c <currency>` 指定货币，`-y` 跳过确认。
- **流程**:
  1. 输入金额（仅限提取活期余额）。
  2. **确认页面**（图形化）：显示取款金额、剩余活期预览。
  3. **成功页面**（图形化）：展示取出金额、现金/银行余额对比。

### 🔒 定期存款 `bank.fixed`
- **功能**: 申请定期存款。
- **图形化**: 
  - **方案选择页**: 列表展示所有定期方案（利率/周期），显示当前可用资金（现金+活期）。
  - **确认页**: 确认存款金额与方案详情。

### 📋 定期管理 `bank.fixed.manage`
- **功能**: 查看和管理已有的定期存款。
- **图形化**: 列表式展示所有定期记录，包含到期时间、利率、延期状态标签。

### 💸 转账 `bank.transfer <target> [amount]`
- **别名**: `转账`。
- **参数**: `target` 支持 `@用户`、平台账号/QQ 号、数字 ID；未开户自动建档。
- **选项**: `-c` 指定货币；`-m, --cash` 现金支付（默认银行活期扣款）；`-i, --inner-fee` 手续费内扣（默认外扣）；`-y` 跳过确认。
- **机制**: 手续费（费率/固定/保底/封顶）与到账自动冻结（固定/阶梯时长）均可配置；数字 ID 转账同样显示收款人昵称。
- **信用分拦截**: 配置 `transfer.creditCheck` 后联动校验双方信用分（未接入信用分服务时恒为满分占位）。

### 📖 功能列表 `bank.help`
- **图形化**: 大字号指令卡片，列出全部银行指令的语法、参数与功能说明。

## 🎨 图形化系统设计

### 视觉风格 (v2.0.0+)
- **主题**: 轻盈渐变（#eef2f7 → #f5f7fb），现代卡片式布局，圆角设计。
- **色彩**: 
  - 主色调：紫蓝渐变（#5b7cfa → #7f5af0）用于关键信息展示。
  - 状态色：成功 #4ade80 / 信息 #60a5fa / 警告 #fbbf24。
- **交互**: 悬停效果、平滑过渡、清晰的视觉层级。
- **组件化**: 统一的头部、余额卡片、信息行、命令网格、提示框、确认对话框等可复用组件。
- **响应式**: 网格布局自适应（`repeat(auto-fit, minmax(210px, 1fr))`），支持不同内容宽度。

### 页面渲染 (`src/render.ts` + `src/templates/`)
页面由 `createRender(ctx, config)` 工厂统一产出（内含渲染超时与页面兜底关闭），HTML 组件位于 `src/templates/`：

```typescript
// 基础模板（全局样式 + 窄屏自适应降级）
getBaseTemplate(content: string, width?: number, isDark?: boolean): string

// 页面头部（图标 + 标题 + 时间徽章 + 用户信息胶囊）
renderHeader(icon: string, title: string, username: string, avatarUrl?: string, headerCfg?: HeaderConfig): string

// 余额大标题卡片
renderBalanceCard(label: string, value: number, currency: string, sub?: string, numOpt?: NumberFormatOptions): string

// 网格信息项（支持多种主题色）
renderGridItem(icon, title, value, subtitle, type, numOpt?): string

// 信息行（标签-值对）
renderInfoRow(label: string, value: string, valueClass?: ''|'success'|'error'|'highlight'): string

// 提示信息框 / 确认对话框 / 指令帮助列表
renderPromptBox(title, message, type?): string
renderConfirmDialog(title, items: Array<{label, value}>): string
renderHelpList(commands: HelpCommandItem[]): string

// 金额缩写（万/亿、K/M/B/T）
formatAmount(value: number, numOpt?: NumberFormatOptions): string

// 图标（内联 SVG，构建期由 assets/icons/*.svg 生成到 icons.generated.ts，
// 运行时零文件依赖；改图标后重跑 node tools/generate-icons.cjs）
renderIcon(icon: string, className: string, alt: string): string
```

### 降级策略
如果 puppeteer 不可用或渲染失败：
- ✅ 所有功能保持正常工作。
- ✅ 自动切换为纯文本输出。
- ✅ 交互逻辑保持一致。
- ✅ 用户体验无缝切换，无需额外配置。

## 🔌 API 接口

插件注册了 `ctx.monetaryBank` 服务，供其他插件调用：

```typescript
// 查询余额（含冻结细分：availableDemand/availableFixed/frozen.demandAccrual 等）
const balance = await ctx.monetaryBank.getBalance(uid, 'coin');

// 存款（现金 → 银行活期）
const res = await ctx.monetaryBank.deposit(uid, 'coin', 100);
// { success: true, newCash: 50, newBalance: { ... } }

// 取款（银行活期 → 现金；冻结资金不可取出）
const res2 = await ctx.monetaryBank.withdraw(uid, 'coin', 50);

// 直接打款/扣款（仅活期）
await ctx.monetaryBank.creditDemand(uid, 'coin', 500);
await ctx.monetaryBank.debitDemand(uid, 'coin', 200);

// 冻结/解冻/抵债处置（质押违约没收本金并作废利息）
const f = await ctx.monetaryBank.freeze(uid, 'coin', 300, 'fixed', { sourceRecordId, accrual: true });
await ctx.monetaryBank.unfreeze(f.freezeId);
await ctx.monetaryBank.forfeitFixedFreeze(f.freezeId, '违约原因');

// 冻结明细查询
const frozen = await ctx.monetaryBank.getFrozenBalance(uid, 'coin');
// { total, demand, fixed, records }

// 转账（支持外部插件自拟费率/内扣/现金来源/冻结规则，不影响全局配置）
const t = await ctx.monetaryBank.transfer(payerUid, payeeUid, 'coin', 100, {
  feeRate: 5, feeFixed: 0, minFee: 0, maxFee: 0,
  innerFee: false, fromCash: false,
  freeze: true, freezeDuration: 3600, reason: '业务转账',
});
```

## 📅 利息结算

若启用 `enableInterest`，插件会启动定时任务（每日0点）：
- 检查到期的定期存款。
- 根据用户设置（自动延期或转活期）进行处理。
- 结算活期利息（按配置周期）。
- 自动合并碎片化的活期记录以优化性能。

## 💻 开发扩展

### 扩展图形化页面
页面组合集中在 `src/render.ts` 的 `createRender` 工厂内，HTML 组件来自 `src/templates/`。新增页面请在工厂内添加渲染函数并挂入返回对象：

```typescript
import { renderHeader, renderBalanceCard, renderPromptBox, getBaseTemplate } from './templates';

// 在 createRender(ctx, config) 内新增渲染函数（自动获得 ctx/config 闭包与文本降级约定）
async function renderMyPage(username: string, avatarUrl?: string) {
  const content = `
    ${renderHeader('manage', '自定义页面', username, avatarUrl, config.header)}
    ${renderBalanceCard('数据展示', 1000, 'coin')}
    ${renderPromptBox('提示', '这是一个自定义页面', 'info')}
  `;
  const html = getBaseTemplate(content, 640, getTheme(config));
  return await renderToImage(html, '【自定义页面】纯文本降级内容');
}
```

## 📝 更新日志

详细的更新日志请查看 [CHANGELOG.md](CHANGELOG.md)。

## 🙏 第三方资源/致谢

- Roboto Mono 字体（SIL OPEN FONT LICENSE Version 1.1）：https://fonts.google.com/specimen/Roboto+Mono

---

**开发者**: BYWled
**仓库**: `koishi-plugin-monetary-bank`

萌新编写，部分借助了AI的力量，若有纰漏，还望海涵QwQ