import { Logger } from 'koishi'

export const logger = new Logger('[monetary-bank]')

// 全局 debug 开关（由配置控制），用于控制是否打印 info/success 级别日志
let debugEnabled = true

export function setDebugEnabled(flag: boolean) {
  debugEnabled = flag
}

export function logInfo(...args: any[]) {
  if (debugEnabled) {
    ; (logger as any).info && (logger as any).info.apply(logger, args)
  }
}

export function logSuccess(...args: any[]) {
  if (!debugEnabled) return
  // @ts-ignore
  if (typeof (logger as any).success === 'function') (logger as any).success.apply(logger, args)
  else (logger as any).info && (logger as any).info.apply(logger, args)
}
