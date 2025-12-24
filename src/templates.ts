/**
 * HTML模板工具文件
 * 提供统一的样式和布局模板
 */

/**
 * 通用HTML模板基础
 */
export function getBaseTemplate(content: string, width: number = 800): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px;
      padding: 28px;
      font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: linear-gradient(135deg, #eef2f7 0%, #f5f7fb 100%);
      color: #2b2b2b;
    }
    .container {
      background: radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.08), transparent 35%),
                  radial-gradient(circle at 80% 0%, rgba(118, 75, 162, 0.08), transparent 30%),
                  #ffffff;
      border-radius: 18px;
      padding: 30px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.6);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      padding-bottom: 18px;
      border-bottom: 1px solid #e6e8ee;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .icon { font-size: 30px; }
    .title { font-size: 23px; font-weight: 650; color: #1f1f1f; }
    .username {
      font-size: 15px;
      color: #4a5568;
      padding: 6px 14px;
      background: #f2f4f7;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
    }
    .footer {
      text-align: center;
      padding-top: 18px;
      margin-top: 22px;
      border-top: 1px solid #e6e8ee;
      color: #9aa0b5;
      font-size: 12px;
    }
    
    /* 卡片样式 */
    .card {
      background: linear-gradient(180deg, #ffffff 0%, #fdfdff 100%);
      border-radius: 14px;
      padding: 22px;
      margin-bottom: 18px;
      border: 1px solid #eef1f5;
      box-shadow: 0 12px 30px rgba(31, 41, 55, 0.08);
    }
    .card.success { border-left: 4px solid #4ade80; }
    .card.info { border-left: 4px solid #60a5fa; }
    .card.warning { border-left: 4px solid #fbbf24; }
    
    /* 余额展示 */
    .balance-section {
      text-align: center;
      padding: 30px;
      background: linear-gradient(135deg, #5b7cfa 0%, #7f5af0 100%);
      border-radius: 14px;
      margin-bottom: 22px;
      color: white;
      box-shadow: 0 14px 40px rgba(89, 114, 255, 0.28);
    }
      .balance-label { 
        font-size: 13px; 
        opacity: 0.92; 
        margin-bottom: 6px; 
        letter-spacing: 0.5px; 
      }
      .balance-value { 
        font-size: 44px; 
        font-weight: 760; 
        margin-bottom: 4px; 
      }
    .balance-currency {
      font-size: 20px;
      opacity: 0.9;
    }
    
    /* 网格布局 */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
      .grid-item {
        background: #fafafa;
        border-radius: 12px;
        padding: 24px;
        border-left: 4px solid;
      }
    .grid-item.demand {
      border-left-color: #52c41a;
    }
    .grid-item.fixed {
      border-left-color: #1890ff;
    }
    .grid-item.cash {
      border-left-color: #fa8c16;
    }
    .grid-item.bank {
      border-left-color: #13c2c2;
    }
    
    .item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .item-icon {
      font-size: 20px;
    }
    .item-title {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }
    .item-value {
      font-size: 32px;
      font-weight: 700;
      color: #333;
      margin-bottom: 8px;
    }
    .item-subtitle {
      font-size: 14px;
      color: #999;
    }
    
    /* 信息行 */
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-size: 14px;
      color: #666;
    }
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .info-value.success {
      color: #52c41a;
    }
    .info-value.error {
      color: #f5222d;
    }
    
    /* 列表样式 */
    .list-item {
      background: #fafafa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .list-item:hover {
      background: #f0f0f0;
    }
    .list-left {
      flex: 1;
    }
    .list-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }
    .list-subtitle {
      font-size: 12px;
      color: #999;
    }
    .list-right {
      text-align: right;
    }
    .list-amount {
      font-size: 18px;
      font-weight: 700;
      color: #333;
    }
    .list-status {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 4px;
      display: inline-block;
    }
    .list-status.active {
      background: #f6ffed;
      color: #52c41a;
    }
    .list-status.pending {
      background: #e6f7ff;
      color: #1890ff;
    }
    
    /* 命令网格 */
    .cmd-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .cmd-item {
      background: #fafafa;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid transparent;
    }
    .cmd-item:hover {
      background: #f0f0f0;
      border-color: #667eea;
      transform: translateY(-2px);
    }
    .cmd-icon {
      font-size: 36px;
      margin-bottom: 12px;
    }
    .cmd-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .cmd-desc {
      font-size: 12px;
      color: #999;
    }
    
    /* 提示框 */
    .prompt-box {
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      border-left: 4px solid;
    }
    .prompt-box.info {
      background: #e6f7ff;
      border-left-color: #1890ff;
    }
    .prompt-box.warning {
      background: #fffbe6;
      border-left-color: #faad14;
    }
    .prompt-box.success {
      background: #f6ffed;
      border-left-color: #52c41a;
    }
    .prompt-title {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .prompt-message {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
    }
    
    /* 确认对话框 */
    .confirm-dialog {
      background: #fafafa;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .confirm-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 20px;
      text-align: center;
    }
    .confirm-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e8e8e8;
    }
    .confirm-row:last-child {
      border-bottom: none;
    }
    .confirm-label {
      font-size: 14px;
      color: #666;
    }
    .confirm-value {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    .confirm-hint {
      margin-top: 20px;
      padding: 12px;
      background: #e6f7ff;
      border-radius: 8px;
      text-align: center;
      font-size: 13px;
      color: #1890ff;
    }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      Powered by Koishi Monetary Bank
    </div>
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
      <div class="header-left">
        <span class="icon">${icon}</span>
        <span class="title">${title}</span>
      </div>
      <div class="username">${username}</div>
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
  
  return `
    <div class="cmd-grid">
      ${items}
    </div>
  `
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
      <span class="confirm-label">${item.label}：</span>
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
