export interface PageShellParams {
  width: number
  isDark: boolean
  widthClasses: string
  darkVars: string
  lightVars: string
  bgStyle: string
  fontRegularUrl: string
  fontBoldUrl: string
  content: string
}

/**
 * 页面外壳：完整 HTML 文档（含全局样式与自适应防溢出体系），逐字保留原实现
 */
export function renderPageShell(params: PageShellParams): string {
  const { width, isDark, widthClasses, darkVars, lightVars, bgStyle, fontRegularUrl, fontBoldUrl, content } = params
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @font-face {
      font-family: 'Roboto Mono';
      src: url('${fontRegularUrl}') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'Roboto Mono';
      src: url('${fontBoldUrl}') format('truetype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

    :root {
      ${isDark ? darkVars : lightVars}
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      position: relative;
      margin: 0;
      padding: 32px;
      font-family: 'Roboto Mono', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      ${bgStyle}
      width: ${width}px;
      box-sizing: border-box;
      color: var(--text-primary);
    }
    
    .container {
      container-type: inline-size;
      container-name: page-container;
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
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--separator-color);
      min-width: 0;
      flex-wrap: nowrap;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
      flex: 1 1 auto;
      overflow: hidden;
    }
    
    .avatar, .header-icon-box {
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

    .avatar-icon, .header-icon {
      width: 24px;
      height: 24px;
      display: block;
    }
    
    .header-content, .header-titles {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      overflow: hidden;
    }
    
    .title, .header-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.3px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .header-subtitle {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .header-time {
      height: 40px;
      box-sizing: border-box;
      padding: 0 16px;
      border-radius: 50px;
      background: var(--item-bg);
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .time-icon {
      width: 14px;
      height: 14px;
      display: block;
      opacity: 0.85;
    }
    
    /* 用户名标签 - 右侧胶囊样式（与 header-time 统一高度与圆角） */
    .user-info, .user-capsule {
      height: 40px;
      box-sizing: border-box;
      font-size: 14px;
      color: var(--text-secondary);
      font-weight: 500;
      background: var(--item-bg);
      padding: 0 16px 0 5px;
      border-radius: 50px;
      border: 1px solid var(--border-color);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      white-space: nowrap;
      flex-shrink: 0;
      max-width: 240px;
    }

    .user-avatar-img {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      object-fit: cover;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      display: block;
      flex-shrink: 0;
    }

    .user-avatar-text {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--accent-gradient);
      color: white;
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(88, 166, 255, 0.3);
      flex-shrink: 0;
    }

    .user-name-text {
      font-size: 14px;
      color: var(--text-primary);
      font-weight: 600;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
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
      font-size: 12px;
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
      min-width: 0;
      overflow: hidden;
    }
    
    .balance-label {
      font-size: 15px;
      color: rgba(255, 255, 255, 0.85);
      margin-bottom: 8px;
      font-weight: 600;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .balance-value {
      font-size: 42px;
      font-weight: 700;
      color: white;
      margin-bottom: 4px;
      letter-spacing: -1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    
    .balance-currency {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .balance-sublabel {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.75);
      margin-top: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.2px;
    }
    
    /* Grid Layout - 严格两列且防挤压防越界 */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
      min-width: 0;
      overflow: hidden;
    }
    
    .grid-item.demand { border-left: 3px solid var(--success-color); }
    .grid-item.fixed { border-left: 3px solid var(--accent-color); }
    .grid-item.cash { border-left: 3px solid var(--warning-color); }
    .grid-item.bank { border-left: 3px solid #a78bfa; }
    .grid-item.frozen { border-left: 3px solid #f97316; }
    
    .item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      min-width: 0;
    }
    
    .item-icon {
      width: 18px;
      height: 18px;
      display: block;
      flex-shrink: 0;
    }
    
    .item-title {
      font-size: 15px;
      color: var(--text-secondary);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    
    .item-value {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 6px;
      letter-spacing: -0.5px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    
    .item-subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    
    /* Info Card */
    .card {
      background: var(--item-bg);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      min-width: 0;
      overflow: hidden;
    }
    
    .card.success { border-left: 3px solid var(--success-color); }
    .card.info { border-left: 3px solid var(--accent-color); }
    .card.warning { border-left: 3px solid var(--warning-color); }
    .card.danger { border-left: 3px solid var(--danger-color); }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--separator-color);
      gap: 16px;
      min-width: 0;
    }
    
    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    
    .info-row:first-child {
      padding-top: 0;
    }
    
    .info-label {
      font-size: 15px;
      color: var(--text-secondary);
      white-space: nowrap;
      flex-shrink: 0;
    }
    
    .info-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      text-align: right;
      word-break: break-all;
      overflow-wrap: anywhere;
      min-width: 0;
      max-width: 65%;
    }
    
    .info-value.success { color: var(--success-color); }
    .info-value.error { color: var(--danger-color); }
    .info-value.highlight { color: var(--accent-color); }
    
    /* Command Grid */
    .cmd-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    
    .cmd-item {
      background: var(--item-bg);
      border-radius: 12px;
      padding: 16px;
      text-align: left;
      border: 1px solid var(--border-color);
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }
    
    .cmd-item:hover {
      border-color: var(--accent-color);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(88, 166, 255, 0.15);
    }
    
    .cmd-icon {
      width: 32px;
      height: 32px;
      display: block;
      flex-shrink: 0;
    }

    .cmd-content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .cmd-name {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 4px;
      letter-spacing: -0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .cmd-desc {
      font-size: 13px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    /* Prompt Box */
    .prompt-box {
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      min-width: 0;
      overflow: hidden;
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
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
      word-break: break-word;
    }
    
    .prompt-message {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
      word-break: break-word;
    }
    
    /* Confirm Dialog */
    .confirm-dialog {
      background: var(--item-bg);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px var(--shadow-color);
      min-width: 0;
      overflow: hidden;
    }
    
    .confirm-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
      text-align: center;
      word-break: break-word;
    }
    
    .confirm-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--separator-color);
      gap: 16px;
      min-width: 0;
    }
    
    .confirm-row:last-child {
      border-bottom: none;
    }
    
    .confirm-label {
      font-size: 15px;
      color: var(--text-secondary);
      white-space: nowrap;
      flex-shrink: 0;
    }
    
    .confirm-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      text-align: right;
      word-break: break-all;
      overflow-wrap: anywhere;
      min-width: 0;
      max-width: 65%;
    }
    
    .confirm-hint {
      margin-top: 16px;
      padding: 12px;
      background: rgba(88, 166, 255, 0.1);
      border-radius: 8px;
      text-align: center;
      font-size: 14px;
      color: var(--accent-color);
      word-break: break-word;
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
      min-width: 0;
      overflow: hidden;
      gap: 12px;
    }
    
    .list-left {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .list-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .list-subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .list-right {
      text-align: right;
      flex-shrink: 0;
    }
    
    .list-amount {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .list-status {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      margin-top: 4px;
      display: inline-block;
      text-transform: uppercase;
      white-space: nowrap;
    }
    
    .list-status.active {
      background: var(--success-bg);
      color: var(--success-color);
    }
    
    .list-status.pending {
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent-color);
    }

    /* Help Card Styles (Large & High Contrast) */
    .help-card {
      background: var(--item-bg);
      border-radius: 14px;
      padding: 18px 22px;
      margin-bottom: 14px;
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
      border-left: 4px solid var(--accent-color);
      min-width: 0;
      overflow: hidden;
    }
    
    .help-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    
    .help-cmd-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex-shrink: 1;
    }
    
    .help-cmd-name {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .help-cmd-badge {
      font-size: 12px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 6px;
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent-color);
      text-transform: uppercase;
      white-space: nowrap;
      flex-shrink: 0;
    }
    
    .help-cmd-syntax {
      font-size: 15px;
      font-family: 'Roboto Mono', monospace;
      color: var(--accent-color);
      background: rgba(88, 166, 255, 0.1);
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 400px;
      flex-shrink: 0;
    }
    
    .help-cmd-desc {
      font-size: 16px;
      color: var(--text-primary);
      margin-top: 10px;
      line-height: 1.5;
      word-break: break-word;
    }
    
    .help-cmd-options {
      font-size: 14px;
      color: var(--text-secondary);
      opacity: 0.85;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--separator-color);
      word-break: break-word;
    }

    .icon-fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      font-size: 14px;
    }

    /* ========================================================= */
    /* 响应式排版与页头防重叠：过窄时自动隐藏部分页头内容            */
    /* ========================================================= */

    /* 1. 紧凑模式 (width <= 560px 或容器 <= 480px)：减少内边距 */
    body.is-compact {
      padding: 20px;
    }
    .is-compact .container {
      padding: 20px;
    }

    /* 2. 较窄模式 (width <= 680px 或容器 <= 600px)：自动隐藏时间徽章与副标题 */
    .is-narrow .header-time,
    .is-narrow .header-subtitle {
      display: none !important;
    }

    @container page-container (max-width: 600px) {
      .header-time,
      .header-subtitle {
        display: none !important;
      }
    }

    /* 3. 紧凑模式 (width <= 560px 或容器 <= 460px)：用户名折叠，仅保留头像圆胶囊 */
    .is-compact .user-avatar-img ~ .user-name-text,
    .is-compact .user-avatar-text ~ .user-name-text {
      display: none !important;
    }
    .is-compact .user-capsule {
      width: 40px !important;
      height: 40px !important;
      padding: 0 !important;
      justify-content: center !important;
      border-radius: 50% !important;
      box-sizing: border-box !important;
      flex-shrink: 0 !important;
    }

    @container page-container (max-width: 460px) {
      .user-avatar-img ~ .user-name-text,
      .user-avatar-text ~ .user-name-text {
        display: none !important;
      }
      .user-capsule {
        width: 40px !important;
        height: 40px !important;
        padding: 0 !important;
        justify-content: center !important;
        border-radius: 50% !important;
        box-sizing: border-box !important;
        flex-shrink: 0 !important;
      }
    }

    /* 4. 极窄模式 (width <= 460px 或容器 <= 380px)：缩减图标与主标题 */
    .is-ultranarrow .header-icon-box {
      width: 38px !important;
      height: 38px !important;
      border-radius: 10px !important;
    }
    .is-ultranarrow .header-icon {
      width: 20px !important;
      height: 20px !important;
    }
    .is-ultranarrow .header-title {
      font-size: 18px !important;
    }

    @container page-container (max-width: 380px) {
      .header-icon-box {
        width: 38px !important;
        height: 38px !important;
        border-radius: 10px !important;
      }
      .header-icon {
        width: 20px !important;
        height: 20px !important;
      }
      .header-title {
        font-size: 18px !important;
      }
    }

    /* 5. 补充针对小屏幕视口的媒体查询 */
    @media (max-width: 680px) {
      .header-time,
      .header-subtitle {
        display: none !important;
      }
    }
    @media (max-width: 560px) {
      .user-avatar-img ~ .user-name-text,
      .user-avatar-text ~ .user-name-text {
        display: none !important;
      }
      .user-capsule {
        width: 40px !important;
        height: 40px !important;
        padding: 0 !important;
        justify-content: center !important;
        border-radius: 50% !important;
      }
    }
  </style>
</head>
<body class="${widthClasses}">
  <div class="container">
    ${content}
    <div class="footer">Powered by Koishi Monetary Bank</div>
  </div>
</body>
</html>
  `;
}
