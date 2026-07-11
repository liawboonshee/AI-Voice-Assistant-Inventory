  # AI Voice Assistant（语音版 ChatGPT）

**客户验收请读 [CUSTOMER_GUIDE.md](CUSTOMER_GUIDE.md)**（云端模式：装 APK 即用，无需开电脑）。  
**维护方部署请读 [DEPLOY.md](DEPLOY.md)**（Worker + GitHub Secrets 闭环）。

默认 Proxy 方案：**Cloudflare Worker 云端 HTTPS**（`worker/`）。  
APK 构建时预置 `VITE_API_BASE_URL`；本地 Node（`server/`）仅作开发调试。

APK 下载：GitHub **Actions** → 最新 run → **Artifacts** → `app-debug`。

---

Android 语音助手：语音输入、ChatGPT 多轮对话、语音播报、自动循环、**对话本地自动保存**。  
技术栈 Vite + React + Capacitor + Cloudflare Worker Proxy。

OpenAI Key 只写在 Worker Secret 或 `server/.env`，不进前端、不进 GitHub。

## 目录

- `client/` — 前端与 Android 工程
- `server/` — 本地调试 Proxy（`/health`、`/api/chat`）
- `worker/` — **生产默认** Cloudflare Worker Proxy

## 云端部署（生产）

```powershell
npm install -g wrangler
cd worker
wrangler login
wrangler secret put OPENAI_API_KEY
wrangler deploy
```

在 GitHub Repo → Settings → Secrets 配置：

- `VITE_API_BASE_URL` = `https://xxx.workers.dev`
- `VITE_PROXY_TOKEN`（可选，与 `PROXY_AUTH_TOKEN` 一致）

push 到 `main` 后 Actions 自动构建带云端地址的 APK。

## 本地调试（可选）

```powershell
cd server
npm install
copy .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
npm start
```

```powershell
cd client
npm install
# client/.env 设 VITE_API_BASE_URL=http://localhost:3001
npm run dev
```

## 构建 APK

```powershell
cd client
npm install
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

产物：`client/android/app/build/outputs/apk/debug/app-debug.apk`

## 客户使用（云端模式）

1. 安装 APK（已内置 Worker 地址）
2. 授予麦克风权限
3. 开「自动对话」→ 点麦克风（WiFi 或 4G，**无需开电脑**）
4. 对话自动保存在本机，关 App 再开记录仍在

## 核心功能

- 语音输入（Web + Android 原生识别）
- ChatGPT 多轮记忆 + **本地自动保存**
- 语音播报与自动循环
- Android APK，云端 Proxy

## 安全

- API Key 仅 Worker Secret 或 `server/.env`
- 可选 `PROXY_AUTH_TOKEN` + `X-Proxy-Token` 门禁
- 前端只调 `/api/chat`，不直连 OpenAI

## 不包含

用户登录、云端对话同步、唤醒词
