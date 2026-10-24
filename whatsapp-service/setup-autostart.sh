#!/data/data/com.termux/files/usr/bin/bash
set -e

echo ""
echo "=========================================================="
echo "  🚀 ATUALIZANDO WHATSAPP ENGINE + RECEPTOR DE RESPOSTAS "
echo "=========================================================="
echo ""

# 1. Ativa wake-lock para a CPU não suspender com tela apagada
termux-wake-lock 2>/dev/null || true

# 2. Para apenas o motor do WhatsApp (o túnel Ngrok continua online!)
echo "🛑 [1/4] Parando motor WhatsApp para liberar binários..."
pm2 stop whatsapp-engine 2>/dev/null || pm2 stop all 2>/dev/null || true
pkill -9 -f whatsapp-service 2>/dev/null || true
sleep 1

# 3. Remove binários antigos (evita 100% o erro 'Text file busy')
cd "$HOME"
rm -f whatsapp-service-linux-* 2>/dev/null || true

# 4. Baixa e descompacta a nova versão com receptor de mensagens (/api/inbound + webhook)
echo "📦 [2/4] Baixando versão atualizada com escuta e QR Code automático..."
curl -sSL "https://auto-ind.vercel.app/whatsapp-termux.tar.gz" -o whatsapp-termux.tar.gz
tar -xzvf whatsapp-termux.tar.gz
chmod +x whatsapp-service-linux-* tunnel.sh setup-autostart.sh 2>/dev/null || true

# 5. Reinicia o motor no PM2
echo "⚡ [3/4] Reiniciando motor com escuta de respostas..."
pm2 restart whatsapp-engine 2>/dev/null || pm2 start ecosystem.config.js 2>/dev/null || true
pm2 save 2>/dev/null || true

# 6. Configura auto-boot caso o celular desligue ou descarregue
mkdir -p ~/.termux/boot
cat << 'EOF' > ~/.termux/boot/start-whatsapp.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true
sleep 4
cd $HOME
pm2 resurrect || pm2 start ecosystem.config.js
EOF
chmod +x ~/.termux/boot/start-whatsapp.sh

if ! grep -q "pm2 resurrect" ~/.bashrc 2>/dev/null; then
  cat << 'EOF' >> ~/.bashrc

# Auto-start WhatsApp Engine & Tunnel
termux-wake-lock 2>/dev/null || true
pm2 resurrect 2>/dev/null || true
EOF
fi

echo "✅ [4/4] Auto-inicialização configurada com sucesso!"
echo ""
echo "=========================================================="
echo "  🎉 ATUALIZAÇÃO CONCLUÍDA! O MOTOR AGORA RECEBE RESPOSTAS!"
echo "=========================================================="
pm2 status
echo ""
echo "👉 Veja o status ou escaneie o QR Code com:"
echo "   pm2 logs whatsapp-engine"
echo "=========================================================="
