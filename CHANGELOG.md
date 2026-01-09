# Changelog

本项目的所有关键更改都将记录在此文件中。

## [2.1.0]

### 💄 UI/UX (界面与交互)
- **layout**: 重构整体页面布局，采用深色玻璃拟态设计风格，与 monetary-bourse 保持一致。
- **typography**: 统一字体栈为 `Roboto Mono` 等宽字体，提升金融专业感与数据可读性。
- **colors**: 全新深色主题配色，主色调为蓝色渐变 (`#58a6ff` → `#2563eb`)，并且支持跟随时间切换。
- **footer**: 统一底部时间戳样式为右下角子标格式。

### 🐛 Bug Fixes (修复)
- **service**: 修复热重载时 `service monetaryBank has been registered` 报错。改用 `ctx.set()` 替代 `ctx.provide()` 实现服务注册，支持热重载时自动覆盖。

### ⚡ Performance (性能优化)
- **database**: 将 `amount` 字段类型从 `unsigned` 改为 `double`，支持浮点数金额。

### 📝 Documentation (文档)
- **changelog**: 将更新日志独立到 `CHANGELOG.md` 文件，采用标准化格式。

## [2.0.1]

### 🐛 Bug Fixes (修复)
- **build**: 修复安装插件时对新版本的 Koishi 显示不兼容的问题。

### 📝 Documentation (文档)
- 同步更新 Github 和 Gitee 链接至 `README`。

## [2.0.0-Alpha.1]

### 🎨 Features (新特性)
- **ui**: 银行首页 `bank` 命令，图形化展示账户与导航。
- **ui**: 完整的图形化交互系统（存款/取款确认、定期方案选择、结果展示）。
- **ui**: 模板组件系统 (`src/templates.ts`)，提供10+可复用组件。
- **ui**: 定期延期管理的图形化界面（申请延期/取消延期/成功页面）。

### ⚡ Performance (性能优化)
- **render**: 智能检测 puppeteer，支持自动降级为文本模式。
- **render**: 图形渲染性能优化，减少冗余发送。

### 💄 UI/UX (界面与交互)
- **layout**: UI 视觉升级，采用轻盈渐变配色，精简间距，现代化设计。
- **flow**: 统一了所有命令的交互流程与视觉体验。

### 🐛 Bug Fixes (修复)
- **service**: 热重载时服务重复注册问题（添加 registry 检测机制）。
- **types**: TypeScript 类型声明问题（puppeteer 可选依赖）。

### 📝 Documentation (文档)
- 整合 CHANGELOG.md 和 GRAPHICS_GUIDE.md 至 README。

### ⚠️ Known Issues (已知问题)
- 某些 Koishi 环境下热重载仍可能出现服务注册警告（影响使用）。

## [1.2.1]

### 🐛 Bug Fixes (修复)
- 修复插件主页异常的问题。

## [1.2.0]

### ✨ Features (新特性)
- **api**: `MonetaryBankAPI` 类并导出为 `ctx.monetaryBank`（接口方法：`getBalance` / `deposit` / `withdraw`），所有方法返回统一格式。
- **service**: 在 `apply` 向 `Context` 注册 `monetaryBank` 服务，并在类型声明中扩展 `Context`。

### ♻️ Refactor (重构)
- **command**: 命令接口使用新的 API：
  - `bank.bal [currency]` 使用 `ctx.monetaryBank.getBalance()`，支持可选参数输入货币并改进显示为"活期（可用）/定期（不可用）"。
  - `bank.in [amount]` 支持可选参数；无参数时交互式提示，支持 `all` 将全部现金存入。
  - `bank.out [amount]` 支持可选参数；无参数时交互式提示并展示当前活期余额，支持 `all` 将全部活期取出。

### ⚡ Performance (性能优化)
- **alg**: 利息结算流程中在结算完成后合并相同组别的活期记录（`mergeDemandRecords`），减少碎片小额记录，提升性能与可读性。

### 💄 UI/UX (界面与交互)
- **ux**: 交互文本与超时处理更友好（30s 超时提示取消）。

## [1.1.1]

### 🐛 Bug Fixes (修复)
- 修复了代码未构建的问题。

## [1.1.0]

### ✨ Features (新特性)
- **command**: 命令 `bank.fixed`, `bank.fixed.manage` 与更完善的交互流程。
- **interest**: 活期/定期利息配置与结算调度（可配置开启）。

### ⚡ Performance (性能优化)
- **compat**: 兼容更多 `monetary` 表字段，增强容错与自动创建最小记录的能力。

### ⚠️ Breaking Changes (破坏性变更)
- 本版本重构了数据库，因此旧的数据库中的**数据将丢失**，请在更新前做好**数据备份**！

## [1.0.1]

### 🐛 Bug Fixes (修复)
- 修复依赖版本问题。

## [1.0.0]

### 🎉 Initial Release (初始发布)
- 初始发布，提供银行存取与查询功能 `bank.in`, `bank.out`, `bank.bal`。