# AGENTS.md — koishi-plugin-monetary-bank

> AI Agent 开发流程指南。收到开发任务时，按本文件定义的阶段依次执行。

## 项目速查

- **插件名**: `koishi-plugin-monetary-bank` v3.0.0-Alpha.1（3.0.0 起代码模块化拆分）
- **入口**: `src/index.ts`（入口装配：Config Schema + apply 装配），业务按域拆分至 services/render/database/types/commands/*、utils/*、templates/*
- **编译**: `yarn build monetary-bank`（koishi 根目录，yakumo），产物输出 `lib/`
- **服务**: 提供 `monetaryBank` 服务（MonetaryBankAPI）
- **依赖**: `database`（必需）、`monetary`（必需，通过数据库直读）、`puppeteer`（可选，降级为文本）

## 开发流程

### 阶段一：需求分析与评审

收到需求后，先做以下检查再动手：

1. **定位影响范围** — 所有逻辑集中在 `src/index.ts`，用关键词搜索定位相关代码段：
   - 存取款逻辑 → `deposit()` / `withdraw()` / `MonetaryBankAPI` 类
   - 利息结算 → `settleInterest()` / `calculateNextSettlementDate()` / `mergeDemandRecords()`
   - 命令处理 → `apply()` 函数内的 `.subcommand()` 注册链（约 line 730-1705）
   - UI 渲染 → `templates.ts` 的 8 个导出函数 + `renderToImage()`

2. **检查 monetary 表兼容性** — 任何涉及现金余额的操作必须经过 `findMonetaryRecord()` / `getMonetaryBalance()` / `changeMonetary()` 这三个函数，它们内部有字段名自动检测逻辑（`uid`/`id`、`value`/`balance`/`amount`/`coin`/`money`）。**禁止绕过这些函数直接操作 monetary 表。**

3. **检查跨插件影响** — 本插件被 `monetary-bourse` 依赖（bourse 直查 `monetary_bank_int` 表）。修改表结构时需同步检查：
   - `monetary-bourse/src/index.ts` 中的 `MonetaryBankInterest` 接口定义
   - bourse 的 `getBankDemandBalance()` / `deductBankDemand()` 函数

4. **评估 Puppeteer 影响** — 所有视觉命令必须保留 `fallbackText` 参数以支持无 Puppeteer 环境

5. **向用户确认** — 将分析结果和实施方案告知用户，获得确认后再进入实现阶段

### 阶段二：实现

#### 代码修改规范

- **单文件架构**: 修改业务逻辑改 `src/index.ts`，修改 UI 改 `src/templates.ts`
- **命令注册**: 在 `apply()` 函数内通过 `.subcommand()` 链式注册，遵循现有命名模式
- **数据库操作**: 使用 Koishi 的 `ctx.database.get()` / `ctx.database.set()` / `ctx.database.create()` / `ctx.database.remove()`
- **交互式确认**: 涉及金额变动的命令使用 `session.prompt(30000)` + 确认对话框（模板或文本）
- **服务注册**: 新的 API 方法添加到 `MonetaryBankAPI` 类，通过 `ctx.set('monetaryBank', api)` 暴露

#### 需要新增数据库字段时

1. 在 `src/database.ts` 的 `ctx.model.extend('monetary_bank_int', {...})` 添加字段
2. 在 `src/types.ts` 的 `MonetaryBankInterest` 接口添加对应属性
3. 检查 `monetary-bourse` 是否需要同步更新

#### 需要新增命令时

1. 在对应业务域的 `src/commands/*.ts` 中添加 `.subcommand()` 注册；新域则新建 `commands/*.ts` 并在 `index.ts` 的 `apply()` 中挂接
2. 使用 `.userFields(['id'])` 获取用户数字 ID
3. 涉及金额操作时提供 `-y` 选项跳过确认
4. 视觉输出调用 `render.renderToImage(html, fallbackText)`（工厂已内含渲染超时与页面兜底关闭）

### 阶段三：验证与测试

**自动化测试**（2.3.0 起提供，均在 koishi 根目录运行 `node -r esbuild-register <文件>`）：

1. **编译检查**: `npx tsc --noEmit -p external/monetary-bank/tsconfig.json` + `yarn build monetary-bank`
2. **API 全覆盖**: `external/monetary-bank/test-api.ts`（32 断言：7 个开放 API、冻结/抵债/转账入参覆盖/异常路径）
3. **文本降级+配置矩阵**: `external/monetary-bank/test-text.ts`（无 puppeteer 环境全指令文本回退、信用分拦截、maxFee/tiered、定期全流程）
4. **沙盒人工矩阵**: 浏览器沙盒跑图片模式全指令 + 配置项逐项验证（themeMode/header/numberFormat/maxFee/tiered/creditCheck）
5. **逻辑走查**: 关键路径同旧版：存款扣现金→建 demand 记录；取款按 settlementDate 升序扣活期→加现金；定期现金优先不足扣活期；利息午夜触发按类型结算→合并碎片
6. **降级测试**: 确认 `src/render.ts` 所有渲染函数的 `fallbackText` 不为空
7. **跨插件检查**: 修改表结构时验证 bourse 的 `MonetaryBankInterest` 类型定义兼容；公共导出面（`index.ts` re-export）不得破坏

### 阶段四：发布前文档

完成后更新以下内容：

1. **CHANGELOG.md**: 在顶部添加新版本条目，格式遵循现有模式
2. **package.json**: 如需发布，更新 `version` 字段
3. **编译**: 在 koishi 根目录运行 `npm run build monetary-bank` 更新 `lib/` 产物
4. **发布预检**: 确认 package.json 版本携带 Alpha 后缀（预览版走 `publishConfig.tag: alpha`，严禁以稳定版本号发布预览内容）
5. **readme.md**: 如有新功能或配置变更，更新对应章节

## 关键代码位置速查

| 功能 | 文件 |
|---|---|
| 入口装配 + Config Schema | src/index.ts |
| 公共类型/表结构声明 | src/types.ts |
| MonetaryBankAPI（7+ API） | src/services.ts |
| 数据库初始化 | src/database.ts |
| 页面渲染工厂 + 文本降级 | src/render.ts |
| 银行首页/明细指令 | src/commands/bank.ts |
| 存取款指令 | src/commands/deposit.ts |
| 转账指令 | src/commands/transfer.ts |
| 定期申请/管理指令 | src/commands/fixed.ts |
| 帮助指令 | src/commands/help.ts |
| monetary 表操作 | src/utils/monetary.ts |
| 冻结/解冻 | src/utils/freeze.ts |
| 利息结算/合并 | src/utils/interest.ts |
| 结算日期算法 | src/utils/time.ts |
| 转账解析/费率/信用分 | src/utils/transfer.ts |
| 时长格式化 | src/utils/format.ts |
| 日志与调试开关 | src/utils/log.ts |
| HTML 组件/样式外壳 | src/templates/{components,theme,shell,base}.ts |
| 图标内联 SVG（生成产物） | src/templates/icons.generated.ts + src/templates/assets.ts |
| 图标再生成工具 | tools/generate-icons.cjs（改 assets/icons/*.svg 后重跑） |

## 数据库表结构

### `monetary_bank_int`（本插件创建）

```
id: unsigned (PK)  |  uid: unsigned  |  currency: string  |  amount: double
type: 'demand'|'fixed'  |  rate: double  |  cycle: 'day'|'week'|'month'
settlementDate: timestamp  |  extendRequested: boolean
nextRate: double?  |  nextCycle: string?
```

### `monetary_bank_freeze`（2.3.0 新增，本插件创建）

```
id: unsigned (PK)  |  uid: unsigned  |  currency: string  |  amount: double
sourceType: 'demand'|'fixed'  |  sourceRecordId: unsigned?（冻结来源记录 id；转账冻结恒为 null）
senderUid: unsigned?（转账付款方 uid，供首页"转出在途"展示）  |  accrual: boolean（可否结息）
reason: string  |  frozenAt: timestamp  |  unfreezeAt: timestamp?  |  status: 'frozen'|'unfrozen'|'forfeited'
```

### `monetary`（外部，koishi-plugin-monetary）

通过自动检测函数访问，支持多种字段命名变体。**禁止直接硬编码字段名。**

## 依赖关系

```
monetary-bank
├── 必需: database, monetary（数据库层）
├── 可选: puppeteer
└── 被依赖: monetary-bourse（直查 monetary_bank_int 表）
