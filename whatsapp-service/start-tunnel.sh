#!/data/data/com.termux/files/usr/bin/bash
export SSL_CERT_FILE="/data/data/com.termux/files/usr/etc/tls/cert.pem"
export SSL_CERT_DIR="/data/data/com.termux/files/usr/etc/tls/certs"

if command -v termux-chroot >/dev/null 2>&1; then
  exec termux-chroot ngrok http 5001 --url=elusive-deduce-liver.ngrok-free.dev
else
  exec ngrok http 5001 --url=elusive-deduce-liver.ngrok-free.dev
fi
