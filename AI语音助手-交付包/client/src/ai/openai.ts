import { getApiBase } from '../config/apiBase'
import { getProxyAuthHeaders } from '../config/proxyAuth'
import { getProxyErrorMessage, type ProxyErrorBody } from '../config/proxyErrors'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  role: ChatRole
  content: string
}

interface ChatResponse extends ProxyErrorBody {
  content?: string
}

function getErrorMessage(status: number, body: ChatResponse): string {
  return getProxyErrorMessage(status, body)
}

export async function askAI(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const base = await getApiBase()
  let response: Response

  try {
    response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getProxyAuthHeaders() },
      body: JSON.stringify({ messages }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new Error('请求已取消')
    }
    throw new Error('无法连接云端 Proxy，请检查网络或在设置中修改地址')
  }

  const body = (await response.json().catch(() => ({}))) as ChatResponse

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, body))
  }

  return body.content ?? '无回复'
}
