import { getAssetUrl } from './assets'
import { getThemeVars } from './theme'
import { renderPageShell } from './shell'

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

  const { darkVars, lightVars, bgStyle } = getThemeVars(isDark)

  return renderPageShell({
    width,
    isDark,
    widthClasses,
    darkVars,
    lightVars,
    bgStyle,
    fontRegularUrl,
    fontBoldUrl,
    content,
  })
}
