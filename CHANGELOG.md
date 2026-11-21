# Changelog

本项目的所有关键更改都将记录在此文件中。

## [2.3.0-Alpha.1]

### 🐛 Bug Fixes
- **transfer (目标解析)**: `resolveTargetUid` 绑定查询增加 `platform` 严格过滤（与 koishi core `getUser` 的解析语义一致），不再回退到其他平台/历史会话的同名绑定；当前平台未匹配时直接走免开户自动建档，杜绝向"幽灵账户"转账。
- **freeze (表结构)**: `monetary_bank_freeze` 新增 `senderUid` 列记录转账付款方 uid，`sourceRecordId` 回归纯粹的"冻结来源记录 id"语义（转账冻结恒为 `null`）；付款方首页"转出在途冻结"改按 `senderUid` 匹配，消除与 API 冻结记录 id 撞号的误显。
- **bank (uid=0 兼容)**: `bank` 命令的用户回退解析与首页"转出在途"查询不再将合法的 `uid=0` 误判为空值。

### 🎨 Features (新特性)
- **transfer (转账系统)**:
  - 新增 `bank.transfer <target> [amount]` 指令，支持通过 `@用户` 或 `平台账号/QQ号` 直接转账。
  - 支持未知目标用户免开户自动建档（自动建立 `user` 与 `binding` 记录）。
  - 支持 `-m, --cash` 参数：以付款人钱包现金支付转账，转账款项直达收款人银行活期账户。
  - 支持手续费费率与固定费用配置，默认外扣手续费，支持 `-i, --inner-fee` 参数切换为从转账款项中内扣。
  - 支持转账信用分验证（Alpha 占位机制，支持 `monetaryCredit` 联动接口校验并可配置拦截分数线）。
  - 支持转账自动冻结到账资金，支持固定时长或按金额阶梯自动换算冻结时长。
- **freeze (资金冻结机制)**:
  - 资金冻结后仍然计入用户银行总资产与户内存款，但不计入可用额度（`availableDemand` / `availableFixed`），严格禁止取款、消费与转出。
  - 支持**不可结息冻结**（如转账在途、消费预授权，`accrual: false`）与**可结息冻结**（如定期存款质押、担保金，`accrual: true`）。
  - 支持意外处置接口 `forfeitFixedFreeze`：定期质押违约没收时直接核销本金，并取消全部未结算利息。
  - 引入按需惰性解冻机制，在所有余额读取、转账、取款前自动核验并解冻到期资金；解冻判定升级为毫秒时间戳比对，规避数据库驱动时区与类型隐患。
  - **转账提示精简与防换行**：将转账结果与确认中的冻结通知精简为超紧凑格式 `已冻结至 MM-DD HH:mm`（如 `已冻结至 11-20 00:54`），彻底避免表格换行；新增 `formatDurationText` 智能转换秒/分/小时，解决短时长（如 60 秒）显示为 `0 小时` 的问题。
  - **银行首页冻结透明化**：在转账冻结中精准记录付款方源 ID；付款人在执行转账后输入 `bank` 时，首页冻结资产副标题清晰呈现 `户内无冻结 (转出在途冻结 xx coin)`，明确区分户内冻结与收款方在途冻结，彻底消除资金状态误解。
- **api (开放接口升级)**:
  - `creditDemand(uid, currency, amount, reason)`: 仅操作银行活期存款的直接打款接口。
  - `debitDemand(uid, currency, amount, reason)`: 仅操作银行活期可用存款的直接扣款接口。
  - `freeze(uid, currency, amount, options)`: 细粒度资金冻结接口（支持指定活期/定期源、结息标志、冻结到期时间等）。
  - `unfreeze(freezeId)`: 解冻指定冻结项。
  - `forfeitFixedFreeze(freezeId, reason)`: 处置违约质押定期，没收本金并作废利息。
  - `getFrozenBalance(uid, currency)`: 细分查询已冻结活期、已冻结定期与总冻结额度。
  - `transfer(payerUid, payeeUid, currency, amount, options)`: 独立转账核心 API，支持外部插件自拟手续费、内扣、现金来源及冻结规则，不影响全局银行配置。

### 💄 UI/UX (界面与交互)
- **header (自适应防重叠机制)**:
  - 统一重构全局通用页头组件 `renderHeader`，采用现代化左右分栏设计：左侧为业务图标徽标、主标题与副标题；右侧为用户信息胶囊（头像图片/首字母回退徽标 + 用户名），时间配置组件（`header-time`）与用户信息胶囊统一 40px 高度、胶囊圆角（50px）和立体阴影，保持极佳的视觉均衡度。
  - **窄屏自动降级折叠保护**：新增多级自适应防重叠机制（基于容器查询 `@container`、类选择器与媒体查询），在模板渲染宽度过窄时（如 520px 确认/成功弹窗等紧凑页面）：
    - 宽度 <= 680px：自动隐藏时间徽章（`.header-time`）与装饰性英文副标题（`.header-subtitle`）。
    - 宽度 <= 560px：自动将用户信息胶囊中的文本折叠，仅保留 40x40 纯圆形头像胶囊（同时挂载 `title` 提示），减少内边距为标题提供充裕排版空间，彻底根绝页头内容相互碰撞与重叠错位。
- **bank (银行首页资产排布优化)**: 首页常态化展示所有可能的数据资产项（包含总资产、活期存款、定期资产、现金余额、冻结资金及钱包总身家），严格确保**定期存款与活期存款置于首行并列展示**，现金与冻结资金置于第二行，彻底避免卡片落单或缺损。
- **transfer (收款人昵称显示)**: 通过数字 ID/平台号转账时自动解析收款人昵称（优先 `user.name` 平台昵称，其次当前平台绑定 `pid`），确认页/成功页/交互提示统一展示昵称而非裸 ID。
- **typography (字体与层级显著增大)**: 全面拔高移动端查图字体尺寸，小字副标题/参数/提示从 11-13px 提升至 13-16px，指令大标题提升至 24px，消除缩放查图痛点。
- **overflow-prevention (极端变量与金额防溢出体系)**:
  - 新增 `numberFormat` 金额智能缩写体系，支持配置中文单位（千/万/亿）、英文单位（K/M/B/T）及超长自动缩写（`auto`），防止天文数字撑破网格。
  - 全局 CSS 实施严格的弹性防溢出保护，应用 `minmax(0, 1fr)`、`min-width: 0`、`text-overflow: ellipsis` 以及 `word-break: break-all`，全面预防超长用户名、超长金额、长语法引起的异常折行与布局塌陷。
- **bank.help (大字号功能清单)**: 新增 `bank.help` 指令及专属页面渲染，采用大字号指令卡片（命令名、分类徽章、语法、功能说明、参数），彻底避免移动端看图缩放困扰。
- **fallback**: 全面强化图片/文字双模降级，所有新增的转账确认、转账成功、转账失败、银行主页与帮助页面在无 Puppeteer 时均支持格式对齐的文本降级渲染。

---

## [2.2.0]

### 💄 UI/UX (界面与交互)
- **icon**: 重绘所有图标，提升整体视觉一致性与现代感。
- **layout**: 优化页面布局，提升信息层次感。
- **font**: 全局字体升级为 Roboto Mono，增强金融专业感与数据可读性。

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