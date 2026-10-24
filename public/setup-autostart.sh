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
echo "🔧 [2/5] Verificando dependências do Node.js e PM2..."
if ! node -v >/dev/null 2>&1; then
  echo "⚠️ Detectada inconsistência no Node.js. Reparando libc++ e nodejs-lts..."
  pkg install -y libc++ libandroid-support nodejs-lts
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "📦 Instalando PM2..."
  npm install -g pm2
fi
echo "✅ [2/5] Node.js e PM2 operacionais"

# 3. Prepara a pasta de trabalho (remove arquivo conflitante se existir)
TARGET_DIR="$HOME/whatsapp-service"
if [ -f "$TARGET_DIR" ]; then
  rm -f "$TARGET_DIR"
fi
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

# 4. Para processos antigos no PM2 e fecha túneis órfãos para evitar conflito de domínio e 'Text file busy'
echo "🛑 [3/5] Parando processos antigos..."
pm2 stop all 2>/dev/null || true
pkill -9 -f whatsapp-service 2>/dev/null || true
pkill -9 -f "ngrok" 2>/dev/null || true
sleep 1
rm -f whatsapp-service-linux-* 2>/dev/null || true

# 5. Baixa e descompacta os binários atualizados
echo "📦 [4/5] Baixando binários atualizados..."
curl -sSL "https://auto-ind.vercel.app/whatsapp-termux.tar.gz" -o whatsapp-termux.tar.gz
tar -xzvf whatsapp-termux.tar.gz

# Ajusta arquitetura se o aparelho for ARM 32-bit
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
  echo "ℹ️ Arquitetura 32-bit detectada ($ARCH). Configurando binário 32-bit..."
  cp -f whatsapp-service-linux-arm whatsapp-service-linux-arm64
fi
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

