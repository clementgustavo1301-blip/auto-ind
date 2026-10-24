#!/data/data/com.termux/files/usr/bin/bash
if command -v ngrok >/dev/null 2>&1; then
  NGROK_CMD="ngrok"
elif [ -f "$PREFIX/bin/ngrok" ]; then
  NGROK_CMD="$PREFIX/bin/ngrok"
elif [ -f "$HOME/ngrok" ]; then
  NGROK_CMD="$HOME/ngrok"
else
  NGROK_CMD="ngrok"
fi

echo "Iniciando Ngrok tunnel para localhost:5001 no domínio elusive-deduce-liver.ngrok-free.dev..."
exec $NGROK_CMD http 5001 --domain=elusive-deduce-liver.ngrok-free.dev
