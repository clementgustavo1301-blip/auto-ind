#!/data/data/com.termux/files/usr/bin/bash

echo ""
echo "=========================================================="
echo "  🚀 RESTAURAÇÃO TOTAL: MOTOR + TÚNEL 24/7 (AUTO-HEAL)   "
echo "=========================================================="
echo ""

# 1. Ativa wake-lock para o Android não suspender o Termux com tela apagada
termux-wake-lock 2>/dev/null || true
echo "✅ [1/7] Termux Wake Lock ativado"

# 2. Configura DNS público confiável (Google e Cloudflare) para o Ngrok
mkdir -p "$PREFIX/etc"
echo "nameserver 8.8.8.8" > "$PREFIX/etc/resolv.conf"
echo "nameserver 1.1.1.1" >> "$PREFIX/etc/resolv.conf"
echo "✅ [2/7] DNS público configurado (8.8.8.8 / 1.1.1.1)"

# 3. Verifica e repara dependências essenciais (Node, libc++, proot, PM2)
echo "🔧 [3/7] Verificando dependências do sistema..."
if ! node -v >/dev/null 2>&1; then
  echo "⚠️ Reparando libc++ e Node.js LTS..."
  pkg install -y libc++ libandroid-support nodejs-lts
fi

if ! command -v proot >/dev/null 2>&1; then
  echo "📦 Instalando proot..."
  pkg install -y proot
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "📦 Instalando PM2..."
  npm install -g pm2
fi
echo "✅ [3/7] Dependências operacionais"

# 4. Libera a porta 5001 e fecha processos antigos
echo "🛑 [4/7] Limpando processos antigos na porta 5001..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
kill -9 $(lsof -t -i:5001 2>/dev/null) 2>/dev/null || true
pkill -9 -f whatsapp-service 2>/dev/null || true
pkill -9 -f ngrok 2>/dev/null || true
sleep 1

# 5. Prepara a pasta de trabalho e baixa binários com QR contínuo e auto-recuperação
TARGET_DIR="$HOME/whatsapp-service"
[ -f "$TARGET_DIR" ] && rm -f "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

echo "📦 [5/7] Baixando binários atualizados..."
curl -sSL "https://auto-ind.vercel.app/whatsapp-termux.tar.gz?v=$(date +%s)" -o whatsapp-termux.tar.gz
tar -xzvf whatsapp-termux.tar.gz

# 6. Cria scripts executáveis para o PM2
cat << 'EOF' > start-engine.sh
#!/data/data/com.termux/files/usr/bin/bash
cd $HOME/whatsapp-service
export PORT=5001
export SSL_CERT_FILE="/data/data/com.termux/files/usr/etc/tls/cert.pem"
export SSL_CERT_DIR="/data/data/com.termux/files/usr/etc/tls/certs"
export WEBHOOK_URL="https://auto-ind.vercel.app/api/whatsapp/webhook"
export APP_URL="https://auto-ind.vercel.app"

ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  BIN="./whatsapp-service-linux-arm64"
else
  BIN="./whatsapp-service-linux-arm"
fi

chmod +x "$BIN" 2>/dev/null || true
exec "$BIN"
EOF
chmod +x start-engine.sh

cat << 'EOF' > start-tunnel.sh
#!/data/data/com.termux/files/usr/bin/bash
export SSL_CERT_FILE="/data/data/com.termux/files/usr/etc/tls/cert.pem"
export SSL_CERT_DIR="/data/data/com.termux/files/usr/etc/tls/certs"

if command -v termux-chroot >/dev/null 2>&1; then
  exec termux-chroot ngrok http 5001 --url=elusive-deduce-liver.ngrok-free.dev --log=stdout
else
  exec ngrok http 5001 --url=elusive-deduce-liver.ngrok-free.dev --log=stdout
fi
EOF
chmod +x start-tunnel.sh

# 7. Inicia no PM2 com auto-restart 24/7
echo "⚡ [6/7] Iniciando whatsapp-engine e whatsapp-tunnel no PM2..."
pm2 start ./start-engine.sh --name whatsapp-engine --interpreter bash
pm2 start ./start-tunnel.sh --name whatsapp-tunnel --interpreter bash
pm2 save

# 8. Garante auto-start no reboot do Android
mkdir -p ~/.termux/boot
cat << 'EOF' > ~/.termux/boot/start-whatsapp.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true
sleep 4
cd $HOME/whatsapp-service
pm2 resurrect || (pm2 start ./start-engine.sh --name whatsapp-engine --interpreter bash && pm2 start ./start-tunnel.sh --name whatsapp-tunnel --interpreter bash)
EOF
chmod +x ~/.termux/boot/start-whatsapp.sh

if ! grep -q "pm2 resurrect" ~/.bashrc 2>/dev/null; then
  cat << 'EOF' >> ~/.bashrc

# Auto-start WhatsApp Engine & Tunnel no PM2
termux-wake-lock 2>/dev/null || true
cd $HOME/whatsapp-service 2>/dev/null && pm2 resurrect 2>/dev/null || true
EOF
fi

echo "✅ [7/7] Auto-start configurado com sucesso!"
echo ""
echo "=========================================================="
echo "  🎉 MOTOR E TÚNEL ESTÃO RODANDO NO PM2 (24/7 ONLINE)!"
echo "=========================================================="
echo ""
echo "🌐 LINK DIRETO DO QR CODE NO NAVEGADOR:"
echo "   👉 https://elusive-deduce-liver.ngrok-free.dev/api/qr"
echo ""
echo "📱 PAINEL DE CONTROLE:"
echo "   👉 https://auto-ind.vercel.app"
echo ""
pm2 status
echo ""
echo "⏳ Aguardando inicialização para exibir QR Code..."
sleep 4
echo "=========================================================="
pm2 logs --lines 18 --nostream || true
echo "=========================================================="
echo "👉 Dicas úteis:"
echo "   - Ver logs e QR code em tempo real:  pm2 logs whatsapp-engine"
echo "   - Ver logs do túnel em tempo real:   pm2 logs whatsapp-tunnel"
echo "   - Reiniciar ambos:                   pm2 restart all"
echo "=========================================================="
