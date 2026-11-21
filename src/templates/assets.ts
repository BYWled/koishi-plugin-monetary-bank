import path from "path";
import { pathToFileURL } from "url";
import { ICON_SVGS } from "./icons.generated";

/**
 * HTML模板工具文件
 * 提供统一的样式和布局模板
 * 设计风格：深色玻璃拟态，与 monetary-bourse 保持一致
 */

// 仅字体仍走文件 URL；图标已全部内联（icons.generated.ts），运行时零文件依赖
const ASSET_BASE_PATH = path.resolve(__dirname, "..", "..", "assets");
const ASSET_BASE_URL = pathToFileURL(ASSET_BASE_PATH)
  .toString()
  .replace(/\/$/, "");

export function getAssetUrl(relativePath: string): string {
  return `${ASSET_BASE_URL}/${relativePath}`;
}

/**
 * 渲染内联 SVG 图标：构建期已将 assets/icons/*.svg 生成到 icons.generated.ts，
 * 不再依赖文件系统与 file:// URL（规避生产环境 assets 缺失/安全策略导致的坏图）。
 */
export function renderIcon(iconName: string, className: string, alt: string): string {
  const svg = ICON_SVGS[String(iconName || "").toLowerCase()];
  if (!svg) {
    return `<span class="${className} icon-fallback" aria-hidden="true">?</span>`;
  }

  // 将 class 注入根 <svg> 标签，尺寸与样式沿用原 CSS 类（img 与 svg 同规则）
  const inlined = svg.replace(/<svg\b/, `<svg class="${className}" role="img" aria-label="${alt}"`);
  return inlined;
}
