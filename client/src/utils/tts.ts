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

/** 按文本长度估算播报时长，防止 Android WebView onend 不触发时永久挂起 */
function estimateSpeakMs(text: string): number {
  return Math.min(TTS_WATCHDOG_MAX_MS, Math.max(TTS_WATCHDOG_MIN_MS, (text.length / 4) * 1000 + 10_000))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 当前 speak() 的 resolve 回调，stopSpeaking 可提前结束等待 */
let pendingSpeakResolve: (() => void) | null = null

function waitForVoices(): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve()

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) return Promise.resolve()

  return new Promise((resolve) => {
    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve()
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    setTimeout(resolve, 300)
  })
}

export function speak(text: string): Promise<void> {
  const clean = stripMarkdown(text)
  if (!clean.trim()) return Promise.resolve()
  if (!('speechSynthesis' in window)) return Promise.resolve()

  return waitForVoices().then(async () => {
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
      const utterance = new SpeechSynthesisUtterance(clean)

utterance.lang = 'zh-CN'
utterance.rate = 0.9
utterance.pitch = 1
utterance.volume = 1

const voices = window.speechSynthesis.getVoices()

const chineseVoice = voices.find(
  v => v.lang.includes('zh')
)

if (chineseVoice) {
  utterance.voice = chineseVoice
}
      utterance.onend = () => {
        finish()
        resolve()
      }
      utterance.onerror = () => {
        finish()
        resolve()
      }
      setTimeout(() => {
  window.speechSynthesis.speak(utterance)
}, 100)
})
    const watchdog = delay(estimateSpeakMs(clean)).then(() => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      pendingSpeakResolve?.()
    })

    await Promise.race([speakPromise, watchdog])
    finish()
  })
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  pendingSpeakResolve?.()
}

export function isSpeechSynthesisSupported() {
  return 'speechSynthesis' in window
}
