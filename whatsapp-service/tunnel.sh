#!/data/data/com.termux/files/usr/bin/bash
echo "🔌 [Túnel] Iniciando túnel de conexão do WhatsApp Service..."

# 1. Se ngrok estiver instalado e configurado, usar com domínio persistente
if command -v ngrok &> /dev/null; then
  echo "🔌 [Túnel] Conectando via Ngrok (domínio: elusive-deduce-liver.ngrok-free.dev)..."
  exec ngrok http 5001 --domain=elusive-deduce-liver.ngrok-free.dev
fi

# 2. Se cloudflared estiver disponível
if command -v cloudflared &> /dev/null; then
  echo "🔌 [Túnel] Conectando via Cloudflare Tunnel..."
  exec cloudflared tunnel --url http://127.0.0.1:5001
fi

echo "❌ [Túnel] Nem ngrok nem cloudflared encontrados no Termux."
sleep 10
