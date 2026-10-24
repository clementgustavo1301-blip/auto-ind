#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true

cd "$HOME"

# Para processos antigos
pkill -9 -f whatsapp-service-linux 2>/dev/null || true
pkill -9 -f "ngrok http 5001" 2>/dev/null || true
sleep 1

# Garante permissões de execução
chmod +x whatsapp-service-linux-* tunnel.sh 2>/dev/null || true

# 1. Inicia o WhatsApp Engine nativo com auto-restart infinito
nohup bash -c '
while true; do
  echo "=== [$(date)] Iniciando WhatsApp Engine ===" >> whatsapp-engine.log
  ./whatsapp-service-linux-arm64 >> whatsapp-engine.log 2>&1
  echo "=== [$(date)] WhatsApp Engine finalizou. Reiniciando em 3s... ===" >> whatsapp-engine.log
  sleep 3
done
' > /dev/null 2>&1 &

# 2. Inicia o Túnel Ngrok nativo com auto-restart infinito
nohup bash -c '
while true; do
  echo "=== [$(date)] Iniciando Túnel Ngrok ===" >> whatsapp-tunnel.log
  ngrok http 5001 --domain=elusive-deduce-liver.ngrok-free.dev >> whatsapp-tunnel.log 2>&1
  echo "=== [$(date)] Túnel caiu. Reiniciando em 4s... ===" >> whatsapp-tunnel.log
  sleep 4
done
' > /dev/null 2>&1 &

sleep 2
echo ""
echo "=========================================================="
echo "  ✅ SERVIÇOS INICIADOS EM SEGUNDO PLANO (NATIVO LINUX)   "
echo "=========================================================="
echo "Processos ativos:"
pgrep -fl "whatsapp-service-linux|ngrok" || echo "Verificando inicialização..."
echo ""
echo "👉 Comandos úteis:"
echo "   - Ver logs / QR code:  tail -n 30 -f whatsapp-engine.log"
echo "   - Ver status:          ./status.sh"
echo "   - Parar tudo:          ./stop.sh"
echo "=========================================================="
