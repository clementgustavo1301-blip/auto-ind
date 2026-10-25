#!/data/data/com.termux/files/usr/bin/bash
cd $HOME/whatsapp-service || cd ~/whatsapp-service

echo "=========================================="
echo "  🚀 INICIANDO CORREÇÃO DO MOTOR WHATSAPP "
echo "=========================================="

chmod +x whatsapp-service-linux-* *.sh 2>/dev/null || true

# 1. Limpa processo anterior do whatsapp-engine que estava com erro
pm2 delete whatsapp-engine 2>/dev/null || true

# 2. Inicia o executável arm64 diretamente com PM2 (modo nativo, sem wrapper com erro)
pm2 start ./whatsapp-service-linux-arm64 --name whatsapp-engine --interpreter none

# 3. Garante que o túnel Ngrok também esteja rodando
if ! pm2 describe whatsapp-tunnel >/dev/null 2>&1; then
  if [ -f "./start-tunnel.sh" ]; then
    pm2 start ./start-tunnel.sh --name whatsapp-tunnel --interpreter bash
  fi
fi

# 4. Salva a lista do PM2 para auto-inicialização
pm2 save

echo ""
echo "=========================================="
echo "  ✅ STATUS ATUAL DO PM2:                 "
echo "=========================================="
pm2 status
