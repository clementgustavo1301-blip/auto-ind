#!/data/data/com.termux/files/usr/bin/bash
echo ""
echo "=========================================================="
echo "  📊 STATUS DOS PROCESSOS NATIVOS                         "
echo "=========================================================="
if pgrep -fl "whatsapp-service-linux" > /dev/null; then
  echo "🟢 WhatsApp Engine: RODANDO (PID: $(pgrep -f whatsapp-service-linux))"
else
  echo "🔴 WhatsApp Engine: PARADO"
fi

if pgrep -fl "ngrok" > /dev/null; then
  echo "🟢 Túnel Ngrok:     RODANDO (PID: $(pgrep -f ngrok))"
else
  echo "🔴 Túnel Ngrok:     PARADO"
fi

echo ""
echo "=== ÚLTIMAS 10 LINHAS DO LOG ==="
tail -n 10 whatsapp-engine.log 2>/dev/null || echo "Sem logs no momento."
echo "=========================================================="
