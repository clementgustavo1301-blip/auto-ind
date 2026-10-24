#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Setup Automatizado do Motor WhatsApp + PM2 + Cloudflare Tunnel no Termux
# Suporta nativamente arquiteturas 32-bit (arm) e 64-bit (aarch64/arm64)
# ==============================================================================

set -e

echo "🚀 Iniciando configuração do Motor WhatsApp no Termux..."

# 1. Ativar Wake Lock para o Android não suspender o processo com a tela apagada
echo "🔋 Ativando Wake Lock (termux-wake-lock)..."
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
    echo "✅ Wake Lock ativo!"
else
    echo "⚠️ Comando termux-wake-lock não encontrado (instale termux-tools se necessário)."
fi

# 2. Configurar DNS público no Termux
echo "🌐 Configurando DNS público no Termux..."
mkdir -p "$PREFIX/etc"
echo "nameserver 1.1.1.1" > "$PREFIX/etc/resolv.conf"
echo "nameserver 8.8.8.8" >> "$PREFIX/etc/resolv.conf"

# 3. Atualizar repositórios e instalar dependências essenciais
echo "📦 Verificando dependências (Node.js, ca-certificates, proot, curl, tar)..."
pkg update -y
pkg install -y nodejs ca-certificates proot curl tar

# 4. Instalar PM2 globalmente se não estiver instalado
if ! command -v pm2 >/dev/null 2>&1; then
    echo "⚡ Instalando PM2 globalmente..."
    npm install -g pm2
else
    echo "✅ PM2 já instalado!"
fi

# 5. Detectar Arquitetura do Aparelho (32-bit ARM vs 64-bit ARM64)
ARCH=$(uname -m)
echo "📱 Arquitetura detectada do seu aparelho: $ARCH"

if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    BIN_NAME="whatsapp-service-linux-arm64"
    CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
else
    BIN_NAME="whatsapp-service-linux-arm"
    CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
fi

# 6. Baixar ou atualizar Cloudflared compatível com a arquitetura
echo "🌐 Baixando binário oficial do Cloudflared ($ARCH)..."
curl -L "$CF_URL" -o "$PREFIX/bin/cloudflared"
chmod +x "$PREFIX/bin/cloudflared"
echo "✅ Cloudflared pronto!"

# 7. Garantir permissão de execução no binário do motor Go correto
if [ -f "$BIN_NAME" ]; then
    chmod +x "$BIN_NAME"
    echo "✅ Executável $BIN_NAME pronto com permissão de execução!"
else
    echo "❌ Executável $BIN_NAME não encontrado!"
    exit 1
fi

# 8. Criar script wrapper para o Cloudflared com termux-chroot (garante /etc/resolv.conf e certificados no Android)
cat <<'EOF' > start-tunnel.sh
#!/data/data/com.termux/files/usr/bin/bash
export SSL_CERT_FILE="/data/data/com.termux/files/usr/etc/tls/cert.pem"
export SSL_CERT_DIR="/data/data/com.termux/files/usr/etc/tls/certs"
if command -v termux-chroot >/dev/null 2>&1; then
    exec termux-chroot cloudflared tunnel --edge-ip-version 4 --url http://127.0.0.1:5001
else
    exec cloudflared tunnel --edge-ip-version 4 --url http://127.0.0.1:5001
fi
EOF
chmod +x start-tunnel.sh

# 9. Criar configuração PM2 compatível
CERT_FILE="/data/data/com.termux/files/usr/etc/tls/cert.pem"
CERT_DIR="/data/data/com.termux/files/usr/etc/tls/certs"
cat <<EOF > ecosystem.config.json
{
  "apps": [
    {
      "name": "whatsapp-engine",
      "script": "./$BIN_NAME",
      "interpreter": "none",
      "exec_mode": "fork",
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "250M",
      "env": {
        "PORT": "5001",
        "SSL_CERT_FILE": "$CERT_FILE",
        "SSL_CERT_DIR": "$CERT_DIR",
        "WEBHOOK_URL": "https://auto-ind.vercel.app/api/whatsapp/webhook",
        "APP_URL": "https://auto-ind.vercel.app"
      }
    },
    {
      "name": "whatsapp-tunnel",
      "script": "./start-tunnel.sh",
      "interpreter": "/data/data/com.termux/files/usr/bin/bash",
      "exec_mode": "fork",
      "autorestart": true,
      "watch": false,
      "env": {
        "SSL_CERT_FILE": "$CERT_FILE",
        "SSL_CERT_DIR": "$CERT_DIR"
      }
    }
  ]
}
EOF

# 10. Iniciar serviços via PM2 (limpando processos e logs antigos)
echo "🚀 Iniciando serviços com PM2..."
pm2 delete all 2>/dev/null || true
pm2 flush 2>/dev/null || true
pm2 start ecosystem.config.json
pm2 save

echo ""
echo "=============================================================================="
echo "🎉 MOTOR WHATSAPP E TÚNEL INICIADOS COM SUCESSO!"
echo "=============================================================================="
echo ""
echo "Comandos úteis:"
echo "  • Ver status:        pm2 status"
echo "  • Ver logs gerais:   pm2 logs"
echo "  • Ver URL do túnel:  pm2 logs whatsapp-tunnel --lines 30"
echo "  • Parar tudo:        pm2 stop all"
echo "  • Reiniciar tudo:    pm2 restart all"
echo ""
echo "Aguardando geração do link do Cloudflare Tunnel..."
sleep 6
pm2 logs whatsapp-tunnel --lines 30 --nostream | grep -Eo "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" || echo "Dica: execute 'pm2 logs whatsapp-tunnel --lines 30' para ver o link público gerado."
echo "=============================================================================="
