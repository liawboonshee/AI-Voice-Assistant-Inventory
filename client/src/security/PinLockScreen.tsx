import { useState, type FormEvent } from 'react'

const PIN_KEY = 'kucunbao_pin_lock_v1'
const PIN_ITERATIONS = 120_000

type StoredPin = {
  salt: string
  hash: string
  iterations: number
}

type Props = {
  onUnlock: () => void
}

function bytesToBase64(bytes: Uint8Array): string {
  let value = ''
  bytes.forEach((byte) => { value += String.fromCharCode(byte) })
  return btoa(value)
}

function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value)
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0))
}

function readStoredPin(): StoredPin | null {
  try {
    const value = JSON.parse(localStorage.getItem(PIN_KEY) || 'null')
    return value?.salt && value?.hash && Number.isFinite(value?.iterations) ? value : null
  } catch {
    return null
  }
}

async function derivePinHash(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const cryptoSalt = new Uint8Array(salt.length)
  cryptoSalt.set(salt)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: cryptoSalt, iterations },
    key,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

function sameHash(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let different = 0
  for (let index = 0; index < left.length; index += 1) {
    different |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return different === 0
}

function onlyFourDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4)
}

export function hasInventoryPin(): boolean {
  return readStoredPin() !== null
}

export default function PinLockScreen({ onUnlock }: Props) {
  const [storedPin, setStoredPin] = useState<StoredPin | null>(readStoredPin)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const isSetup = storedPin === null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{4}$/.test(pin)) {
      setMessage('请输入4位数字密码')
      return
    }
    if (isSetup && pin !== confirmPin) {
      setMessage('两次输入的密码不一样')
      return
    }

    setBusy(true)
    setMessage('')
    try {
      if (isSetup) {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const next: StoredPin = {
          salt: bytesToBase64(salt),
          hash: await derivePinHash(pin, salt, PIN_ITERATIONS),
          iterations: PIN_ITERATIONS,
        }
        localStorage.setItem(PIN_KEY, JSON.stringify(next))
        setStoredPin(next)
        onUnlock()
        return
      }

      const hash = await derivePinHash(pin, base64ToBytes(storedPin.salt), storedPin.iterations)
      if (!sameHash(hash, storedPin.hash)) {
        setPin('')
        setMessage('密码错误，请重新输入')
        return
      }
      onUnlock()
    } catch {
      setMessage('无法启用安全密码，请更新 Android System WebView 后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="pin-lock-screen">
      <form className="pin-lock-card" onSubmit={submit}>
        <div className="pin-lock-logo">📦</div>
        <h1>{isSetup ? '设置库存宝密码' : '库存宝已上锁'}</h1>
        <p>{isSetup ? '首次使用请设置4位数字密码' : '输入4位密码进入库存宝'}</p>
        <input
          aria-label="4位密码"
          autoFocus
          autoComplete={isSetup ? 'new-password' : 'current-password'}
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{4}"
          placeholder="••••"
          type="password"
          value={pin}
          onChange={(event) => setPin(onlyFourDigits(event.target.value))}
        />
        {isSetup && (
          <input
            aria-label="确认4位密码"
            autoComplete="new-password"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{4}"
            placeholder="再次输入4位密码"
            type="password"
            value={confirmPin}
            onChange={(event) => setConfirmPin(onlyFourDigits(event.target.value))}
          />
        )}
        {message && <div className="pin-lock-message">{message}</div>}
        <button disabled={busy} type="submit">
          {busy ? '处理中…' : isSetup ? '保存并进入' : '解锁'}
        </button>
        <small>密码使用 PBKDF2 加盐哈希保存，不会保存明文密码。</small>
      </form>
    </main>
  )
}
