#!/data/data/com.termux/files/usr/bin/bash
set -e

echo ""
echo "=========================================================="
echo "  🚀 CONFIGURAÇÃO AUTÔNOMA 24/7 DO WHATSAPP NO TERMUX     "
echo "  (Reinicialização Automática após Descarregar/Reiniciar) "
echo "=========================================================="
echo ""

# 1. Manter celular acordado mesmo com tela desligada
termux-wake-lock 2>/dev/null || true
echo "✅ [1/5] Termux Wake Lock ativado (celular não suspenderá em segundo plano)"

# 2. Instalar dependências necessárias
pkg update -y 2>/dev/null || true
pkg install -y curl tar nodejs-lts 2>/dev/null || true
npm install -g pm2 2>/dev/null || true
echo "✅ [2/5] PM2 e ferramentas verificadas"

# 3. Baixar ou atualizar o pacote do microserviço
TARGET_DIR="$HOME/whatsapp-service"
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

echo "📦 [3/5] Baixando binários e scripts atualizados..."
pm2 stop all 2>/dev/null || true
curl -sSL "https://auto-ind.vercel.app/whatsapp-termux.tar.gz" -o whatsapp-termux.tar.gz
tar -xzvf whatsapp-termux.tar.gz
chmod +x whatsapp-service-linux-* tunnel.sh 2>/dev/null || true
echo "✅ [3/5] Binários descompactados e permissões aplicadas"

# 4. Iniciar ou reiniciar no PM2
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
echo "✅ [4/5] Processos iniciados e registrados no PM2 (pm2 save)"

# 5. Configurar inicialização automática no boot do Android (quando desligar / descarregar)
mkdir -p ~/.termux/boot
cat << 'EOF' > ~/.termux/boot/start-whatsapp.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true
sleep 4
cd $HOME/whatsapp-service 2>/dev/null || cd $HOME
pm2 resurrect || pm2 start ecosystem.config.js
EOF
chmod +x ~/.termux/boot/start-whatsapp.sh

# Adicionar também no .bashrc para auto-recuperar sempre que o usuário abrir o Termux
if ! grep -q "pm2 resurrect" ~/.bashrc 2>/dev/null; then
  cat << 'EOF' >> ~/.bashrc

# Auto-start WhatsApp Engine & Tunnel
termux-wake-lock 2>/dev/null || true
pm2 resurrect 2>/dev/null || true
EOF
fi

echo "✅ [5/5] Auto-inicialização configurada em ~/.termux/boot/start-whatsapp.sh"
echo ""
echo "=========================================================="
echo "  🎉 TUDO PRONTO E RODANDO 24/7!"
echo "=========================================================="
pm2 status
echo ""
echo "👉 Dicas úteis:"
echo "   - Para ver logs e o QR code:  pm2 logs whatsapp-engine"
echo "   - Para ver status:            pm2 status"
echo "   - Para reiniciar:             pm2 restart all"
echo "=========================================================="
