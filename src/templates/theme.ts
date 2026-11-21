/**
 * 主题配色变量（深色/浅色玻璃拟态）
 */
export function getThemeVars(isDark: boolean): { darkVars: string; lightVars: string; bgStyle: string } {
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
  return { darkVars, lightVars, bgStyle }
}
