# koishi-plugin-monetary-bank | 货币银行

[![npm](https://img.shields.io/npm/v/koishi-plugin-monetary-bank?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monetary-bank) [![GitHub stars](https://img.shields.io/github/stars/BYWled/koishi-plugin-monetary-bank?style=flat-square&logo=github)](https://github.com/BYWled/koishi-plugin-monetary-bank) [![Gitee](https://img.shields.io/badge/Gitee-Project-c71d23?style=flat-square&logo=gitee&logoColor=white)](https://gitee.com/BYWled/koishi-plugin-monetary-bank)

`Provides banking related services for monetary money`

`为 monetary 插件（或外部项目中的主货币表）提供轻量级银行功能，支持活期/定期存款与利息结算。`

---

**版本**: v2.0.1

**主要更新**
- 🎨 **图形化交互**: 引入完整的图形化界面系统（需 puppeteer），提供精美的视觉体验。
- 🏠 **银行首页**: 新增 `bank` 命令，一站式展示账户信息和功能导航。
- 📱 **智能降级**: 自动检测环境，无 puppeteer 时无缝切换回纯文本模式。
- 🖼️ **交互升级**: 存款、取款、定期申请均配备图形化确认与结果页面。

## ✨ 特点

- **多模式交互**: 支持精美的图形化界面，同时也完全兼容纯文本操作。
- **完整银行功能**: 支持活期存款、定期存款、取款、余额查询。
- **利息系统**: 支持活期/定期利息结算，可配置结算周期（日/周/月）。
- **定期管理**: 支持定期存款的自动转存、延期续期管理。
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
```

## 🎮 命令与功能

本插件提供了一套完整的银行指令。当 puppeteer 可用时，这些命令将展示精美的图形化界面。

### 🏠 银行首页 `bank`
- **功能**: 查看账户总览和功能导航。
- **图形化**: 展示现金余额、银行总资产卡片，以及所有可用命令的网格导航。
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

## 🎨 图形化系统设计

### 视觉风格 (v2.0.0+)
- **主题**: 轻盈渐变（#eef2f7 → #f5f7fb），现代卡片式布局，圆角设计。
- **色彩**: 
  - 主色调：紫蓝渐变（#5b7cfa → #7f5af0）用于关键信息展示。
  - 状态色：成功 #4ade80 / 信息 #60a5fa / 警告 #fbbf24。
- **交互**: 悬停效果、平滑过渡、清晰的视觉层级。
- **组件化**: 统一的头部、余额卡片、信息行、命令网格、提示框、确认对话框等可复用组件。
- **响应式**: 网格布局自适应（`repeat(auto-fit, minmax(210px, 1fr))`），支持不同内容宽度。

### 核心组件 (`src/templates.ts`)
```typescript
// 基础模板（包含全局样式）
getBaseTemplate(content: string, width?: number): string

// 页面头部（图标 + 标题 + 用户名）
renderHeader(icon: string, title: string, username: string): string

// 余额大标题卡片
renderBalanceCard(label: string, value: number, currency: string): string

// 网格信息项（支持多种主题色）
renderGridItem(icon, title, value, subtitle, type): string

// 信息行（标签-值对）
renderInfoRow(label: string, value: string, valueClass?: ''|'success'|'error'): string

// 命令导航网格
renderCommandGrid(commands: Array<{icon, name, desc}>): string

// 提示信息框
renderPromptBox(title: string, message: string, type?: 'info'|'warning'|'success'): string

// 确认对话框
renderConfirmDialog(title: string, items: Array<{label, value}>): string
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
// 查询余额
const balance = await ctx.monetaryBank.getBalance(uid, 'coin');
// { total: 1000, demand: 800, fixed: 200 }

// 存款
const res = await ctx.monetaryBank.deposit(uid, 'coin', 100);
// { success: true, newCash: 50, newBalance: { ... } }

// 取款
const res2 = await ctx.monetaryBank.withdraw(uid, 'coin', 50);
```

## 📅 利息结算

若启用 `enableInterest`，插件会启动定时任务（每日0点）：
- 检查到期的定期存款。
- 根据用户设置（自动延期或转活期）进行处理。
- 结算活期利息（按配置周期）。
- 自动合并碎片化的活期记录以优化性能。

## 💻 开发扩展

### 扩展图形化页面
插件内部使用 `src/templates.ts` 中的组件构建页面。开发者可参考以下模式扩展：

```typescript
import { renderHeader, renderBalanceCard, renderPromptBox, getBaseTemplate } from './templates';

// 构建 HTML 内容
const content = `
  ${renderHeader('🎯', '自定义页面', username)}
  ${renderBalanceCard('数据展示', 1000, 'coin')}
  ${renderPromptBox('提示', '这是一个自定义页面', 'info')}
`;

// 生成完整 HTML
const html = getBaseTemplate(content);

// 渲染为图片 (需处理 puppeteer 依赖)
const image = await ctx.puppeteer.render(html);
```

## 📝 更新日志

### v2.0.1

- **修复**: 安装插件时对新版本的Koishi显示不兼容的问题。
- **文档**: 同步更新Github和Gitee至README。

### v2.0.0-Alpha.1
**🎨 图形化大版本更新**

- **新增**: 银行首页 `bank` 命令，图形化展示账户与导航。
- **新增**: 完整的图形化交互系统（存款/取款确认、定期方案选择、结果展示）。
- **新增**: 模板组件系统 (`src/templates.ts`)，提供10+可复用组件。
- **新增**: 定期延期管理的图形化界面（申请延期/取消延期/成功页面）。
- **改进**: 智能检测 puppeteer，支持自动降级为文本模式。
- **改进**: UI 视觉升级，采用轻盈渐变配色，精简间距，现代化设计。
- **优化**: 统一了所有命令的交互流程与视觉体验。
- **优化**: 图形渲染性能优化，减少冗余发送。
- **修复**: 热重载时服务重复注册问题（添加 registry 检测机制）。
- **修复**: TypeScript 类型声明问题（puppeteer 可选依赖）。
- **文档**: 整合 CHANGELOG.md 和 GRAPHICS_GUIDE.md 至 README。

**⚠️ 已知问题**:
- 某些 Koishi 环境下热重载仍可能出现服务注册警告（影响使用）。

### v1.2.1
- 修复插件主页异常的问题

### v1.2.0
- **新增**: `MonetaryBankAPI` 类并导出为 `ctx.monetaryBank`（接口方法：`getBalance` / `deposit` / `withdraw`），所有方法返回统一格式。
- **新增**: 在 `apply` 向 `Context` 注册 `monetaryBank` 服务，并在类型声明中扩展 `Context`。
- **重构**: 命令接口使用新的 API：
  - `bank.bal [currency]` 使用 `ctx.monetaryBank.getBalance()`，支持可选参数输入货币并改进显示为"活期（可用）/定期（不可用）"。
  - `bank.in [amount]` 支持可选参数；无参数时交互式提示，支持 `all` 将全部现金存入。
  - `bank.out [amount]` 支持可选参数；无参数时交互式提示并展示当前活期余额，支持 `all` 将全部活期取出。
- **改进**: 利息结算流程中在结算完成后合并相同组别的活期记录（`mergeDemandRecords`），减少碎片小额记录，提升性能与可读性。
- **改进**: 交互文本与超时处理更友好（30s 超时提示取消）。

### v1.1.1
- 修复了代码未构建的问题。

### v1.1.0
- **新增**: 命令 `bank.fixed`, `bank.fixed.manage` 与更完善的交互流程。
- **新增**: 活期/定期利息配置与结算调度（可配置开启）。
- **改进**: 兼容更多 `monetary` 表字段，增强容错与自动创建最小记录的能力。
- **⚠️ 注意**: 本版本重构了数据库，因此旧的数据库中的**数据将丢失**，请在更新前做好**数据备份**！

### v1.0.1
- 修复依赖版本问题。

### v1.0.0
- 初始发布，提供银行存取与查询功能 `bank.in`, `bank.out`, `bank.bal`。

---

**开发者**: BYWled
**仓库**: `koishi-plugin-monetary-bank`

萌新编写，部分借助了AI的力量，若有纰漏，还望海涵QwQ
