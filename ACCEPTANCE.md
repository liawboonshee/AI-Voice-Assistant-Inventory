# 验收清单（云端默认模式）

## 云端部署（维护方）— 见 [DEPLOY.md](DEPLOY.md)

- [ ] `worker/` `wrangler deploy` 成功
- [x] `curl https://voice-ai-proxy.boonshee-ai.workers.dev/health` 返回 `{"status":"ok"}`
- [ ] `POST /api/chat` 带正确 `X-Proxy-Token` 返回 200（**不能只看 health**）
- [ ] GitHub Secret `VITE_API_BASE_URL` = `https://voice-ai-proxy.boonshee-ai.workers.dev`
- [x] GitHub Secret `VITE_PROXY_TOKEN` = `boonshee2026proxy`（与 Worker 一致）
- [ ] `.\VERIFY_WORKER.ps1` 三层探针全绿（**含 chat 200**）
- [ ] 客户已在 Worker 更新有效 `OPENAI_API_KEY` 并 redeploy
- [ ] Actions 构建 APK 成功

## 构建（自动化）

- [x] `client` 目录 `npm run build` 成功（第二轮已验证）
- [ ] `npx cap sync android` + `gradlew assembleDebug`（CI 或本地）
- [ ] APK 已装到手机

## 客户验收（无需开电脑）

- [ ] 装 APK 后**无需填 Proxy** 即可使用
- [ ] 首启若 OpenAI Key 无效，banner 提示 Key 问题（非 Token 误导）
- [ ] 设置 → 测试连接 能区分 Token / OpenAI Key / 网络 三类失败
- [ ] 电脑关机，手机 4G/WiFi 连续 3 轮语音对话
- [ ] 麦克风可用，有文字回复、有语音播报
- [ ] 自动模式下播报结束后继续听
- [ ] 对话 3 轮 → 杀进程 → 重开 → **记录仍在**（本地自动保存 + flush）
- [ ] 设置 → 清空本地记录 可用

## 开发调试备选（局域网 Node）

- [ ] `server` 目录 `npm start`，`/health` 返回 ok
- [ ] App 设置填 `http://192.168.x.x:3001` 可连
