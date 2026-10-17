@echo off
title Servidor de Transferencia para o Termux
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================================================
echo    SERVIDOR DE TRANSFERENCIA LOCAL (PC -> TERMUX CELULAR)
echo ======================================================================
echo.
echo [1] No seu celular, certifique-se de estar no mesmo Wi-Fi deste PC.
echo [2] Abra o Termux no celular e digite:
echo.
echo     curl -O http://192.168.0.109:8080/whatsapp-termux.tar.gz
echo     tar -xzvf whatsapp-termux.tar.gz
echo     bash termux-setup.sh
echo.
echo ======================================================================
echo Servidor rodando na porta 8080. Pressione Ctrl+C para encerrar quando terminar.
echo ======================================================================
echo.

python -m http.server 8080
pause
