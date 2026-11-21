import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * HTML模板工具文件
 * 提供统一的样式和布局模板
 * 设计风格：深色玻璃拟态，与 monetary-bourse 保持一致
 */

const ASSET_BASE_PATH = path.resolve(__dirname, "..", "assets");
const ASSET_BASE_URL = pathToFileURL(ASSET_BASE_PATH)
  .toString()
  .replace(/\/$/, "");

const ICON_MAP: Record<string, string> = {
  bank: "icons/bank.svg",
  balance: "icons/balance.svg",
  cash: "icons/cash.svg",
  demand: "icons/demand.svg",
  fixed: "icons/fixed.svg",
  deposit: "icons/deposit.svg",
  withdraw: "icons/withdraw.svg",
  manage: "icons/manage.svg",
  success: "icons/success.svg",
  warning: "icons/warning.svg",
  clock: "icons/clock.svg",
  transfer: "icons/withdraw.svg",
  freeze: "icons/clock.svg",
  help: "icons/manage.svg",
};

function getAssetUrl(relativePath: string): string {
  return `${ASSET_BASE_URL}/${relativePath}`;
}

const ICON_DATA_URLS: Record<string, string> = {};

for (const [key, file] of Object.entries(ICON_MAP)) {
  try {
    const absolutePath = path.resolve(ASSET_BASE_PATH, file);
    const buffer = fs.readFileSync(absolutePath);
    ICON_DATA_URLS[key] =
      `data:image/svg+xml;base64,${buffer.toString("base64")}`;
  } catch {
    ICON_DATA_URLS[key] = "";
  }
}

function getIconUrl(iconName: string): string {
  const key = String(iconName || "").toLowerCase();
  const dataUrl = ICON_DATA_URLS[key];
  if (dataUrl) return dataUrl;

  const file = ICON_MAP[key];
  return file ? getAssetUrl(file) : "";
}

function renderIcon(iconName: string, className: string, alt: string): string {
  const src = getIconUrl(iconName);
  if (!src) {
    return `<span class="${className} icon-fallback" aria-hidden="true">?</span>`;
  }

  return `<img class="${className}" src="${src}" alt="${alt}" />`;
}

/**
 * 通用HTML模板基础
 */
export function getBaseTemplate(
  content: string,
  width: number = 520,
  isDark: boolean = false,
): string {
  const fontRegularUrl = getAssetUrl("fonts/RobotoMono-Regular.ttf");
  const fontBoldUrl = getAssetUrl("fonts/RobotoMono-Bold.ttf");

  const isNarrow = width <= 680;
  const isCompact = width <= 560;
  const isUltraNarrow = width <= 460;

  const widthClasses = [
    isNarrow ? "is-narrow" : "",
    isCompact ? "is-compact" : "",
    isUltraNarrow ? "is-ultranarrow" : "",
  ]
    .filter(Boolean)
    .join(" ");
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
  `;

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
  `;

  const bgStyle = isDark
    ? `background: radial-gradient(circle at 0% 0%, #1a2332 0%, transparent 50%), 
                  radial-gradient(circle at 100% 100%, #161b22 0%, transparent 50%),
                  var(--bg-color);`
    : `background: radial-gradient(circle at 0% 0%, #e0f2fe 0%, transparent 50%), 
                  radial-gradient(circle at 100% 100%, #f0f9ff 0%, transparent 50%),
                  var(--bg-color);`;

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

export interface HeaderConfig {
  showAvatar?: boolean;
  showUsername?: boolean;
  bankTitle?: string;
  showTime?: boolean;
}

export interface NumberFormatOptions {
  /** 格式化单位：auto(超长自动缩写), zh(千/万/亿), en(K/M/B/T), none(不缩写) */
  unit?: "none" | "zh" | "en" | "auto";
  /** 自动缩写触发阈值，默认 10,000,000 */
  threshold?: number;
  /** 小数点后保留位数，默认 2 */
  precision?: number;
}

/**
 * 格式化存款与金额数字，预防极端大数导致溢出换行
 */
export function formatAmount(
  val: number | string | undefined | null,
  options?: NumberFormatOptions,
): string {
  if (val === undefined || val === null) return "0";
  if (typeof val === "string") {
    const num = Number(val);
    if (isNaN(num)) return val;
    val = num;
  }

  const unit = options?.unit || "auto";
  const threshold = options?.threshold ?? 10000000;
  const precision = options?.precision ?? 2;

  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";

  // 1. 不缩写
  if (unit === "none") {
    return val.toLocaleString();
  }

  // 2. 自动判断：未超阈值时显示标准千分位
  if (unit === "auto" && abs < threshold) {
    return val.toLocaleString();
  }

  // 3. 英文缩写 (K/M/B/T)
  if (unit === "en") {
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(precision).replace(/\.?0+$/, "")}T`;
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(precision).replace(/\.?0+$/, "")}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(precision).replace(/\.?0+$/, "")}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(precision).replace(/\.?0+$/, "")}K`;
    return val.toLocaleString();
  }

  // 4. 中文单位（千/万/亿/兆）
  if (unit === "zh" || unit === "auto") {
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(precision).replace(/\.?0+$/, "")}兆`;
    if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(precision).replace(/\.?0+$/, "")}亿`;
    if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(precision).replace(/\.?0+$/, "")}万`;
    if (unit === "zh" && abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(precision).replace(/\.?0+$/, "")}千`;
    return val.toLocaleString();
  }

  return val.toLocaleString();
}

/**
 * 页面头部（支持配置、头像与标题分离、时间组件高度圆角统一）
 */
