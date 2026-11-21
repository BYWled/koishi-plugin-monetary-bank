import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * HTML模板工具文件
 * 提供统一的样式和布局模板
 * 设计风格：深色玻璃拟态，与 monetary-bourse 保持一致
 */

const ASSET_BASE_PATH = path.resolve(__dirname, "..", "..", "assets");
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

export function getAssetUrl(relativePath: string): string {
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

export function renderIcon(iconName: string, className: string, alt: string): string {
  const src = getIconUrl(iconName);
  if (!src) {
    return `<span class="${className} icon-fallback" aria-hidden="true">?</span>`;
  }

  return `<img class="${className}" src="${src}" alt="${alt}" />`;
}
