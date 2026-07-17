# 客户验收指南

本文档回答验收常见问题。**默认云端模式**：装 APK 即用，无需开电脑。

---

## 交付物

| 内容 | 位置 |
|------|------|
| 完整源码 | https://github.com/liawboonshee/AI-Voice-Assistant-Inventory/tree/inventory-v1 |
| 固定签名 APK | 仓库 **Actions** → 最新成功 run → **Artifacts** → 下载 `KuCunBao-AI-fixed-signature` |
| 云端 Proxy（**默认**） | `worker/` → Cloudflare Worker |
| 本地调试 Proxy（备选） | `server/`（Node.js Express） |
| 前端 + Android | `client/` |

---

## 快速答疑

### Q1：还需要开电脑吗？

**不需要。** APK 已预置云端 Worker 地址，手机有网（WiFi 或 4G）即可语音对话。

### Q2：安装后还要填 Proxy 吗？

**不需要。** 装完打开 App，授予麦克风，开「自动对话」即可。

仅在云端地址变更或调试时：App → **设置** → 修改 Proxy → 测试连接 → 保存。

### Q3：对话记录会丢吗？

**不会（同一台手机）。** 对话自动保存在本机，关 App 再开记录仍在。

卸载 APK 会清除本地记录（客户已确认可接受）。

### Q4：Cloudflare Worker 怎么部署？

维护方一次性部署（见 `worker/README.md`）：

```powershell
cd worker
wrangler login
wrangler secret put OPENAI_API_KEY
wrangler deploy
```

GitHub Secrets 设置：

| Secret | 必填 | 说明 |
|--------|------|------|
| `VITE_API_BASE_URL` | 是 | Worker HTTPS 地址 |
| `VITE_PROXY_TOKEN` | 若 Worker 启用了 Token | 须与 `PROXY_AUTH_TOKEN` **完全相同** |
| `KUCUNBAO_KEYSTORE_BASE64` | 是 | `KuCunBao-release.jks` 的 Base64 内容 |
| `KUCUNBAO_STORE_PASSWORD` | 是 | 固定签名密钥库密码 |
| `KUCUNBAO_KEY_ALIAS` | 是 | 固定签名别名 |
| `KUCUNBAO_KEY_PASSWORD` | 是 | 固定签名密钥密码 |

签名资料来自私密备份 `KuCunBao-signing-backup.zip`，不可提交到公开仓库。缺少任何一项签名 Secret 时，Actions 会直接失败，不再生成随机签名 APK。

push 后 Actions 自动构建 APK。

### Q5：局域网 Node 方案还能用吗？

可以，作为**开发调试备选**：

```powershell
cd server
npm install
copy .env.example .env
# 填入 OPENAI_API_KEY
npm start
```

App 设置填 `http://<电脑局域网IP>:3001`，手机与电脑同一 WiFi。

---

## 客户验收流程（云端，4 步）

### 第 1 步：安装 APK

从 GitHub Actions Artifacts 下载最新 `KuCunBao-AI-fixed-signature`，解压后安装 `KuCunBao-AI-release.apk`。这个 APK 必须由库存宝原始固定签名构建，才可覆盖旧版并保留数据。

### 第 2 步：授予麦克风权限

首次使用允许录音权限。

### 第 3 步：语音对话

1. 打开 App
2. 开启「自动对话」
3. 点麦克风，连续说 3 轮

**电脑可关机**，手机用 4G 或 WiFi 均可。

### 第 4 步：验证本地保存

1. 完成 3 轮对话
2. 完全关闭 App（从后台划掉）
3. 重新打开 → **对话记录应仍在**

---

## Proxy 地址对照表

| 场景 | 地址 |
|------|------|
| **客户默认（云端）** | APK 内置，无需填写 |
| 手动覆盖 | `https://xxx.workers.dev` |
| 本地浏览器调试 | `http://localhost:3001` |
| 局域网 Node 调试 | `http://192.168.x.x:3001` |
| Android 模拟器 | `http://10.0.2.2:3001` |

---

## `.env` 配置（仅维护方 / 调试）

### Worker Secret

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put PROXY_AUTH_TOKEN   # 可选
```

### server/.env（本地调试）

| 字段 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 必填 |
| `OPENAI_MODEL` | 默认 `gpt-5.6-terra`（聪明与费用平衡） |
| `PROXY_AUTH_TOKEN` | 可选，与 APK `VITE_PROXY_TOKEN` 一致 |

### client 构建环境变量

| 变量 | 说明 |
|------|------|
| `VITE_API_BASE_URL` | Worker HTTPS 地址（GitHub Secret） |
| `VITE_PROXY_TOKEN` | 可选，与 Worker `PROXY_AUTH_TOKEN` 一致 |

---

## 验收清单

- [ ] 装 APK 后不配置即可连云端
- [ ] 电脑关机，手机 4G 连续 3 轮语音对话
- [ ] 关 App 再开，对话记录仍在
- [ ] 设置 → 清空本地记录 可用
- [ ] Worker `/health` 返回 `{"status":"ok"}`

---

## 开发调试备选（局域网 Node）

1. `cd server && npm start`
2. 记下 `http://192.168.x.x:3001`
3. App 设置填入 → 测试连接 → 保存
4. Windows 防火墙放行 3001（连不上时）

详见 `worker/README.md` 与根目录 `README.md`。
