import type { FormEvent, KeyboardEvent } from 'react'
import type { VoicePhase } from '../voice/types'

interface Props {
  input: string
  loading: boolean
  listening: boolean
  autoVoiceMode: boolean
  phase: VoicePhase
  onInputChange: (value: string) => void
  onSend: () => void
  onVoiceStart: () => void
  onVoiceStop: () => void
  onAutoVoiceToggle: (value: boolean) => void
  onStopSpeaking: () => void
}

export function InputBar({
  input,
  loading,
  listening,
  autoVoiceMode,
  phase,
  onInputChange,
  onSend,
  onVoiceStart,
  onVoiceStop,
  onAutoVoiceToggle,
  onStopSpeaking,
}: Props) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSend()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  const micActive = listening || (autoVoiceMode && (phase === 'listening' || phase === 'speaking'))

  return (
    <form className="input-bar" onSubmit={handleSubmit}>
      <label className="auto-toggle" title="自动对话：说完自动发送，播报后自动再听">
        <input
          type="checkbox"
          checked={autoVoiceMode}
          onChange={(event) => onAutoVoiceToggle(event.target.checked)}
          disabled={loading}
        />
        <span>自动</span>
      </label>

      <button
        type="button"
        className={`voice-button ${micActive ? 'voice-button-active' : ''}`}
        onClick={micActive ? onVoiceStop : onVoiceStart}
        disabled={loading && !listening}
        aria-label={micActive ? '停止语音' : '开始语音输入'}
      >
        {micActive ? '■' : '🎤'}
      </button>

      {phase === 'speaking' && (
        <button type="button" className="stop-speak-button" onClick={onStopSpeaking}>
          静音
        </button>
      )}

      <input
        className="text-input"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={autoVoiceMode ? '输入文字发送，或点 🎤 说话…' : '输入消息或点 🎤…'}
        disabled={loading && !listening}
      />

      <button type="submit" className="send-button" disabled={loading || !input.trim()}>
        {loading ? '...' : '发送'}
      </button>
    </form>
  )
}
