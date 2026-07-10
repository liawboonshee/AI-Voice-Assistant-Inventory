# 云端交付闭环清单（维护方一次性操作）

完成下列步骤后，客户即可「装 APK 即用、无需开电脑」。

## 1. 部署 Cloudflare Worker

```powershell
cd worker
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
# 可选：启用 Token 门禁（须与步骤 2 的 VITE_PROXY_TOKEN 一致）
npx wrangler secret put PROXY_AUTH_TOKEN
npx wrangler deploy
```

记录输出的 HTTPS 地址，例如 `https://voice-ai-proxy.xxx.workers.dev`。

验证：

```powershell
curl https://voice-ai-proxy.xxx.workers.dev/health
# 期望: {"status":"ok"}

# 重要：health 通过不代表对话可用；若启用了 PROXY_AUTH_TOKEN 必须带 Token 测 chat
$headers = @{ "X-Proxy-Token" = "<与 PROXY_AUTH_TOKEN 相同>"; "Content-Type" = "application/json" }
$body = '{"messages":[{"role":"user","content":"你好"}]}'
Invoke-RestMethod -Uri "https://voice-ai-proxy.xxx.workers.dev/api/chat" -Method POST -Headers $headers -Body $body
# 期望: 200 且返回 content 字段
```

> **客户若设置了 `PROXY_AUTH_TOKEN`，必须私下告知维护方**，否则 APK 对话会 401。Token 当前已配对为 `boonshee2026proxy`。

## 1.1 三层探针验收（必做，不能只看 health）

```powershell
.\VERIFY_WORKER.ps1 -WorkerUrl "https://voice-ai-proxy.boonshee-ai.workers.dev" -ProxyToken "boonshee2026proxy"
```

期望：health PASS、无 Token 被拒绝、带 Token 的 chat **200 + content**。

若第 3 层提示 OPENAI_API_KEY 无效，请客户在 Cloudflare 更新 Key 并 redeploy。

## 2. 配置 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret

| Secret | 必填 | 值 |
|--------|------|-----|
| `VITE_API_BASE_URL` | **是** | 步骤 1 的 Worker HTTPS 地址 |
| `VITE_PROXY_TOKEN` | 仅当 Worker 设了 `PROXY_AUTH_TOKEN` | 与 Worker Secret **完全相同** |

## 3. 触发 APK 构建

```powershell
git push origin main
```

Actions → Build Android APK → 成功后下载 Artifacts `app-debug`。

## 4. 更新交付包 APK（可选）

将最新 `app-debug.apk` 复制到：

```
AI语音助手-交付包/release/app-debug.apk
```

## 5. 客户验收（真机）

- [ ] 装 APK，不填 Proxy，直接开麦对话
- [ ] 电脑关机，手机 4G 可用
- [ ] 对话 3 轮 → 杀进程 → 重开记录仍在
- [ ] 首启连接失败时仅顶部 banner，不自动弹设置页
