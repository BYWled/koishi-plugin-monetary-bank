# koishi-plugin-monetary-bank | 货币银行

[![npm](https://img.shields.io/npm/v/koishi-plugin-monetary-bank?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monetary-bank)

`Provides banking related services for monetary money`

`为 monetary 插件（或外部项目中的主货币表）提供轻量级银行功能，支持活期/定期存款与利息结算。`

**目录**
- 简介
- 特点
- 依赖
- 数据库表
- 快速安装
- 配置说明
- 命令一览
- API
- 利息结算
- 附加说明
- 更新日志
- 开发者/贡献

---

**版本**: v1.2.0

**特点**
- **查询/存取**: 提供银行资产查询、存入（存为活期）、取出（仅活期）。
- **定期存款**: 支持申请定期存款与到期转活期或延期续期。
- **利息结算（可选）**: 支持活期/定期利息结算（可设置为每日/周/月结算）。
- **兼容性**: 尽量兼容外部项目中常见的 `monetary` 表字段（`uid`/`id` 与 `value|balance|amount|coin` 等）。

**依赖**
- **必需**: `database` 服务（在 Koishi 配置中需启用数据库插件）

**数据库表**
- **表名**: `monetary_bank_int` — 用于记录所有银行存款（活期与定期）。
- **早期表名**：`monetary_bank` — 用于存放用户和银行存款。

**快速安装**
- 在 Koishi 项目中安装并启用本插件（示例：`package.json` 或 Koishi 配置中添加插件）

**配置说明**
- **`defaultCurrency`**: `string` — 默认货币，默认值：`coin`。
- **`debug`**: `boolean` — 是否输出 info/success 级别日志，默认：`true`。
- **`enableInterest`**: `boolean` — 是否启用利息与定期功能，默认：`false`。
- **`demandInterest`**: `object` — 活期利息配置：
	- **`enabled`**: `boolean` — 是否启用活期利息（默认 `true`）
	- **`rate`**: `number` — 活期利率（%），默认 `0.25`
	- **`cycle`**: `'day' | 'week' | 'month'` — 结算周期，默认 `day`
- **`fixedInterest`**: `Array<{ name: string; rate: number; cycle: 'day'|'week'|'month' }>` — 定期方案列表，默认示例：
	- `{ name: '周定期', rate: 4.35, cycle: 'week' }`
	- `{ name: '月定期', rate: 50, cycle: 'month' }`

在 Koishi 插件配置中示例：

```
plugins: {
	'monetary-bank': {
		defaultCurrency: 'coin',
		debug: true,
		enableInterest: true,
		demandInterest: { enabled: true, rate: 0.25, cycle: 'day' },
		fixedInterest: [
			{ name: '周定期', rate: 4.35, cycle: 'week' },
			{ name: '月定期', rate: 50, cycle: 'month' }
		]
	}
}
```

**命令一览**
- **`bank.bal`**: 查询银行存款
	- 选项：`-c <currency>` 指定货币
	- 返回总资产、活期（可用）与定期（不可用）数量
- **`bank.in <amount>`**: 存入现金到银行（自动转为活期）
	- 支持金额为正整数或 `all`
	- 选项：`-c <currency>` 指定货币，`-y` 跳过确认
	- 流程：检查现金 -> 二次确认（可跳过）-> 扣除现金 -> 创建活期记录
- **`bank.out <amount>`**: 从银行取出货币（仅从活期）
	- 支持 `all`
	- 选项：`-c <currency>`，`-y` 跳过确认
	- 按时间顺序扣除活期记录并转回现金
- **`bank.fixed`**: 申请定期存款
	- 可选择配置中的定期方案
	- 支持从现金和活期组合扣款（优先扣现金）
- **`bank.fixed.manage`**: 管理已申请的定期（申请延期或取消延期）

命令示例：

```
bank.bal -c coin
bank.in 100 -c coin
bank.out all -c coin
bank.fixed -c coin
bank.fixed.manage -c coin
```

**API**

本插件提供可被其他插件直接调用的编程接口 `MonetaryBankAPI`，并在 `apply` 中注册为 `ctx.monetaryBank`。该 API 将业务逻辑与命令交互分离，便于测试和复用。

- `getBalance(uid: number, currency: string): Promise<{ total: number; demand: number; fixed: number }>`
	- 说明：查询指定用户在银行的总资产、活期（可用）与定期（不可用）余额。

- `deposit(uid: number, currency: string, amount: number): Promise<{ success: boolean; newCash?: number; newBalance?: { total:number; demand:number; fixed:number }; error?: string }>`
	- 说明：将用户的现金存入银行并创建活期记录（会自动尝试创建主货币账户）。返回操作结果与更新后的现金/银行余额。

- `withdraw(uid: number, currency: string, amount: number): Promise<{ success: boolean; newCash?: number; newBalance?: { total:number; demand:number; fixed:number }; error?: string }>`
	- 说明：从活期中按时间顺序扣除金额并转回用户现金。仅能提取活期部分，返回操作结果与更新后的现金/银行余额。

返回格式说明（统一格式）
- `success`: 操作是否成功（布尔）
- `newCash`（可选）：操作后用户主货币表中的现金余额
- `newBalance`（可选）：操作后银行中归集的余额信息（`{ total, demand, fixed }`）
- `error`（可选）：失败时的错误消息

API示例（在其他插件中调用）：

```
// 查询余额
const balance = await ctx.monetaryBank.getBalance(uid, 'coin')
console.log(`总资产：${balance.total}, 活期：${balance.demand}, 定期：${balance.fixed}`)

// 存款
const res = await ctx.monetaryBank.deposit(uid, 'coin', 100)
if (res.success) console.log(`存款成功，新现金：${res.newCash}`)
else console.error(`存款失败：${res.error}`)

// 取款
const res2 = await ctx.monetaryBank.withdraw(uid, 'coin', 50)
if (res2.success) console.log(`取款成功，新现金：${res2.newCash}`)
else console.error(`取款失败：${res2.error}`)
```

**利息结算**
- 若在配置中启用 `enableInterest`，插件会在后台启动定时任务，每日0点检查并结算到期记录（对 `day/week/month` 周期分别按设定处理）。
- 到期的定期记录可以：延期（若用户已申请）或转为活期并结算利息。

**附加说明**
- 本插件为尽量通用的实现：在读取外部 `monetary` 表时会尝试 `uid` 或 `id` 作为查询键，并尝试常见数值字段（如 `value`, `balance`, `amount`, `coin` 等）。若无法自动创建或更新主货币记录，将记录日志并返回错误提示，请管理员检查主表结构。
- 插件会在首次运行时尝试创建 `monetary_bank_int` 表（若数据库支持并且表不存在）。

**开发者/贡献**
- 插件作者: BYWled
- 仓库: `koishi-plugin-monetary-bank`


**更新日志**

- **1.2.0**
	- 新增：`MonetaryBankAPI` 类并导出为 `ctx.monetaryBank`（接口方法：`getBalance` / `deposit` / `withdraw`），所有方法返回统一格式 `{ success, newCash?, newBalance?, error? }`，便于其他插件以编程方式调用。
	- 新增：在 `apply` 向 `Context` 注册 `monetaryBank`（`ctx.monetaryBank = new MonetaryBankAPI(ctx, config)`），并在类型声明中扩展 `Context`。
	- 重构：命令接口使用新的 API：
		- `bank.bal [currency]` 使用 `ctx.monetaryBank.getBalance()`，支持可选参数输入货币并改进显示为“活期（可用）/定期（不可用）”。
		- `bank.in [amount]` 支持可选参数；无参数时交互式提示 `请输入存款金额（正整数或 all）：`，支持 `all` 将全部现金存入；使用 `ctx.monetaryBank.deposit()` 执行业务逻辑。
		- `bank.out [amount]` 支持可选参数；无参数时交互式提示并展示当前活期余额，支持 `all` 将全部活期取出；使用 `ctx.monetaryBank.withdraw()`。
	- 改进：利息结算流程中在结算完成后合并相同组别的活期记录（`mergeDemandRecords`），减少碎片小额记录，提升性能与可读性。
	- 改进：交互文本与超时处理更友好（30s 超时提示取消）。

- **1.1.1**
	- 修复了代码未构建的问题。

- **1.1.0** 
	- 增加：命令 `bank.fixed`, `bank.fixed.manage` 与更完善的交互流程
	- 增加：活期/定期利息配置与结算调度（可配置开启）
	- 改进：兼容更多 `monetary` 表字段，增强容错与自动创建最小记录的能力
	- **注意**：本版本重构了数据库，因此旧的数据库中的**数据将丢失**，请在更新前做好**数据备份**！
- **1.0.1**
	- 修复依赖版本问题
- **1.0.0**
	- 初始发布，提供银行存取与查询功能 `bank.in`, `bank.out`, `bank.bal`

---

萌新编写，部分借助了AI的力量，若有纰漏，还望海涵QwQ
