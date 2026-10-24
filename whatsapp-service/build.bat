@echo off
cd /d "%~dp0"
set CGO_ENABLED=0
set GOOS=linux
set GOARCH=arm64
echo Compiling ARM64...
go build -ldflags="-s -w" -o whatsapp-service-linux-arm64 main.go
if %ERRORLEVEL% NEQ 0 (
    echo ARM64 build failed
    exit /b 1
)

echo Compiling ARM...
set GOARCH=arm
set GOARM=7
go build -ldflags="-s -w" -o whatsapp-service-linux-arm main.go
if %ERRORLEVEL% NEQ 0 (
    echo ARM build failed
    exit /b 1
)

echo Compiling Windows...
set GOOS=windows
set GOARCH=amd64
go build -ldflags="-s -w" -o whatsapp-service.exe main.go
if %ERRORLEVEL% NEQ 0 (
    echo Windows build failed
    exit /b 1
)

echo Packaging tar.gz...
tar -czvf whatsapp-termux.tar.gz whatsapp-service-linux-arm64 whatsapp-service-linux-arm termux-setup.sh antiban_config.json ecosystem.config.json ecosystem.config.js
if not exist "..\public" mkdir "..\public"
copy /y whatsapp-termux.tar.gz ..\public\whatsapp-termux.tar.gz

echo ALL BUILDS COMPLETED SUCCESSFULLY!
