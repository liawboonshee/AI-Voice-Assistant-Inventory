import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chatgpt.employee.ledger',
  appName: '员工记账宝',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // 原生 HTTP 绕过 WebView 混合内容限制，允许 APK 访问局域网 http:// Proxy
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
