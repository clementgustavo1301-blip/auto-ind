#!/data/data/com.termux/files/usr/bin/bash
echo "Parando WhatsApp Engine e Túnel..."
pkill -9 -f whatsapp-service-linux 2>/dev/null || true
pkill -9 -f "ngrok http 5001" 2>/dev/null || true
pm2 stop all 2>/dev/null || true
echo "✅ Todos os processos foram parados com sucesso."
