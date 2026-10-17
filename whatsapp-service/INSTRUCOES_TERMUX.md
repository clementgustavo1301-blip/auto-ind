# 📱 Guia de Execução do Motor WhatsApp no Termux (Android) com PM2 e Cloudflare Tunnel

Este guia orienta como colocar o microserviço Go (`whatsapp-service`) rodando em segundo plano no seu celular Android utilizando **Termux**, **PM2** e **Cloudflare Quick Tunnel**.

---

## 📦 Arquivos Preparados no Pacote

Já compilamos e empacotamos tudo o que você precisa no arquivo:
`whatsapp-service/whatsapp-termux.tar.gz`

Conteúdo do pacote:
1. `whatsapp-service-linux-arm64`: Binário compilado nativamente para processadores ARM64 (Android).
2. `antiban_config.json`: Arquivo de limites e intervalos humanizados anti-ban.
3. `ecosystem.config.js`: Configuração do PM2 para gerenciar o motor Go e o túnel Cloudflare simultaneamente.
4. `termux-setup.sh`: Script automatizado de configuração e inicialização.

---

## 🚀 Passo a Passo Rápido

### Passo 1: Preparar o Termux no Celular
1. Certifique-se de estar usando o **Termux baixado pelo F-Droid** (a versão da Google Play Store está desatualizada).
2. Abra o aplicativo Termux no celular.

---

### Passo 2: Transferir o Pacote para o Celular

#### Opção A (Recomendada - Via Wi-Fi):
1. No seu computador, dê um duplo clique no arquivo:
   `whatsapp-service/iniciar-servidor-transferencia.bat`
   *(Ou execute no terminal: `python -m http.server 8080` dentro da pasta `whatsapp-service`)*.
2. Certifique-se de que o celular está no **mesmo Wi-Fi** do computador.
3. No Termux do celular, digite os comandos:
   ```bash
   curl -O http://192.168.0.109:8080/whatsapp-termux.tar.gz
   tar -xzvf whatsapp-termux.tar.gz
   ```

#### Opção B (Via Cabo USB ou Download):
1. Copie o arquivo `whatsapp-termux.tar.gz` para a pasta **Downloads** do seu celular.
2. No Termux, execute:
   ```bash
   termux-setup-storage
   cp /sdcard/Download/whatsapp-termux.tar.gz ~/
   tar -xzvf whatsapp-termux.tar.gz
   ```

---

### Passo 3: Executar a Instalação Automatizada

Dentro do Termux, execute:
```bash
bash termux-setup.sh
```

O script irá automaticamente:
- ✅ Ativar o **Wake Lock** (`termux-wake-lock`) para não suspender com a tela apagada.
- ✅ Instalar **Node.js** e **PM2**.
- ✅ Baixar e configurar o **Cloudflared** para ARM64.
- ✅ Dar permissão de execução ao motor Go.
- ✅ Iniciar o motor e o túnel sob o **PM2**.

---

### Passo 4: Conectar o WhatsApp (QR Code)

1. Para escanear o QR Code, abra no navegador do próprio celular:
   ```text
   http://localhost:5001/api/qr
   ```
2. Ou veja a URL pública gerada pelo Cloudflare Tunnel com o comando:
   ```bash
   pm2 logs whatsapp-tunnel --lines 30
   ```
   Procure pela linha com o link no formato:
   `https://[palavras-aleatorias].trycloudflare.com`

   Você pode acessar:
   `https://[seu-túnel].trycloudflare.com/api/qr`

3. No WhatsApp do seu aparelho (ou aparelho secundário), vá em:
   **Aparelhos conectados > Conectar um aparelho** e aponte para o QR Code exibido.

---

### Passo 5: Conectar o Frontend Next.js ao Motor no Celular

No seu arquivo `.env.local` no computador (ou nas variáveis da Vercel):
```env
WHATSAPP_SERVICE_URL=https://[seu-túnel].trycloudflare.com
```
*(Se estiver testando na mesma rede Wi-Fi local sem túnel, você também pode usar `http://[IP_DO_CELULAR]:5001`)*.

---

## ⚙️ Comandos Úteis do PM2 no Termux

- **Ver status dos processos:**
  ```bash
  pm2 status
  ```
- **Ver logs em tempo real:**
  ```bash
  pm2 logs
  ```
- **Ver logs apenas do túnel (para ver o link):**
  ```bash
  pm2 logs whatsapp-tunnel
  ```
- **Reiniciar os serviços:**
  ```bash
  pm2 restart all
  ```
- **Parar os serviços:**
  ```bash
  pm2 stop all
  ```

---

## 🔋 Dica Crítica de Bateria no Android
Para garantir que o Android nunca encerre o Termux em segundo plano:
1. Abra as **Configurações do Android** > **Aplicativos** > **Termux**.
2. Vá em **Bateria** e selecione **Irrestrito** (Sem restrições de economia de bateria).
3. Se o aparelho tiver gerenciador de memória (Xiaomi, Samsung, etc.), fixe o aplicativo do Termux na tela de recentes (cadeado).
