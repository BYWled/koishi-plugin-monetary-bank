export function formatDurationText(seconds: number): string {
  if (seconds <= 0) return '0秒'
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
  if (seconds % 3600 === 0) return `${seconds / 3600}小时`
  return `${(seconds / 3600).toFixed(1)}小时`
}

/**
 * 极简短格式化解冻时间（防长文本换行，例如：已冻结至 11-20 14:30）
 */
export function formatShortUnfreezeTime(unfreezeAt: Date | undefined): string {
  if (!unfreezeAt) return '即时可用'
  const d = new Date(unfreezeAt)
  if (isNaN(d.getTime())) return '即时可用'
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `已冻结至 ${m}-${day} ${h}:${min}`
}