export function renderHeader(
  icon: string,
  title: string,
  username: string,
  avatarUrl?: string,
  headerConfig?: HeaderConfig,
): string {
  const showAvatar = headerConfig?.showAvatar !== false;
  const showUsername = headerConfig?.showUsername !== false;
  const bankTitle = headerConfig?.bankTitle || "MONETARY BANK";
  const showTime = headerConfig?.showTime === true;

  const initial = (username || "U").trim().substring(0, 1).toUpperCase();
  const avatarHtml = avatarUrl
    ? `<img class="user-avatar-img" src="${avatarUrl}" alt="${username} 头像" onerror="this.outerHTML='<div class=\\'user-avatar-text\\'>${initial}</div>'" />`
    : `<div class="user-avatar-text">${initial}</div>`;

  const timeHtml = showTime
    ? `<div class="header-time">${renderIcon("clock", "time-icon", "时间")}<span>${new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}</span></div>`
    : "";

  const userHtml =
    showAvatar || showUsername
      ? `
    <div class="user-capsule" title="${username}">
      ${showAvatar ? avatarHtml : ""}
      ${showUsername ? `<span class="user-name-text">${username}</span>` : ""}
    </div>
  `
      : "";

  return `
    <div class="header">
      <div class="header-left">
        <div class="header-icon-box">${renderIcon(icon, "header-icon", `${title} 图标`)}</div>
        <div class="header-titles">
          <div class="header-title">${title}</div>
          <div class="header-subtitle">${bankTitle}</div>
        </div>
      </div>
      <div class="header-right">
        ${timeHtml}
        ${userHtml}
      </div>
    </div>
  `;
}

/**
 * 余额卡片（大标题样式，支持数字缩写与副标题）
 */
export function renderBalanceCard(
  label: string,
  value: number | string,
  currency: string,
  subLabel?: string,
  options?: NumberFormatOptions,
): string {
  const formattedValue = typeof value === "number" ? formatAmount(value, options) : value;
  const rawTitle = typeof value === "number" ? value.toLocaleString() : value;
  return `
    <div class="balance-section">
      <div class="balance-label">${label}</div>
      <div class="balance-value" title="${rawTitle}">${formattedValue}</div>
      <div class="balance-currency">${currency}</div>
      ${subLabel ? `<div class="balance-sublabel">${subLabel}</div>` : ""}
    </div>
  `;
}

/**
 * 网格项（支持数字缩写与极端文本防溢出）
 */
export function renderGridItem(
  icon: string,
  title: string,
  value: number | string,
  subtitle: string,
  type: "demand" | "fixed" | "cash" | "bank" | "frozen",
  options?: NumberFormatOptions,
): string {
  const formattedValue = typeof value === "number" ? formatAmount(value, options) : value;
  const rawTitle = typeof value === "number" ? value.toLocaleString() : value;
  return `
    <div class="grid-item ${type}">
      <div class="item-header">
        ${renderIcon(icon, "item-icon", `${title} 图标`)}
        <span class="item-title">${title}</span>
      </div>
      <div class="item-value" title="${rawTitle}">${formattedValue}</div>
      <div class="item-subtitle" title="${subtitle}">${subtitle}</div>
    </div>
  `;
}

/**
 * 信息行
 */
export function renderInfoRow(
  label: string,
  value: string,
  valueClass: "" | "success" | "error" | "highlight" = "",
): string {
  return `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value ${valueClass}">${value}</span>
    </div>
  `;
}

/**
 * 命令按钮网格
 */
export function renderCommandGrid(
  commands: Array<{ icon: string; name: string; desc: string }>,
): string {
  const items = commands
    .map(
      (cmd) => `
    <div class="cmd-item">
      ${renderIcon(cmd.icon, "cmd-icon", `${cmd.name} 图标`)}
      <div class="cmd-content">
        <div class="cmd-name">${cmd.name}</div>
        <div class="cmd-desc">${cmd.desc}</div>
      </div>
    </div>
  `,
    )
    .join("");

  return `<div class="cmd-grid">${items}</div>`;
}

/**
 * 提示信息框
 */
export function renderPromptBox(
  title: string,
  message: string,
  type: "info" | "warning" | "success" = "info",
): string {
  return `
    <div class="prompt-box ${type}">
      <div class="prompt-title">${title}</div>
      <div class="prompt-message">${message}</div>
    </div>
  `;
}

/**
 * 确认对话框样式
 */
export function renderConfirmDialog(
  title: string,
  items: Array<{ label: string; value: string }>,
): string {
  const rows = items
    .map(
      (item) => `
    <div class="confirm-row">
      <span class="confirm-label">${item.label}</span>
      <span class="confirm-value">${item.value}</span>
    </div>
  `,
    )
    .join("");

  return `
    <div class="confirm-dialog">
      <div class="confirm-title">${title}</div>
      ${rows}
      <div class="confirm-hint">请回复 yes 或 y 确认，其他内容取消</div>
    </div>
  `;
}

export interface HelpCommandItem {
  name: string;
  syntax: string;
  desc: string;
  options?: string;
  category?: string;
}

/**
 * 渲染大字号、高可读性的命令列表
 */
export function renderHelpList(commands: HelpCommandItem[]): string {
  const items = commands
    .map(
      (cmd) => `
    <div class="help-card">
      <div class="help-card-header">
        <div class="help-cmd-left">
          <span class="help-cmd-name">${cmd.name}</span>
          ${cmd.category ? `<span class="help-cmd-badge">${cmd.category}</span>` : ""}
        </div>
        <span class="help-cmd-syntax">${cmd.syntax}</span>
      </div>
      <div class="help-cmd-desc">${cmd.desc}</div>
      ${cmd.options ? `<div class="help-cmd-options">${cmd.options}</div>` : ""}
    </div>
  `,
    )
    .join("");

  return `<div class="help-list">${items}</div>`;
}
