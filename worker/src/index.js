const VOICE_SYSTEM_PROMPT =
  '你是“库存宝”的中文语音助手。先理解用户真正想问什么，再直接回答。信息不足时只问一个最关键的问题；不要编造库存、交易或客户数据。使用自然、简短的中文，通常1-3句话，不要Markdown、列表或代码块。'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function withVoiceSystemPrompt(messages) {
  const hasSystem = messages.some((item) => item.role === 'system')
  if (hasSystem) return messages
  return [{ role: 'system', content: VOICE_SYSTEM_PROMPT }, ...messages]
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages must be a non-empty array'
  }

  const valid = messages.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      (item.role === 'user' || item.role === 'assistant' || item.role === 'system') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0,
  )

  return valid ? null : 'each message requires role and non-empty content'
}

/** 配置了 PROXY_AUTH_TOKEN 时校验请求头，防止 Worker URL 被滥用 */
function checkProxyToken(request, env) {
  const expected = env.PROXY_AUTH_TOKEN
  if (!expected) return null

  const provided = request.headers.get('X-Proxy-Token')
  if (provided !== expected) {
    return json(
      {
        error: 'Unauthorized',
        code: 'PROXY_AUTH_FAILED',
        detail: 'invalid or missing X-Proxy-Token',
      },
      401,
    )
  }
  return null
}

/** 可选 KV 限流：按 Token 每分钟 60 次（与 Express rateLimit 对齐） */
async function checkRateLimit(request, env) {
  const kv = env.RATE_LIMIT_KV
  if (!kv) return null

  const token = request.headers.get('X-Proxy-Token') || 'anonymous'
  const windowKey = `rl:${token}:${Math.floor(Date.now() / 60000)}`
  const maxPerMinute = Number(env.RATE_LIMIT_MAX || 60)

  const raw = await kv.get(windowKey)
  const count = raw ? parseInt(raw, 10) : 0
  if (count >= maxPerMinute) {
    return json(
      { error: 'Rate limit exceeded', code: 'RATE_LIMITED', detail: 'too many requests' },
      429,
    )
  }

  await kv.put(windowKey, String(count + 1), { expirationTtl: 120 })
  return null
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ status: 'ok' })
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const authError = checkProxyToken(request, env)
      if (authError) return authError

      const rateError = await checkRateLimit(request, env)
      if (rateError) return rateError

      const apiKey = env.OPENAI_API_KEY
      if (!apiKey) {
        return json(
          {
            error: 'Proxy error',
            code: 'OPENAI_NOT_CONFIGURED',
            detail: 'OPENAI_API_KEY not configured',
          },
          500,
        )
      }

      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'Invalid request', detail: 'invalid JSON body' }, 422)
      }

      const validationError = validateMessages(body?.messages)
      if (validationError) {
        return json({ error: 'Invalid request', detail: validationError }, 422)
      }

      const model = env.OPENAI_MODEL || 'gpt-5.6-terra'
      const payloadMessages = withVoiceSystemPrompt(body.messages)

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, messages: payloadMessages }),
          signal: AbortSignal.timeout(30000),
        })

        const data = await response.json()

        if (!response.ok) {
          const detail = data?.error?.message || 'OpenAI request failed'
          const isAuthError = response.status === 401 || response.status === 403
          return json(
            {
              error: 'OpenAI error',
              code: isAuthError ? 'OPENAI_AUTH_FAILED' : 'OPENAI_UPSTREAM_ERROR',
              detail,
            },
            502,
          )
        }

        const content = data?.choices?.[0]?.message?.content
        if (!content) {
          return json(
            { error: 'OpenAI error', code: 'OPENAI_UPSTREAM_ERROR', detail: 'empty response' },
            502,
          )
        }

        return json({ content })
      } catch {
        return json({ error: 'Proxy error', detail: 'internal server error' }, 500)
      }
    }

    return json({ error: 'Not found' }, 404)
  },
}
