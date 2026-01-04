# koishi-plugin-monetary-bank | 货币银行

[![npm](https://img.shields.io/npm/v/koishi-plugin-monetary-bank?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monetary-bank)

`Provides banking related services for monetary money`

---

`为 monetary 插件（或外部项目中的主货币表）提供轻量级银行功能，支持活期/定期存款与利息结算。`

**版本**: v1.1.0

**特点**
- **查询/存取**: 提供银行资产查询、存入（存为活期）、取出（仅活期）。
- **定期存款**: 支持申请定期存款与到期转活期或延期续期。
- **利息结算（可选）**: 支持活期/定期利息结算（可设置为每日/周/月结算）。
- **兼容性**: 尽量兼容外部项目中常见的 `monetary` 表字段（`uid`/`id` 与 `value|balance|amount|coin` 等）。

**依赖**
- **必需**: `database` 服务（在 Koishi 配置中需启用数据库插件）

**数据库表**
- **表名**: `monetary_bank_int` — 用于记录所有银行存款（活期与定期）。

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

示例：

```
bank.bal -c coin
bank.in 100 -c coin
bank.out all -c coin
bank.fixed -c coin
bank.fixed.manage -c coin
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

- 1.1.1
  - 修复了代码未构建的问题。~~有个神人忘了构建源代码了~~

- **1.1.0** 
	- 增加：命令 `bank.fixed`, `bank.fixed.manage` 与更完善的交互流程
	- 增加：活期/定期利息配置与结算调度（可配置开启）
	- 改进：兼容更多 `monetary` 表字段，增强容错与自动创建最小记录的能力
- **1.0.1**
	- 修复依赖版本问题
- **1.0.0**
	- 初始发布，提供银行存取与查询功能 `bank.in`, `bank.out`, `bank.bal`

---

萌新编写，部分借助了AI的力量，若有纰漏，还望海涵QwQ
