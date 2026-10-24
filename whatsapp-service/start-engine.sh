#!/data/data/com.termux/files/usr/bin/bash
export PORT=5001
export SSL_CERT_FILE="/data/data/com.termux/files/usr/etc/tls/cert.pem"
export SSL_CERT_DIR="/data/data/com.termux/files/usr/etc/tls/certs"
export WEBHOOK_URL="https://auto-ind.vercel.app/api/whatsapp/webhook"
export APP_URL="https://auto-ind.vercel.app"

cd "$(dirname "$0")"

if [ -f "./whatsapp-service-linux-arm64" ]; then
  chmod +x ./whatsapp-service-linux-arm64
  exec ./whatsapp-service-linux-arm64
elif [ -f "./whatsapp-service-linux-arm" ]; then
  chmod +x ./whatsapp-service-linux-arm
  exec ./whatsapp-service-linux-arm
else
  echo "❌ Binário whatsapp-service não encontrado!"
  exit 1
fi
