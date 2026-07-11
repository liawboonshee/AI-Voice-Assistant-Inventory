import { askAI, type ChatMessage } from '../ai/openai'
import { useVoiceSession } from './useVoiceSession'
import { speak, stopSpeaking } from '../utils/tts'
import { trimMessages } from '../utils/trimMessages'
import { loadMessages, saveMessages } from '../utils/chatStorage'
import { PHASE_LABELS } from './types'
import { ChatMessageBubble } from '../components/ChatMessage'
import { InputBar } from '../components/InputBar'
import { SettingsPanel } from '../components/SettingsPanel'
import { checkApiConnectivity, getApiBase, isMisconfiguredNativeBase } from '../config/apiBase'
import { combineAbortSignals, createTimeoutSignal, isTimeoutAbort } from '../utils/withTimeout'


const SAVE_DEBOUNCE_MS = 300
const API_TIMEOUT_MS = 60_000

export default function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyReady, setHistoryReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [setupMessage, setSetupMessage] = useState('无法连接云端服务，请检查网络或在设置中修改 Proxy 地址')
  const [apiBaseLabel, setApiBaseLabel] = useState('…')
  const listRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef(messages)
  const abortControllerRef = useRef<AbortController | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void saveMessages(messagesRef.current)
  }, [])

  useEffect(() => {
    void getApiBase().then((base) => setApiBaseLabel(base))
  }, [])

  useEffect(() => {
    void loadMessages().then((stored) => {
      setMessages(stored)
      setHistoryReady(true)
    })
  }, [])

  useEffect(() => {
    if (!historyReady) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void saveMessages(messages)
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        void saveMessages(messages)
      }
    }
  }, [messages, historyReady])

  useEffect(() => {
    if (!historyReady) return

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushSave()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flushSave)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flushSave)
    }
  }, [historyReady, flushSave])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    void (async () => {
      const base = await getApiBase()
      if (isMisconfiguredNativeBase(base)) {
        setSetupRequired(true)
        setSetupMessage(
          '安装包未预置云端地址（当前为 localhost），请在设置中填入 Worker HTTPS 地址，或联系客服获取新版 APK',
        )
        return
      }

      const result = await checkApiConnectivity(base)
      if (!result.ok) {
        setSetupRequired(true)
        if (result.authFailure) {
          setSetupMessage(
            '云端已连通，但安装包 Token 未配对。请联系客服获取新版安装包，或核对 Worker 的 PROXY_AUTH_TOKEN',
          )
        } else if (result.openaiFailure) {
          setSetupMessage(
            '云端已连通，但 AI 服务 Key 无效。请在 Cloudflare Worker 更新 OPENAI_API_KEY 后重试',
          )
        } else {
          setSetupMessage('无法连接云端服务，请检查网络或在设置中修改 Proxy 地址')
        }
      }
    })()
  }, [])

  const handleVoiceSend = useCallback(async (text: string, signal?: AbortSignal) => {
    setError(null)
    const userMessage: ChatMessage = { role: 'user', content: text }
    const nextMessages = trimMessages([...messagesRef.current, userMessage])
    setMessages(nextMessages)
    const reply = await askAI(nextMessages, signal)
    setMessages([...nextMessages, { role: 'assistant', content: reply }])
    return reply
  }, [])

  const voice = useVoiceSession({
    onSend: handleVoiceSend,
    onInputPreview: setInput,
  })

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, voice.phase])

  const sendText = async () => {
    const text = input.trim()
    if (!text || voice.isBusy) return

    stopSpeaking()
    await voice.stop()
    setError(null)

    const userMessage: ChatMessage = { role: 'user', content: text }
    const nextMessages = trimMessages([...messages, userMessage])
    setMessages(nextMessages)
    setInput('')

    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    const userSignal = abortControllerRef.current.signal
    const { signal: timeoutSignal, clear: clearTimeoutTimer } = createTimeoutSignal(API_TIMEOUT_MS)
    const signal = combineAbortSignals([userSignal, timeoutSignal])

    try {
      const reply = await askAI(nextMessages, signal)
      clearTimeoutTimer()
      setMessages([...nextMessages, { role: 'assistant', content: reply }])
      void speak(reply)
    } catch (err) {
      clearTimeoutTimer()
      if (userSignal.aborted && !isTimeoutAbort(signal)) return
      const message =
        isTimeoutAbort(signal) || isTimeoutAbort(userSignal)
          ? '请求超时，请重试'
          : err instanceof Error
            ? err.message
            : '请求失败，请稍后重试'
      setError(message)
    }
  }

  const handleStopSpeaking = () => {
    if (voice.autoVoiceMode && voice.phase === 'speaking') {
      void voice.skipSpeakingAndContinue()
      return
    }
    stopSpeaking()
  }

  const handleSettingsSaved = (url: string) => {
    setApiBaseLabel(url)
    setSetupRequired(false)
  }

  const handleClearHistory = async () => {
    setMessages([])
    await saveMessages([])
  }

  const displayError = error ?? voice.error

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>Voice AI Assistant</h1>
            <p>语音对话助手 · {apiBaseLabel.replace(/^https?:\/\//, '').slice(0, 32)}</p>
          </div>
          <div className="header-actions">
            <button type="button" className="settings-button" onClick={() => setSettingsOpen(true)}>
              设置
            </button>
            <span className={`phase-pill phase-pill-${voice.phase}`}>{PHASE_LABELS[voice.phase]}</span>
          </div>
        </div>
      </header>

      {setupRequired && (
        <div className="setup-banner">
          {setupMessage}
          <button type="button" className="setup-banner-btn" onClick={() => setSettingsOpen(true)}>
            去设置
          </button>
        </div>
      )}

      <main className="chat-area" ref={listRef}>
        {messages.length === 0 && !voice.isBusy && (
          <div className="empty-state">
            <p>点 🎤 开始语音（Android 会弹出系统「请说话」界面，属正常）</p>
            <p className="empty-hint">也可在下方输入文字后点「发送」；有网即用，对话保存在本机</p>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessageBubble key={`${message.role}-${index}`} message={message} />
        ))}

        {voice.phase === 'thinking' && (
          <div className="loading-row">
            <span className="loading-dot" />
            AI 思考中...
          </div>
        )}
      </main>

      {displayError && (
        <div className="error-banner">
          {displayError}
          {voice.error && (
            <button type="button" className="error-dismiss" onClick={voice.dismissError}>
              关闭
            </button>
          )}
        </div>
      )}

      <InputBar
        input={input}
        loading={voice.isBusy}
        listening={voice.isListening}
        autoVoiceMode={voice.autoVoiceMode}
        phase={voice.phase}
        onInputChange={setInput}
        onSend={sendText}
        onVoiceStart={voice.start}
        onVoiceStop={voice.stop}
        onAutoVoiceToggle={voice.toggleAutoVoiceMode}
        onStopSpeaking={handleStopSpeaking}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
        onClearHistory={handleClearHistory}
      />

    </div>
  )
}
