/**
 * 图标生成工具：读取 assets/icons/*.svg，剥离通宽背景矩形，
 * 按逐图标系数放大主体使其充满画布，输出 src/templates/icons.generated.ts。
 * 运行：node tools/generate-icons.cjs（在插件根目录）
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'icons');
const outFile = path.join(__dirname, '..', 'src', 'templates', 'icons.generated.ts');

// 名称 → [源文件, 主体放大系数]（系数按各图标主体在 64×64 画布中的占比定制，
// 目标：主体 span ≈ 52px，四周留 ~6px 呼吸边距）
const ICONS = {
  bank: ['bank', 1.18],
  balance: ['balance', 1.44],
  cash: ['cash', 1.44],
  demand: ['demand', 1.44],
  fixed: ['fixed', 1.45],
  deposit: ['deposit', 1.44],
  withdraw: ['withdraw', 1.44],
  manage: ['manage', 1.44],
  success: ['success', 1.44],
  warning: ['warning', 1.25],
  clock: ['clock', 1.44],
  // 别名：复用同源图标
  transfer: ['withdraw', 1.44],
  freeze: ['clock', 1.44],
  help: ['manage', 1.44],
};

// 剥离通宽背景矩形（避免与容器背景叠加形成双层底色）
const stripBg = (svg) =>
  svg.replace(/<rect[^>]*width="64"[^>]*height="64"[^>]*\/>\s*/g, '').trim();

// 主体绕画布中心放大
const wrapScale = (svg, s) =>
  `<g transform="translate(32 32) scale(${s}) translate(-32 -32)">${svg}</g>`;

let out = `/**
 * 图标内联 SVG（由 tools/generate-icons.cjs 生成，请勿手改；重跑该脚本即可再生成）。
 * - 已剥离 assets/icons/*.svg 自带的通宽背景矩形（容器自带背景，避免双层底色）
 * - 主体按逐图标系数放大充满画布（四周保留 ~6px 呼吸边距）
 * - 运行时零文件依赖，规避生产环境 assets 缺失/file:// 安全策略导致的坏图
 */
export const ICON_SVGS: Record<string, string> = {
`;

for (const [key, [file, scale]] of Object.entries(ICONS)) {
  const raw = fs.readFileSync(path.join(dir, file + '.svg'), 'utf8').trim();
  const svg = wrapScale(stripBg(raw), scale);
  out += `  ${JSON.stringify(key)}: ${JSON.stringify(svg)},\n`;
}

out += '}\n';
fs.writeFileSync(outFile, out, 'utf8');
console.log(`generated: ${outFile} (${Object.keys(ICONS).length} icons)`);
