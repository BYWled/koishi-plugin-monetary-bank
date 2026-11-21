import { renderIcon } from './assets'

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
