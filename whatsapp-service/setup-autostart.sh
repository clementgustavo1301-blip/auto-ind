#!/data/data/com.termux/files/usr/bin/bash
set -e

echo ""
echo "=========================================================="
echo "  🚀 CONFIGURANDO MOTOR + TÚNEL NO PM2 (AUTO-START 24/7)  "
echo "=========================================================="
echo ""

# 1. Ativa wake-lock para o Android não suspender o Termux com a tela apagada
termux-wake-lock 2>/dev/null || true
echo "✅ [1/5] Termux Wake Lock ativado"

# 2. Corrige o erro do Node.js (CANNOT LINK EXECUTABLE "node" / libc++)
echo "🔧 [2/5] Reparando dependências do Node.js e PM2..."
pkg install -y libc++ nodejs-lts curl tar 2>/dev/null || pkg install -y libc++ 2>/dev/null || true
npm install -g pm2 2>/dev/null || true
echo "✅ [2/5] Node.js e PM2 verificados"

# 3. Prepara a pasta de trabalho (remove arquivo conflitante se existir)
TARGET_DIR="$HOME/whatsapp-service"
if [ -f "$TARGET_DIR" ]; then
  rm -f "$TARGET_DIR"
fi
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

# 4. Para processos antigos no PM2 para evitar 'Text file busy'
echo "🛑 [3/5] Parando processos antigos..."
pm2 stop all 2>/dev/null || true
pkill -9 -f whatsapp-service 2>/dev/null || true
pkill -9 -f "ngrok http 5001" 2>/dev/null || true
sleep 1
rm -f whatsapp-service-linux-* 2>/dev/null || true

# 5. Baixa e descompacta os binários atualizados
echo "📦 [4/5] Baixando binários atualizados..."
curl -sSL "https://auto-ind.vercel.app/whatsapp-termux.tar.gz" -o whatsapp-termux.tar.gz
tar -xzvf whatsapp-termux.tar.gz
chmod +x whatsapp-service-linux-* 2>/dev/null || true

# 6. Inicia motor e túnel juntos no PM2
echo "⚡ [5/5] Iniciando whatsapp-engine e whatsapp-tunnel no PM2..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# 7. Configura inicialização automática no boot do Android (quando desligar/descarregar)
mkdir -p ~/.termux/boot
cat << 'EOF' > ~/.termux/boot/start-whatsapp.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true
sleep 4
cd $HOME/whatsapp-service
pm2 resurrect || pm2 start ecosystem.config.js
EOF
chmod +x ~/.termux/boot/start-whatsapp.sh

if ! grep -q "pm2 resurrect" ~/.bashrc 2>/dev/null; then
  cat << 'EOF' >> ~/.bashrc

# Auto-start WhatsApp Engine & Tunnel no PM2
termux-wake-lock 2>/dev/null || true
cd $HOME/whatsapp-service 2>/dev/null && pm2 resurrect 2>/dev/null || true
EOF
fi

echo ""
echo "=========================================================="
echo "  🎉 MOTOR E TÚNEL ESTÃO RODANDO NO PM2!"
echo "=========================================================="
pm2 status
echo ""
echo "👉 Dicas úteis:"
echo "   - Ver logs e QR code:  pm2 logs whatsapp-engine"
echo "   - Ver status do PM2:   pm2 status"
echo "   - Reiniciar ambos:     pm2 restart all"
echo "=========================================================="
