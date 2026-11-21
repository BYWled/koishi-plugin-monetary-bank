# AGENTS.md — koishi-plugin-monetary-bank

> AI Agent 开发流程指南。收到开发任务时，按本文件定义的阶段依次执行。

## 项目速查

- **插件名**: `koishi-plugin-monetary-bank` v2.2.0
- **入口**: `src/index.ts`（1705 行，全部业务逻辑）+ `src/templates.ts`（791 行，UI 模板）
- **编译**: `tsc`，产物提交到 `lib/`（无构建脚本）
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

1. 在 `initDatabase()` 函数中的 `ctx.model.extend('monetary_bank_int', {...})` 添加字段
2. 在 `MonetaryBankInterest` 接口（line 246-258）添加对应属性
3. 检查 `monetary-bourse` 是否需要同步更新

#### 需要新增命令时

1. 在 `apply()` 函数末尾添加 `.subcommand()` 注册
2. 使用 `.userFields(['id'])` 获取用户数字 ID
3. 涉及金额操作时提供 `-y` 选项跳过确认
4. 视觉输出调用 `renderToImage(html, fallbackText)`

### 阶段三：验证与测试

**本项目无自动化测试。** 验证方式：

1. **编译检查**: 运行 `tsc --noEmit` 确认无类型错误
2. **逻辑走查**: 手动检查以下关键路径：
   - 存款 → monetary 表扣款 → monetary_bank_int 创建 demand 记录
   - 取款 → 遍历 demand 记录（按 settlementDate 升序）→ monetary 表加款
   - 定期存款 → 扣款（现金优先，不足扣活期）→ 创建 fixed 记录
   - 利息结算 → 午夜触发 → 按类型分别计算 → 合并碎片记录
3. **降级测试**: 确认所有渲染函数的 `fallbackText` 参数不为空
4. **跨插件检查**: 如果修改了表结构，验证 bourse 插件的类型定义是否兼容

### 阶段四：发布前文档

完成后更新以下内容：

1. **CHANGELOG.md**: 在顶部添加新版本条目，格式遵循现有模式
2. **package.json**: 如需发布，更新 `version` 字段
3. **编译**: 运行 `tsc` 更新 `lib/` 产物
4. **Koishi 编译**: 在插件所在的 koishi 根目录运行 `npm run build monetary-bank` 更新 `lib/` 产物
5. **readme.md**: 如有新功能或配置变更，更新对应章节

## 关键代码位置速查

| 功能 | 文件 | 大约行号 |
|---|---|---|
| Config 接口 + Schema | index.ts | 7-63 |
| MonetaryBankAPI 类 | index.ts | 115-239 |
| MonetaryBankInterest 接口 | index.ts | 246-258 |
| 数据库初始化 | index.ts | 276-345 |
| monetary 表操作函数 | index.ts | 352-461 |
| 利息结算调度器 | index.ts | 501-621 |
| 记录合并优化 | index.ts | 626-703 |
| 命令注册 + 业务逻辑 | index.ts | 730-1705 |
| HTML 模板函数 | templates.ts | 全文 |

## 数据库表结构

### `monetary_bank_int`（本插件创建）

```
id: unsigned (PK)  |  uid: unsigned  |  currency: string  |  amount: double
type: 'demand'|'fixed'  |  rate: double  |  cycle: 'day'|'week'|'month'
settlementDate: timestamp  |  extendRequested: boolean
nextRate: double?  |  nextCycle: string?
```

### `monetary`（外部，koishi-plugin-monetary）

通过自动检测函数访问，支持多种字段命名变体。**禁止直接硬编码字段名。**

## 依赖关系

```
monetary-bank
├── 必需: database, monetary（数据库层）
├── 可选: puppeteer
└── 被依赖: monetary-bourse（直查 monetary_bank_int 表）
