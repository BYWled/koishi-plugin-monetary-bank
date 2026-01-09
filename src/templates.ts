/**
 * HTML模板工具文件
 * 提供统一的样式和布局模板
 * 设计风格：深色玻璃拟态，与 monetary-bourse 保持一致
 */

/**
 * 通用HTML模板基础
 */
export function getBaseTemplate(content: string, width: number = 520, isDark: boolean = false): string {
  // 深色模式变量 (Dark Mode)
  const darkVars = `
      /* 统一配色 - 深色玻璃拟态 */
      --bg-color: #0c0f15;
      --card-bg: rgba(22, 27, 34, 0.7);
      --item-bg: rgba(31, 36, 46, 0.6);
      --text-primary: #f0f3f5;
      --text-secondary: #8b949e;
      --border-color: rgba(48, 54, 61, 0.5);
      --accent-color: #58a6ff;
      
      /* 边界定义 */
      --card-ring: rgba(255, 255, 255, 0.1);
      --inner-border: rgba(255, 255, 255, 0.1);
      
      /* 渐变与语义色 */
      --accent-gradient: linear-gradient(135deg, #58a6ff 0%, #2563eb 100%);
      --success-color: #4ade80;
      --warning-color: #fbbf24;
      --danger-color: #f87171;
      --success-bg: rgba(74, 222, 128, 0.15);
      --warning-bg: rgba(251, 191, 36, 0.15);
      --danger-bg: rgba(248, 113, 113, 0.15);
      --shadow-color: rgba(0, 0, 0, 0.6);
      --separator-color: rgba(48, 54, 61, 0.5);
  `

  // 浅色模式变量 (Light Mode)
  // 调整说明：增强阴影，使用深色微边框替代白色高光边框，显著提升对比度
  const lightVars = `
      /* 统一配色 - 亮色玻璃拟态 */
      --bg-color: #f0f4f9;
      --card-bg: rgba(255, 255, 255, 0.85);
      --item-bg: rgba(255, 255, 255, 0.65);
      --text-primary: #334155;
      --text-secondary: #64748b;
      --border-color: rgba(0, 0, 0, 0.06); /* 关键修改：深色微边框 */
      --accent-color: #3b82f6;
      
      /* 边界定义 - 增强边界感 */
      --card-ring: rgba(0, 0, 0, 0.06);
      --inner-border: rgba(255, 255, 255, 0.9);
      
      /* 渐变与语义色 */
      --accent-gradient: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
      --success-color: #22c55e;
      --warning-color: #f59e0b;
      --danger-color: #ef4444;
      --success-bg: rgba(34, 197, 94, 0.15);
      --warning-bg: rgba(245, 158, 11, 0.15);
      --danger-bg: rgba(239, 68, 68, 0.15);
      --shadow-color: rgba(100, 116, 139, 0.2);
      --separator-color: rgba(0, 0, 0, 0.08);
  `

  const bgStyle = isDark 
    ? `background: radial-gradient(circle at 0% 0%, #1a2332 0%, transparent 50%), 
                  radial-gradient(circle at 100% 100%, #161b22 0%, transparent 50%),
                  var(--bg-color);`
    : `background: radial-gradient(circle at 0% 0%, #e0f2fe 0%, transparent 50%), 
                  radial-gradient(circle at 100% 100%, #f0f9ff 0%, transparent 50%),
                  var(--bg-color);`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      ${isDark ? darkVars : lightVars}
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      position: relative;
      margin: 0;
      padding: 32px;
      font-family: 'Roboto Mono', 'Trebuchet MS', 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      ${bgStyle}
      width: ${width}px;
      box-sizing: border-box;
      color: var(--text-primary);
    }
    
    .container {
      position: relative;
      background-color: var(--card-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      padding: 28px;
      border-radius: 20px;
      box-shadow: 0 20px 48px -12px var(--shadow-color), 
                  0 0 0 1px var(--card-ring),
                  inset 0 0 0 1px var(--inner-border);
    }
    
    /* Header */
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--separator-color);
    }
    
    .avatar {
      width: 48px;
      height: 48px;
      background: var(--accent-gradient);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      box-shadow: 0 8px 16px rgba(88, 166, 255, 0.3);
      flex-shrink: 0;
    }
    
    .header-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.3px;
      line-height: 1.2;
    }
    
    /* 用户名标签 - 右侧胶囊样式 */
    .user-info {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
      background: var(--item-bg);
      padding: 6px 14px;
      border-radius: 50px;
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      white-space: nowrap;
    }
    
    .user-info::before {
      content: '';
      display: block;
      width: 6px;
      height: 6px;
      background-color: var(--success-color);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--success-color);
    }
    
    /* Footer */
    .footer {
      position: absolute;
      bottom: 8px;
      right: 12px;
      font-size: 11px;
      color: var(--text-secondary);
      opacity: 0.6;
    }
    
    /* Section */
    .section {
      margin-bottom: 24px;
    }
    
    .section:last-child {
      margin-bottom: 0;
    }
    
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: currentColor;
      opacity: 0.15;
    }
    
    /* Balance Card - 主余额展示 */
    .balance-section {
      background: var(--accent-gradient);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 20px;
      text-align: center;
      box-shadow: 0 12px 32px rgba(88, 166, 255, 0.25);
    }
    
    .balance-label {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
      margin-bottom: 8px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    
    .balance-value {
      font-size: 42px;
      font-weight: 700;
      color: white;
      margin-bottom: 4px;
      letter-spacing: -1px;
    }
    
    .balance-currency {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
    }
    
    /* Grid Layout */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 20px;
    }
    
    .grid-item {
      background: var(--item-bg);
      border-radius: 12px;
      padding: 18px;
      border: 1px solid var(--border-color);
      /* 统一阴影，增加立体感 */
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    
    .grid-item.demand { border-left: 3px solid var(--success-color); }
    .grid-item.fixed { border-left: 3px solid var(--accent-color); }
    .grid-item.cash { border-left: 3px solid var(--warning-color); }
    .grid-item.bank { border-left: 3px solid #a78bfa; }
    
    .item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .item-icon {
      font-size: 18px;
    }
    
    .item-title {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }
    
    .item-value {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 6px;
      letter-spacing: -0.5px;
    }
    
    .item-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
      opacity: 0.8;
    }
    
    /* Info Card */
    .card {
      background: var(--item-bg);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    
    .card.success { border-left: 3px solid var(--success-color); }
    .card.info { border-left: 3px solid var(--accent-color); }
    .card.warning { border-left: 3px solid var(--warning-color); }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--separator-color);
    }
    
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    
    .info-row:first-child {
      padding-top: 0;
    }
    
    .info-label {
      font-size: 14px;
      color: var(--text-secondary);
    }
    
    .info-value {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .info-value.success { color: var(--success-color); }
    .info-value.error { color: var(--danger-color); }
    .info-value.highlight { color: var(--accent-color); }
    
    /* Command Grid */
    .cmd-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .cmd-item {
      background: var(--item-bg);
      border-radius: 12px;
      padding: 20px 16px;
      text-align: center;
      border: 1px solid var(--border-color);
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    
    .cmd-item:hover {
      border-color: var(--accent-color);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(88, 166, 255, 0.15);
    }
    
    .cmd-icon {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .cmd-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    
    .cmd-desc {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    /* Prompt Box */
    .prompt-box {
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    
    .prompt-box.info {
      background: rgba(88, 166, 255, 0.1);
      border-color: rgba(88, 166, 255, 0.3);
    }
    
    .prompt-box.warning {
      background: var(--warning-bg);
      border-color: rgba(251, 191, 36, 0.3);
    }
    
    .prompt-box.success {
      background: var(--success-bg);
      border-color: rgba(74, 222, 128, 0.3);
    }
    
    .prompt-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    
    .prompt-message {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    
    /* Confirm Dialog */
    .confirm-dialog {
      background: var(--item-bg);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px var(--shadow-color);
    }
    
    .confirm-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
      text-align: center;
    }
    
    .confirm-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid var(--separator-color);
    }
    
    .confirm-row:last-child {
      border-bottom: none;
    }
    
    .confirm-label {
      font-size: 14px;
      color: var(--text-secondary);
    }
    
    .confirm-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .confirm-hint {
      margin-top: 16px;
      padding: 12px;
      background: rgba(88, 166, 255, 0.1);
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
      color: var(--accent-color);
    }
    
    /* List Item */
    .list-item {
      background: var(--item-bg);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    
    .list-left {
      flex: 1;
    }
    
    .list-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    
    .list-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .list-right {
      text-align: right;
    }
    
    .list-amount {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .list-status {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      margin-top: 4px;
      display: inline-block;
      text-transform: uppercase;
    }
    
    .list-status.active {
      background: var(--success-bg);
      color: var(--success-color);
    }
    
    .list-status.pending {
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent-color);
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">Powered by Koishi Monetary Bank</div>
  </div>
</body>
</html>
  `
}

/**
 * 页面头部
 */
export function renderHeader(icon: string, title: string, username: string): string {
  return `
    <div class="header">
      <div class="avatar">${icon}</div>
      <div class="header-content">
        <div class="title">${title}</div>
      </div>
      <div class="user-info">${username}</div>
    </div>
  `
}

/**
 * 余额卡片（大标题样式）
 */
export function renderBalanceCard(label: string, value: number, currency: string): string {
  return `
    <div class="balance-section">
      <div class="balance-label">${label}</div>
      <div class="balance-value">${value.toLocaleString()}</div>
      <div class="balance-currency">${currency}</div>
    </div>
  `
}

/**
 * 网格项
 */
export function renderGridItem(
  icon: string,
  title: string,
  value: number,
  subtitle: string,
  type: 'demand' | 'fixed' | 'cash' | 'bank'
): string {
  return `
    <div class="grid-item ${type}">
      <div class="item-header">
        <span class="item-icon">${icon}</span>
        <span class="item-title">${title}</span>
      </div>
      <div class="item-value">${value.toLocaleString()}</div>
      <div class="item-subtitle">${subtitle}</div>
    </div>
  `
}

/**
 * 信息行
 */
export function renderInfoRow(label: string, value: string, valueClass: '' | 'success' | 'error' = ''): string {
  return `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value ${valueClass}">${value}</span>
    </div>
  `
}

/**
 * 命令按钮网格
 */
export function renderCommandGrid(commands: Array<{ icon: string; name: string; desc: string }>): string {
  const items = commands.map(cmd => `
    <div class="cmd-item">
      <div class="cmd-icon">${cmd.icon}</div>
      <div class="cmd-name">${cmd.name}</div>
      <div class="cmd-desc">${cmd.desc}</div>
    </div>
  `).join('')
  
  return `<div class="cmd-grid">${items}</div>`
}

/**
 * 提示信息框
 */
export function renderPromptBox(title: string, message: string, type: 'info' | 'warning' | 'success' = 'info'): string {
  return `
    <div class="prompt-box ${type}">
      <div class="prompt-title">${title}</div>
      <div class="prompt-message">${message}</div>
    </div>
  `
}

/**
 * 确认对话框样式
 */
export function renderConfirmDialog(title: string, items: Array<{ label: string; value: string }>): string {
  const rows = items.map(item => `
    <div class="confirm-row">
      <span class="confirm-label">${item.label}</span>
      <span class="confirm-value">${item.value}</span>
    </div>
  `).join('')
  
  return `
    <div class="confirm-dialog">
      <div class="confirm-title">${title}</div>
      ${rows}
      <div class="confirm-hint">请回复 yes 或 y 确认，其他内容取消</div>
    </div>
  `
}