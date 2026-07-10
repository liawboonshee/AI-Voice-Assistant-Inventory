# Worker 3-layer probe: health / proxy auth / OpenAI chat
# Usage: .\VERIFY_WORKER.ps1 -WorkerUrl "https://voice-ai-proxy.boonshee-ai.workers.dev" -ProxyToken "boonshee2026proxy"

param(
  [string]$WorkerUrl = "https://voice-ai-proxy.boonshee-ai.workers.dev",
  [string]$ProxyToken = "boonshee2026proxy"
)

$base = $WorkerUrl.Trim().TrimEnd("/")
$chatBody = '{"messages":[{"role":"user","content":"hello"}]}'
$allOk = $true

function Read-ErrorBody($resp) {
  if (-not $resp) { return "" }
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  return $reader.ReadToEnd()
}

Write-Host ""
Write-Host "=== 1. GET /health ==="
try {
  $r = Invoke-RestMethod -Uri "$base/health" -TimeoutSec 30
  if ($r.status -eq "ok") {
    Write-Host "PASS: Worker online" -ForegroundColor Green
  } else {
    Write-Host "FAIL: bad health response" -ForegroundColor Red
    $allOk = $false
  }
} catch {
  Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
  $allOk = $false
}

Write-Host ""
Write-Host "=== 2. POST /api/chat without token (should 401) ==="
try {
  $req = [System.Net.HttpWebRequest]::Create("$base/api/chat")
  $req.Method = "POST"
  $req.ContentType = "application/json"
  $req.Timeout = 45000
  $bytes = [Text.Encoding]::UTF8.GetBytes($chatBody)
  $req.ContentLength = $bytes.Length
  $s = $req.GetRequestStream()
  $s.Write($bytes, 0, $bytes.Length)
  $s.Close()
  $resp = $req.GetResponse()
  Write-Host "FAIL: chat without token should not succeed (HTTP $([int]$resp.StatusCode))" -ForegroundColor Red
  $allOk = $false
} catch [System.Net.WebException] {
  $body = Read-ErrorBody $_.Exception.Response
  if ($body -match "PROXY_AUTH_FAILED|Unauthorized|X-Proxy-Token") {
    Write-Host "PASS: proxy gate OK (401)" -ForegroundColor Green
  } else {
    Write-Host "FAIL: unexpected body: $body" -ForegroundColor Red
    $allOk = $false
  }
}

Write-Host ""
Write-Host "=== 3. POST /api/chat with token ==="
try {
  $req = [System.Net.HttpWebRequest]::Create("$base/api/chat")
  $req.Method = "POST"
  $req.ContentType = "application/json"
  $req.Headers.Add("X-Proxy-Token", $ProxyToken)
  $req.Timeout = 60000
  $bytes = [Text.Encoding]::UTF8.GetBytes($chatBody)
  $req.ContentLength = $bytes.Length
  $s = $req.GetRequestStream()
  $s.Write($bytes, 0, $bytes.Length)
  $s.Close()
  $resp = $req.GetResponse()
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $text = $reader.ReadToEnd()
  $json = $text | ConvertFrom-Json
  if ($json.content) {
    $preview = $json.content.Substring(0, [Math]::Min(80, $json.content.Length))
    Write-Host "PASS: chat 200, content=$preview" -ForegroundColor Green
  } else {
    Write-Host "FAIL: missing content field" -ForegroundColor Red
    $allOk = $false
  }
} catch [System.Net.WebException] {
  $body = Read-ErrorBody $_.Exception.Response
  $status = [int]$_.Exception.Response.StatusCode
  if ($body -match "OPENAI_AUTH_FAILED|Incorrect API key|API key") {
    Write-Host "PARTIAL: token OK, OPENAI_API_KEY invalid (HTTP $status)" -ForegroundColor Yellow
    Write-Host "  Ask customer: wrangler secret put OPENAI_API_KEY, then wrangler deploy"
    $allOk = $false
  } elseif ($body -match "PROXY_AUTH_FAILED|Unauthorized") {
    Write-Host "FAIL: token mismatch (HTTP $status)" -ForegroundColor Red
    $allOk = $false
  } else {
    Write-Host "FAIL: HTTP $status $body" -ForegroundColor Red
    $allOk = $false
  }
}

Write-Host ""
Write-Host "========== SUMMARY =========="
if ($allOk) {
  Write-Host "ALL PASS - ready to ship APK" -ForegroundColor Green
  exit 0
} else {
  Write-Host "NOT ALL PASS - fix issues above and re-run" -ForegroundColor Yellow
  exit 1
}
