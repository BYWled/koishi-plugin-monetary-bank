import type { Context } from 'koishi'
import type { Config } from '../index'
import type { BankRender } from '../render'

export function registerHelpCommands(ctx: Context, config: Config, render: BankRender) {
  const { renderBankHelpPage } = render

    // 6. 注册命令：银行功能列表（大字号大图展示）
  ctx.command('bank.help', '查看银行功能指令列表')
    .action(async ({ session }) => {
      const username = session.username || session.author?.name || session.author?.nick || session.userId || '用户'
      const avatarUrl = session.event?.user?.avatar || session.author?.avatar
      return await renderBankHelpPage(username, avatarUrl)
    })
}
