import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import os from 'node:os'

const VOICE_SYSTEM_PROMPT =
  '你是“库存宝”的中文语音助手。先理解用户真正想问什么，再直接回答。信息不足时只问一个最关键的问题；不要编造库存、交易或客户数据。使用自然、简短的中文，通常1-3句话，不要Markdown、列表或代码块。'

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const OPENAI_API_KEY = requiredEnv('OPENAI_API_KEY')
const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '0.0.0.0'
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra'
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000)
const PROXY_AUTH_TOKEN = process.env.PROXY_AUTH_TOKEN || ''

const defaultOrigins = [
  'http://localhost:5173',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
]

const corsOrigins = (process.env.CORS_ORIGIN || defaultOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const app = express()
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Proxy-Token'],
  }),
)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }),
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

function withVoiceSystemPrompt(messages) {
  const hasSystem = messages.some((item) => item.role === 'system')
  if (hasSystem) return messages
  return [{ role: 'system', content: VOICE_SYSTEM_PROMPT }, ...messages]
}

function mapOpenAiError(response, detail) {
  const isAuthError = response.status === 401 || response.status === 403
  return {
    status: 502,
    body: {
      error: 'OpenAI error',
      code: isAuthError ? 'OPENAI_AUTH_FAILED' : 'OPENAI_UPSTREAM_ERROR',
      detail,
    },
  }
}

function checkProxyToken(req, res) {
  if (!PROXY_AUTH_TOKEN) return true
  const provided = req.get('X-Proxy-Token')
  if (provided !== PROXY_AUTH_TOKEN) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'PROXY_AUTH_FAILED',
      detail: 'invalid or missing X-Proxy-Token',
    })
    return false
  }
  return true
}

app.post('/api/chat', async (req, res) => {
  if (!checkProxyToken(req, res)) return

  const messages = req.body?.messages

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(422).json({
      error: 'Invalid request',
      detail: 'messages must be a non-empty array',
    })
  }

  const valid = messages.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item.role === 'user' || item.role === 'assistant' || item.role === 'system') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0,
  )

  if (!valid) {
    return res.status(422).json({
      error: 'Invalid request',
      detail: 'each message requires role and non-empty content',
    })
  }

  const payloadMessages = withVoiceSystemPrompt(messages)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: payloadMessages,
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    })

    const data = await response.json()

    if (!response.ok) {
      const detail = data?.error?.message || 'OpenAI request failed'
      const mapped = mapOpenAiError(response, detail)
      return res.status(mapped.status).json(mapped.body)
    }

    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      return res.status(502).json({
        error: 'OpenAI error',
        code: 'OPENAI_UPSTREAM_ERROR',
        detail: 'empty response',
      })
    }

    return res.json({ content })
  } catch (err) {
    console.error('Proxy error:', err)
    const detail =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'OpenAI request timed out'
        : 'internal server error'
    return res.status(500).json({ error: 'Proxy error', detail })
  }
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Voice AI proxy listening on http://${HOST}:${PORT}`)
  if (HOST === '0.0.0.0') {
    const lanIps = Object.values(os.networkInterfaces())
      .flat()
      .filter((item) => item && item.family === 'IPv4' && !item.internal)
      .map((item) => item.address)
    if (lanIps.length > 0) {
      console.log('手机 APK 可填 Proxy 地址：')
      lanIps.forEach((ip) => console.log(`  http://${ip}:${PORT}`))
    }
  }
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
