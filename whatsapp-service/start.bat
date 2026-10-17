@echo off
title WhatsApp Whatsmeow Microservice (Anti-Ban & Intelligent Queue)
chcp 65001 >nul

echo ======================================================================
echo    MICROSERVICO WHATSAPP (100% MEMORIA - SEM BANCO DE DADOS EM DISCO)
echo    Fila Sequencial Inteligente e Digitacao Humanizada Anti-Ban
echo ======================================================================

set "PATH=C:\Program Files\Go\bin;%PATH%"

if not defined PORT (
    set "PORT=5001"
)

echo.
echo [INFO] Porta configurada: %PORT%
echo [INFO] Interface Web / QR Code: http://localhost:%PORT%/api/qr
echo [INFO] Endpoint de Disparo:     http://localhost:%PORT%/api/send
echo.

if exist "whatsapp-service.exe" (
    echo [INFO] Executando binario otimizado whatsapp-service.exe...
    whatsapp-service.exe
) else (
    where go >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERRO] Go nao encontrado no PATH ou em C:\Program Files\Go\bin.
        echo Por favor, instale o Go ou compile o whatsapp-service.exe.
        pause
        exit /b 1
    )
    echo [INFO] Executando via go run main.go...
    go run main.go
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] O microservico encerrou com codigo de erro %ERRORLEVEL%.
    pause
)
