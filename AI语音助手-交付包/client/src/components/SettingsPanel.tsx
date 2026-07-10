import { useEffect, useState } from 'react'
import {
  checkApiConnectivity,
  clearApiBase,
  getApiBase,
  getDefaultApiBase,
  isValidProxyUrl,
  setApiBase,
} from '../config/apiBase'

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (url: string) => void
  onClearHistory?: () => void
}

export function SettingsPanel({ open, onClose, onSaved, onClearHistory }: Props) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return

    void (async () => {
      setUrl(await getApiBase())
      setStatus('idle')
      setMessage('')
    })()
  }, [open])

  if (!open) return null

  const validateUrl = (value: string): string | null => {
    const trimmed = value.trim()
    if (!trimmed) return '请输入 Proxy 地址'
    if (!isValidProxyUrl(trimmed)) return '地址须以 http:// 或 https:// 开头'
    return null
  }

  const handleTest = async () => {
    const validationError = validateUrl(url)
    if (validationError) {
      setMessage(validationError)
      setStatus('fail')
      return
    }

    setStatus('checking')
    setMessage('正在检测连接…')
    const result = await checkApiConnectivity(url.trim())
    if (result.ok) {
      setStatus('ok')
      setMessage('连接成功（含对话接口），可以保存')
    } else if (result.authFailure) {
      setStatus('fail')
      setMessage(
        '地址可达，但 Token 不匹配。需更新安装包或核对 Worker 的 PROXY_AUTH_TOKEN',
      )
    } else if (result.openaiFailure) {
      setStatus('fail')
      setMessage(
        '地址与 Token 正常，但 Worker 的 OPENAI_API_KEY 无效。请在 Cloudflare 更新 Key 并 redeploy',
      )
    } else {
      setStatus('fail')
      setMessage(`无法连接：${result.error}。请确认地址正确且云端服务可用`)
    }
  }

  const handleSave = async () => {
    const validationError = validateUrl(url)
    if (validationError) {
      setMessage(validationError)
      setStatus('fail')
      return
    }

    setStatus('checking')
    const result = await checkApiConnectivity(url.trim())
    if (!result.ok) {
      setStatus('fail')
      if (result.authFailure) {
        setMessage('保存失败：Token 不匹配，需更新安装包或核对 Worker 鉴权配置')
      } else if (result.openaiFailure) {
        setMessage('保存失败：Worker 的 OPENAI_API_KEY 无效，请更新后重试')
      } else {
        setMessage(`保存失败：${result.error}`)
      }
      return
    }

    await setApiBase(url.trim())
    setStatus('ok')
    setMessage('已保存')
    onSaved?.(url.trim())
    onClose()
  }

  const handleReset = async () => {
    await clearApiBase()
    const fallback = getDefaultApiBase()
    setUrl(fallback)
    setStatus('idle')
    setMessage('已恢复默认云端地址')
  }

  const handleClearHistory = () => {
    void onClearHistory?.()
    setMessage('本地对话记录已清空')
    setStatus('ok')
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <h2>设置</h2>
        <p className="settings-desc">
          默认已连接云端，有网即可使用，无需开电脑。
          <br />
          仅在调试时需要修改 Proxy 地址，例如：
          <br />
          <code>https://voice-ai-proxy.xxx.workers.dev</code>
        </p>

        <label className="settings-label" htmlFor="proxy-url">
          云端 Proxy 地址（高级）
        </label>
        <input
          id="proxy-url"
          className="text-input settings-input"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://voice-ai-proxy.xxx.workers.dev"
        />

        {message && <p className={`settings-status settings-status-${status}`}>{message}</p>}

        <div className="settings-actions">
          <button type="button" className="settings-btn" onClick={handleTest} disabled={status === 'checking'}>
            测试连接
          </button>
          <button type="button" className="settings-btn settings-btn-primary" onClick={handleSave}>
            保存
          </button>
          <button type="button" className="settings-btn" onClick={handleReset}>
            恢复默认
          </button>
          <button type="button" className="settings-btn" onClick={handleClearHistory}>
            清空本地记录
          </button>
          <button type="button" className="settings-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
