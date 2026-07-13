import { Capacitor } from '@capacitor/core'
import {
  QueueStrategy,
  TextToSpeech,
} from '@capacitor-community/text-to-speech'

/** 播报前去掉 Markdown，避免 TTS 读出符号 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
}

const TTS_WATCHDOG_MIN_MS = 30_000
const TTS_WATCHDOG_MAX_MS = 120_000
const NATIVE_TTS_INIT_RETRIES = 8
const NATIVE_TTS_RETRY_MS = 250

let pendingSpeakResolve: (() => void) | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function estimateSpeakMs(text: string): number {
  return Math.min(
    TTS_WATCHDOG_MAX_MS,
    Math.max(TTS_WATCHDOG_MIN_MS, (text.length / 4) * 1000 + 10_000),
  )
}

function usesNativeTts(): boolean {
  return Capacitor.isNativePlatform()
}

/** Android/iOS APK 使用系统原生 TTS，不依赖 WebView 的 speechSynthesis。 */
async function speakNative(text: string): Promise<void> {
  let lastError: unknown

  // Android 的 TTS 引擎在 App 刚打开时需要短暂初始化，失败时自动重试。
  for (let attempt = 0; attempt < NATIVE_TTS_INIT_RETRIES; attempt += 1) {
    try {
      await TextToSpeech.speak({
        text,
        lang: 'zh-CN',
        rate: 0.9,
        pitch: 1,
        volume: 1,
        queueStrategy: QueueStrategy.Flush,
      })
      return
    } catch (error) {
      lastError = error
      if (attempt < NATIVE_TTS_INIT_RETRIES - 1) {
        await delay(NATIVE_TTS_RETRY_MS)
      }
    }
  }

  throw lastError
}

function waitForVoices(): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve()
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve()

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve()
    }

    window.speechSynthesis.addEventListener('voiceschanged', finish)
    setTimeout(finish, 500)
  })
}

/** 浏览器版保留 Web Speech 作为后备。 */
async function speakWeb(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return

  await waitForVoices()

  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    pendingSpeakResolve = null
  }

  const speakPromise = new Promise<void>((resolve) => {
    pendingSpeakResolve = () => {
      finish()
      resolve()
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    const chineseVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.includes('zh'))

    if (chineseVoice) utterance.voice = chineseVoice

    utterance.onend = () => {
      finish()
      resolve()
    }
    utterance.onerror = () => {
      finish()
      resolve()
    }

    setTimeout(() => {
      window.speechSynthesis.resume()
      window.speechSynthesis.speak(utterance)
    }, 100)
  })

  const watchdog = delay(estimateSpeakMs(text)).then(() => {
    window.speechSynthesis.cancel()
    pendingSpeakResolve?.()
  })

  await Promise.race([speakPromise, watchdog])
  finish()
}

export async function speak(text: string): Promise<void> {
  const clean = stripMarkdown(text)
  if (!clean) return

  if (usesNativeTts()) {
    await speakNative(clean)
    return
  }

  await speakWeb(clean)
}

export function stopSpeaking(): void {
  if (usesNativeTts()) {
    void TextToSpeech.stop().catch(() => undefined)
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }

  pendingSpeakResolve?.()
}

export function isSpeechSynthesisSupported(): boolean {
  return usesNativeTts() || 'speechSynthesis' in window
}
