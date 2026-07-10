/** Worker/Server 结构化错误响应 */
export interface ProxyErrorBody {
  error?: string
  code?: string
  detail?: string
}

export type ProxyFailureKind = 'proxy_auth' | 'openai_auth' | 'openai_upstream' | 'rate_limit' | 'other'

const MSG_PROXY_AUTH =
  '云端鉴权失败，当前安装包与服务器 Token 不一致，请联系客服获取新版安装包'

const MSG_OPENAI_AUTH =
  '云端 AI 服务 Key 无效或未配置，请联系管理员在 Cloudflare Worker 更新 OPENAI_API_KEY'

const MSG_RATE_LIMIT = '请求过于频繁，请稍后再试'

/** 从响应体识别失败类型（兼容旧 Worker 透传 401） */
export function classifyProxyFailure(status: number, body: ProxyErrorBody): ProxyFailureKind {
  const code = body.code ?? ''
  const detail = (body.detail ?? '').toLowerCase()
  const error = body.error ?? ''

  if (code === 'PROXY_AUTH_FAILED' || error === 'Unauthorized') {
    return 'proxy_auth'
  }

  if (
    code === 'OPENAI_AUTH_FAILED' ||
    code === 'OPENAI_NOT_CONFIGURED' ||
    (error === 'OpenAI error' &&
      (detail.includes('api key') || detail.includes('incorrect api key') || detail.includes('invalid_api_key')))
  ) {
    return 'openai_auth'
  }

  if (code === 'RATE_LIMITED' || error === 'Rate limit exceeded') {
    return 'rate_limit'
  }

  if (code === 'OPENAI_UPSTREAM_ERROR' || error === 'OpenAI error') {
    return 'openai_upstream'
  }

  // 旧 Worker 透传 OpenAI 401：body.error 为 OpenAI error 而非 Unauthorized
  if (status === 401 || status === 403) {
    if (error === 'OpenAI error') return 'openai_auth'
    return 'proxy_auth'
  }

  return 'other'
}

/** 用户可见中文错误文案 */
export function getProxyErrorMessage(status: number, body: ProxyErrorBody): string {
  const kind = classifyProxyFailure(status, body)

  switch (kind) {
    case 'proxy_auth':
      return MSG_PROXY_AUTH
    case 'openai_auth':
      return MSG_OPENAI_AUTH
    case 'rate_limit':
      return MSG_RATE_LIMIT
    case 'openai_upstream':
      return body.detail || 'AI 服务暂时不可用，请稍后重试'
    default:
      if (status === 422) return body.detail || '请求格式错误'
      if (status >= 500) return body.detail || '服务端异常，请稍后重试'
      return body.detail || body.error || `请求失败 (${status})`
  }
}

export function isProxyAuthFailure(status: number, body: ProxyErrorBody): boolean {
  return classifyProxyFailure(status, body) === 'proxy_auth'
}

export function isOpenAiAuthFailure(status: number, body: ProxyErrorBody): boolean {
  return classifyProxyFailure(status, body) === 'openai_auth'
}
