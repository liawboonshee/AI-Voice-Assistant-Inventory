import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import type { PluginListenerHandle } from '@capacitor/core'
import type { VoiceAdapter, VoiceListenHandlers } from './types'

const INLINE_RESTART_DELAY_MS = 350
const PLUGIN_STOP_TIMEOUT_MS = 400

/** 将插件英文错误映射为可操作的中文提示 */
function mapSpeechError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()

  if (lower.includes('no match') || lower.includes('no speech')) {
    return '未识别到语音，请靠近麦克风清晰说话后重试'
  }
  if (lower.includes('network')) {
    return '语音识别需要联网，请检查 WiFi 或 4G 后重试'
  }
  if (lower.includes('permission') || lower.includes('not-allowed')) {
    return '麦克风权限被拒绝，请在系统设置中允许录音'
  }
  if (lower.includes('recognitionservice busy') || lower.includes('busy')) {
    return '语音识别服务忙，请稍后再试'
  }
  if (lower.includes('client side error') || lower.includes('not connected')) {
    return '本机语音识别不可用，请确认已安装 Google 语音服务，或先用文字输入'
  }
  if (raw === '0' || lower.includes('cancel')) {
    return '已取消语音识别'
  }
  return raw ? `语音识别失败：${raw}` : '语音识别失败，请重试或使用文字输入'
}

function isUserCancelled(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  return raw === '0' || raw.toLowerCase().includes('cancel')
}

export function createNativeSpeechAdapter(): VoiceAdapter {
  let partialHandle: PluginListenerHandle | null = null
  let stateHandle: PluginListenerHandle | null = null
  let handlers: VoiceListenHandlers | null = null
  let latestPartial = ''
  let finalized = false
  let androidPopupActive = false

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  /** 插件 Android 端 stop() 不回调 resolve，直接 await 会永久挂起，须加超时兜底 */
  const stopPluginSafely = async () => {
    try {
      await Promise.race([SpeechRecognition.stop(), delay(PLUGIN_STOP_TIMEOUT_MS)])
    } catch {
      // 忽略重复 stop
    }
  }

  const removeListeners = async () => {
    if (partialHandle) {
      await partialHandle.remove()
      partialHandle = null
    }
    if (stateHandle) {
      await stateHandle.remove()
      stateHandle = null
    }
    try {
      await SpeechRecognition.removeAllListeners()
    } catch {
      // 部分版本无此方法
    }
  }

  const cleanupInlineRecognizer = async () => {
    await stopPluginSafely()
    await removeListeners()
    latestPartial = ''
    handlers = null
  }

  const finalizeIfNeeded = () => {
    if (finalized || !handlers) return
    const text = latestPartial.trim()
    if (!text) return

    finalized = true
    const activeHandlers = handlers
    handlers = null
    activeHandlers.onFinal(text)
  }

  /**
   * Android 可靠路径：popup:true + await start() 取 matches。
   * Source: capacitor-community/speech-recognition Issue #118 / #91
   * （popup:false 在 Android 11–13 多机型无 partial/final 回调）
   */
  const startAndroidPopup = async (nextHandlers: VoiceListenHandlers) => {
    androidPopupActive = true
    try {
      await removeListeners()

      const result = await SpeechRecognition.start({
        language: 'zh-CN',
        maxResults: 1,
        partialResults: false,
        popup: true,
        prompt: '请说话…',
      })

      const text = result.matches?.[0]?.trim() ?? ''
      if (!text) {
        nextHandlers.onError('未识别到语音，请靠近麦克风清晰说话后重试')
        return
      }
      nextHandlers.onFinal(text)
    } catch (err) {
      if (isUserCancelled(err)) {
        nextHandlers.onError(mapSpeechError(err))
        return
      }
      throw err
    } finally {
      androidPopupActive = false
    }
  }

  /**
   * Android 备选：inline partialResults（部分机型可用）。
   * Source: Cap-go/capacitor-speech-recognition PR #2 — stop/destroy 间隔避免竞态
   */
  const startAndroidInline = async (nextHandlers: VoiceListenHandlers) => {
    handlers = nextHandlers
    latestPartial = ''
    finalized = false

    await cleanupInlineRecognizer()
    await delay(INLINE_RESTART_DELAY_MS)

    partialHandle = await SpeechRecognition.addListener('partialResults', (event) => {
      const text = event.matches?.[0] ?? ''
      if (!text) return
      latestPartial = text
      handlers?.onPartial?.(text)
    })

    stateHandle = await SpeechRecognition.addListener('listeningState', (event) => {
      if (event.status === 'stopped') {
        finalizeIfNeeded()
      }
    })

    try {
      await SpeechRecognition.start({
        language: 'zh-CN',
        partialResults: true,
        popup: false,
        maxResults: 1,
      })
    } catch (err) {
      handlers?.onError(mapSpeechError(err))
      handlers = null
      await removeListeners()
      throw err
    }
  }

  /** iOS：内联 partialResults */
  const startIosInline = async (nextHandlers: VoiceListenHandlers) => {
    handlers = nextHandlers
    latestPartial = ''
    finalized = false

    await cleanupInlineRecognizer()

    partialHandle = await SpeechRecognition.addListener('partialResults', (event) => {
      const text = event.matches?.[0] ?? ''
      if (!text) return
      latestPartial = text
      handlers?.onPartial?.(text)
    })

    stateHandle = await SpeechRecognition.addListener('listeningState', (event) => {
      if (event.status === 'stopped') {
        finalizeIfNeeded()
      }
    })

    try {
      await SpeechRecognition.start({
        language: 'zh-CN',
        partialResults: true,
        popup: false,
        maxResults: 1,
      })
    } catch (err) {
      handlers?.onError(mapSpeechError(err))
      handlers = null
      await removeListeners()
    }
  }

  return {
    async isSupported() {
      try {
        const { available } = await SpeechRecognition.available()
        return available
      } catch {
        return false
      }
    },

    async requestPermission() {
      const result = await SpeechRecognition.requestPermissions()
      return result.speechRecognition === 'granted'
    },

    async start(nextHandlers) {
      const granted = await this.requestPermission()
      if (!granted) {
        nextHandlers.onError('麦克风权限被拒绝，请在系统设置中允许录音')
        return
      }

      if (Capacitor.getPlatform() === 'android') {
        try {
          await startAndroidPopup(nextHandlers)
        } catch (popupErr) {
          // popup 失败时尝试 inline 一次（少数机型 popup 不可用）
          try {
            await startAndroidInline(nextHandlers)
          } catch (inlineErr) {
            nextHandlers.onError(mapSpeechError(inlineErr ?? popupErr))
            await cleanupInlineRecognizer()
          }
        }
        return
      }

      await startIosInline(nextHandlers)
    },

    async stop() {
      if (androidPopupActive) {
        handlers = null
        return
      }

      finalizeIfNeeded()
      await cleanupInlineRecognizer()
    },
  }
}
