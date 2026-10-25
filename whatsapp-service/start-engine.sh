#!/data/data/com.termux/files/usr/bin/bash
cd $HOME/whatsapp-service
export PORT=5001
export SSL_CERT_FILE="/data/data/com.termux/files/usr/etc/tls/cert.pem"
export SSL_CERT_DIR="/data/data/com.termux/files/usr/etc/tls/certs"
export WEBHOOK_URL="https://auto-ind.vercel.app/api/whatsapp/webhook"
export APP_URL="https://auto-ind.vercel.app"

if [ -f "./whatsapp-service-linux-arm64" ]; then
  BIN="./whatsapp-service-linux-arm64"
elif [ -f "./whatsapp-service-linux-arm" ]; then
  BIN="./whatsapp-service-linux-arm"
else
  BIN="./whatsapp-service-linux-arm64"
fi

if [ ! -f "$BIN" ]; then
  if [ -f "./whatsapp-service-bin" ]; then
    BIN="./whatsapp-service-bin"
  elif [ -f "./whatsapp-service-linux-arm" ]; then
    BIN="./whatsapp-service-linux-arm"
  else
    BIN="./whatsapp-service-linux-arm64"
  fi
fi

chmod +x "$BIN" 2>/dev/null || true
exec "$BIN"
