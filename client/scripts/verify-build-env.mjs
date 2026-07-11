import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return vars
}

function isLocalhostUrl(url) {
  if (!url) return true
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.0.2.2'
  } catch {
    return true
  }
}

const fromEnv = process.env.VITE_API_BASE_URL?.trim()
const fromFile = parseEnvFile(resolve(root, '.env.production')).VITE_API_BASE_URL?.trim()
const apiBase = fromEnv || fromFile

if (!apiBase) {
  console.error(
    '[verify-build-env] VITE_API_BASE_URL 未配置。请在 client/.env.production 中设置 Worker HTTPS 地址，或 export 环境变量后再构建 APK。',
  )
  process.exit(1)
}

if (isLocalhostUrl(apiBase)) {
  console.error(
    `[verify-build-env] VITE_API_BASE_URL=${apiBase} 是本地地址，真机 APK 无法连接。请改为 Worker HTTPS 地址。`,
  )
  process.exit(1)
}

console.log(`[verify-build-env] OK: ${apiBase}`)
