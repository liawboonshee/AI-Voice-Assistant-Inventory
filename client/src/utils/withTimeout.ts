/** 合并多个 AbortSignal，任一 abort 时触发 */
export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const active = signals.filter((s) => s && !s.aborted)
  if (active.length === 0) {
    const ctrl = new AbortController()
    ctrl.abort()
    return ctrl.signal
  }
  if (active.length === 1) return active[0]!

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

/** 创建带超时的 AbortSignal，超时 reason 为 'timeout' */
export function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    try {
      controller.abort('timeout')
    } catch {
      controller.abort()
    }
  }, timeoutMs)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

export function isTimeoutAbort(signal?: AbortSignal): boolean {
  return signal?.aborted === true && signal.reason === 'timeout'
}
