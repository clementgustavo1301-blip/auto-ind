#!/data/data/com.termux/files/usr/bin/bash

echo "🛡️ Blindando Termux contra suspensão e configurando inicialização automática..."

# 1. Ativa wake-lock do Termux
termux-wake-lock 2>/dev/null || true

# 2. Configura auto-start no Termux:Boot se instalado
mkdir -p ~/.termux/boot
cat << 'EOF' > ~/.termux/boot/start-whatsapp.sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock 2>/dev/null || true
sleep 4
cd $HOME/whatsapp-service
pm2 resurrect 2>/dev/null || pm2 restart all 2>/dev/null || true
EOF
chmod +x ~/.termux/boot/start-whatsapp.sh

# 3. Garante auto-resurrect no ~/.bashrc
if ! grep -q "pm2 resurrect" ~/.bashrc 2>/dev/null; then
  cat << 'EOF' >> ~/.bashrc

# Auto-start e Wake-Lock permanente do robô WhatsApp
termux-wake-lock 2>/dev/null || true
cd $HOME/whatsapp-service 2>/dev/null
pm2 resurrect 2>/dev/null || pm2 restart all 2>/dev/null || true
EOF
fi

# 4. Salva o dump atual do PM2
cd $HOME/whatsapp-service
pm2 save

echo "✅ Blindagem concluída com sucesso!"
