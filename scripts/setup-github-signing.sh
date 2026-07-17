#!/usr/bin/env bash
set -eu

backup_path="${1:-$HOME/storage/downloads/KuCunBao-signing-backup.zip}"
repository="${2:-liawboonshee/AI-Voice-Assistant-Inventory}"

if ! command -v gh >/dev/null 2>&1; then
  echo "请先安装 GitHub CLI：pkg install gh -y"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "请先登录 GitHub：gh auth login"
  exit 1
fi

if [ ! -f "$backup_path" ]; then
  echo "找不到签名备份：$backup_path"
  echo "请把 KuCunBao-signing-backup.zip 放进手机下载目录后重试。"
  exit 1
fi

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
unzip -qq "$backup_path" -d "$work_dir"

keystore=$(find "$work_dir" -type f -name '*.jks' -print -quit)
signing_info=$(find "$work_dir" -type f -name '签名资料.txt' -print -quit)

if [ -z "$keystore" ] || [ -z "$signing_info" ]; then
  echo "签名备份内容不完整，必须包含 JKS 和签名资料.txt。"
  exit 1
fi

read_value() {
  sed -n "s/^$1：[[:space:]]*//p" "$signing_info" | head -n 1
}

key_alias=$(read_value '别名')
store_password=$(read_value '密钥库密码')
key_password=$(read_value '密钥密码')

if [ -z "$key_alias" ] || [ -z "$store_password" ] || [ -z "$key_password" ]; then
  echo "无法从签名资料.txt读取签名信息。"
  exit 1
fi

if command -v keytool >/dev/null 2>&1; then
  fingerprint=$(keytool -list -v \
    -keystore "$keystore" \
    -storepass "$store_password" \
    -alias "$key_alias" | sed -n 's/.*SHA256: //p' | tr -d ':[:space:]')
else
  fingerprint=$(read_value '证书 SHA-256' | tr -d ':[:space:]')
fi

if [ "$fingerprint" != "F4473D2FBFFBF24496E126DA6F6EE344616D09271224CF5E5E9DA59E03D0122E" ]; then
  echo "这不是库存宝原始固定签名备份，已停止。"
  exit 1
fi

base64 "$keystore" | tr -d '\n' | gh secret set KUCUNBAO_KEYSTORE_BASE64 --repo "$repository"
printf '%s' "$store_password" | gh secret set KUCUNBAO_STORE_PASSWORD --repo "$repository"
printf '%s' "$key_alias" | gh secret set KUCUNBAO_KEY_ALIAS --repo "$repository"
printf '%s' "$key_password" | gh secret set KUCUNBAO_KEY_PASSWORD --repo "$repository"

gh workflow run build-apk.yml --repo "$repository" --ref inventory-v1

echo "✅ 原始固定签名已安全写入 GitHub Secrets。"
echo "✅ 已触发 inventory-v1 的固定签名 APK 构建。"
echo "完成后请下载 Artifact：KuCunBao-AI-fixed-signature"
