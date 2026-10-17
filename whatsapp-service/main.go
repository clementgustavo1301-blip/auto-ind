package main

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode"

	_ "modernc.org/sqlite"

	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

// 🌐 Resolver DNS e Certificados TLS nativos para Android / Termux:
// 1. No Android, /etc/resolv.conf não existe na raiz, fazendo o Go tentar [::1]:53.
//    Forçamos consulta direta aos servidores DNS públicos (1.1.1.1 e 8.8.8.8).
// 2. No Android/Termux, /etc/ssl/certs não existe na raiz e a store /system/etc/security/cacerts
//    de aparelhos antigos não possui as CAs recentes do WhatsApp (gerando x509: certificate signed by unknown authority).
//    Apontamos SSL_CERT_FILE para o bundle do Termux e habilitamos fallback TLS no DefaultTransport
//    (a criptografia ponta-a-ponta do WhatsApp já valida a chave pública oficial via protocolo Noise).
func init() {
	termuxCertFiles := []string{
		"/data/data/com.termux/files/usr/etc/tls/cert.pem",
		"/data/data/com.termux/files/usr/etc/tls/certs/ca-certificates.crt",
	}
	if prefix := os.Getenv("PREFIX"); prefix != "" {
		termuxCertFiles = append([]string{prefix + "/etc/tls/cert.pem"}, termuxCertFiles...)
	}
	if os.Getenv("SSL_CERT_FILE") == "" {
		for _, path := range termuxCertFiles {
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				_ = os.Setenv("SSL_CERT_FILE", path)
				break
			}
		}
	}

	dnsServers := []string{"1.1.1.1:53", "8.8.8.8:53", "1.0.0.1:53", "8.8.4.4:53"}
	net.DefaultResolver = &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			d := net.Dialer{Timeout: 4 * time.Second}
			var lastErr error
			for _, srv := range dnsServers {
				conn, err := d.DialContext(ctx, "udp", srv)
				if err == nil {
					return conn, nil
				}
				lastErr = err
			}
			return nil, lastErr
		},
	}

	if tr, ok := http.DefaultTransport.(*http.Transport); ok {
		if tr.TLSClientConfig == nil {
			tr.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
		} else {
			tr.TLSClientConfig.InsecureSkipVerify = true
		}
	}
}

// ============================================================================
// CONFIGURAÇÕES ANTI-BAN E MODELOS
// ============================================================================

const (
	ConfigFilePath = "antiban_config.json"
	ServerPort     = ":5001"
)

type AntiBanConfig struct {
	Port          int    `json:"port,omitempty"`
	DailyLimit    int    `json:"daily_limit"`
	MinDelaySec   int    `json:"min_delay_sec"`
	MaxDelaySec   int    `json:"max_delay_sec"`
	TypingSpeedMs int    `json:"typing_speed_ms"`
	MinTypingSec  int    `json:"min_typing_sec"`
	MaxTypingSec  int    `json:"max_typing_sec"`
	SentToday     int    `json:"sent_today"`
	LastResetDate string `json:"last_reset_date"`
}

type QueueItem struct {
	ID        string     `json:"id"`
	Phone     string     `json:"phone"`
	Message   string     `json:"message"`
	MediaURL  string     `json:"media_url,omitempty"`
	Status    string     `json:"status"` // queued, typing, sent, failed, limit_reached
	CreatedAt time.Time  `json:"created_at"`
	SentAt    *time.Time `json:"sent_at,omitempty"`
	Error     string     `json:"error,omitempty"`
}

type SendRequest struct {
	Phone    string `json:"phone"`
	Message  string `json:"message"`
	MediaURL string `json:"media_url,omitempty"`
}

type SendResponse struct {
	Success       bool   `json:"success"`
	Queued        bool   `json:"queued"`
	QueueID       string `json:"queue_id"`
	QueuePosition int    `json:"queue_position"`
	Message       string `json:"message"`
	Error         string `json:"error,omitempty"`
}

type StatusResponse struct {
	Connected     bool   `json:"connected"`
	LoggedIn      bool   `json:"logged_in"`
	HasQR         bool   `json:"has_qr"`
	JID           string `json:"jid,omitempty"`
	SentToday     int    `json:"sent_today"`
	DailyLimit    int    `json:"daily_limit"`
	LimitReached  bool   `json:"limit_reached"`
	QueueLength   int    `json:"queue_length"`
	LastResetDate string `json:"last_reset_date"`
}

// ============================================================================
// GERENCIADOR GLOBAL DO MICROSERVIÇO
// ============================================================================

type ServiceManager struct {
	client       *whatsmeow.Client
	container    *sqlstore.Container
	ctx          context.Context
	pairMu       sync.Mutex
	pairing      bool
	config       AntiBanConfig
	cfgMu        sync.RWMutex
	queue        []*QueueItem
	queueMu      sync.RWMutex
	notifyCh     chan struct{}
	qrCodeRaw    string
	qrCodeBase64 string
	qrMu         sync.RWMutex
}

var appManager *ServiceManager

// ============================================================================
// PERSISTÊNCIA DA CONFIGURAÇÃO ANTI-BAN
// ============================================================================

func loadConfig() AntiBanConfig {
	defaultCfg := AntiBanConfig{
		DailyLimit:    15,
		MinDelaySec:   30,
		MaxDelaySec:   70,
		TypingSpeedMs: 150,
		MinTypingSec:  3,
		MaxTypingSec:  15,
		SentToday:     0,
		LastResetDate: time.Now().Format("2006-01-02"),
	}

	data, err := os.ReadFile(ConfigFilePath)
	if err != nil {
		saveConfig(defaultCfg)
		return defaultCfg
	}

	var cfg AntiBanConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Printf("⚠️ Erro ao ler %s, recriando padrão: %v", ConfigFilePath, err)
		saveConfig(defaultCfg)
		return defaultCfg
	}

	today := time.Now().Format("2006-01-02")
	if cfg.LastResetDate != today {
		log.Printf("🔄 Virada de meia-noite detectada! Resetando sent_today (%s -> %s)", cfg.LastResetDate, today)
		cfg.SentToday = 0
		cfg.LastResetDate = today
		saveConfig(cfg)
	}

	return cfg
}

func saveConfig(cfg AntiBanConfig) {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		log.Printf("❌ Erro ao serializar config: %v", err)
		return
	}
	_ = os.WriteFile(ConfigFilePath, data, 0644)
}

func (s *ServiceManager) checkMidnightReset() {
	s.cfgMu.Lock()
	defer s.cfgMu.Unlock()

	today := time.Now().Format("2006-01-02")
	if s.config.LastResetDate != today {
		log.Printf("🕛 [Meia-Noite] Resetando contador diário de disparos (anterior: %d, data: %s -> %s)",
			s.config.SentToday, s.config.LastResetDate, today)
		s.config.SentToday = 0
		s.config.LastResetDate = today
		saveConfig(s.config)
	}
}

// ============================================================================
// NORMALIZAÇÃO DE NÚMERO (BRASIL + INTERNACIONAL) E ANTI-LID
// ============================================================================

var brazilianDDDs = map[string]bool{
	"11": true, "12": true, "13": true, "14": true, "15": true, "16": true, "17": true, "18": true, "19": true,
	"21": true, "22": true, "24": true, "27": true, "28": true,
	"31": true, "32": true, "33": true, "34": true, "35": true, "37": true, "38": true,
	"41": true, "42": true, "43": true, "44": true, "45": true, "46": true, "47": true, "48": true, "49": true,
	"51": true, "53": true, "54": true, "55": true,
	"61": true, "62": true, "63": true, "64": true, "65": true, "66": true, "67": true, "68": true, "69": true,
	"71": true, "73": true, "74": true, "75": true, "77": true, "79": true,
	"81": true, "82": true, "83": true, "84": true, "85": true, "86": true, "87": true, "88": true, "89": true,
	"91": true, "92": true, "93": true, "94": true, "95": true, "96": true, "97": true, "98": true, "99": true,
}

func digitsOnly(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if unicode.IsDigit(r) {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

// Número nacional brasileiro sem DDI: DDD + 8 dígitos (fixo) ou DDD + 9 + 8 dígitos (celular)
func looksLikeBrazilianNational(n string) bool {
	if len(n) != 10 && len(n) != 11 {
		return false
	}
	if !brazilianDDDs[n[:2]] {
		return false
	}
	if len(n) == 11 {
		return n[2] == '9'
	}
	return n[2] >= '2' && n[2] <= '9'
}

// phoneCandidates retorna os números (formato E.164 sem "+") a testar, em ordem de prioridade.
// - "+..." ou "00..." => número internacional explícito, usado como está
// - 10/11 dígitos com DDD brasileiro válido => assume Brasil (+55), com fallback para os dígitos crus
// - qualquer outro => assume que já contém o DDI do país
func phoneCandidates(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	explicitIntl := strings.HasPrefix(trimmed, "+")
	digits := digitsOnly(trimmed)
	if strings.HasPrefix(digits, "00") {
		digits = digits[2:]
		explicitIntl = true
	}
	if digits == "" {
		return nil
	}

	var bases []string
	if explicitIntl {
		bases = []string{digits}
	} else {
		national := digits
		if strings.HasPrefix(national, "0") {
			national = national[1:] // prefixo de tronco nacional (ex: 011 99999-8888)
		}
		if looksLikeBrazilianNational(national) {
			bases = append(bases, "55"+national)
		}
		bases = append(bases, digits)
	}

	seen := map[string]bool{}
	var out []string
	add := func(p string) {
		if p != "" && !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	for _, b := range bases {
		add(b)
		add(toggleNinthDigit(b))
	}
	return out
}

func toggleNinthDigit(phone string) string {
	// Padrão Brasil com DDI: 55 + DDD (2 digitos) + restante
	if !strings.HasPrefix(phone, "55") || len(phone) < 12 {
		return ""
	}
	ddd := phone[2:4]
	rest := phone[4:]

	// Se tem 13 dígitos e começa com 9 no resto -> experimentar sem o 9 (12 dígitos)
	if len(phone) == 13 && strings.HasPrefix(rest, "9") {
		return "55" + ddd + rest[1:]
	}

	// Se tem 12 dígitos -> experimentar adicionando o 9 após o DDD (13 dígitos)
	if len(phone) == 12 {
		return "55" + ddd + "9" + rest
	}

	return ""
}

// Resolve destinatário garantindo SEMPRE @s.whatsapp.net e nunca @lid
func (s *ServiceManager) resolveRecipientJID(ctx context.Context, rawPhone string) (types.JID, error) {
	candidates := phoneCandidates(rawPhone)
	if len(candidates) == 0 {
		return types.EmptyJID, fmt.Errorf("número inválido: %q", rawPhone)
	}

	// Testa cada candidato (Brasil, nono dígito, internacional) até achar um registrado
	var item types.IsOnWhatsAppResponse
	cleanPhone := ""
	var lastErr error
	for _, candidate := range candidates {
		// whatsmeow exige formato internacional com "+"
		resp, err := s.client.IsOnWhatsApp(ctx, []string{"+" + candidate})
		if err != nil {
			lastErr = err
			log.Printf("⚠️ [JID Resolver] Erro ao consultar +%s: %v", candidate, err)
			continue
		}
		if len(resp) > 0 && resp[0].IsIn {
			item = resp[0]
			cleanPhone = candidate
			break
		}
		log.Printf("🔎 [JID Resolver] +%s não registrado no WhatsApp", candidate)
	}

	if cleanPhone == "" {
		if lastErr != nil {
			return types.EmptyJID, fmt.Errorf("falha ao consultar o WhatsApp para %s: %v", rawPhone, lastErr)
		}
		return types.EmptyJID, fmt.Errorf("o número %s não está registrado no WhatsApp (testados: +%s)", rawPhone, strings.Join(candidates, ", +"))
	}

	// 🛡️ REGRA CRÍTICA ANTI-LID:
	// Se a resposta trouxer um JID com server @lid, NUNCA enviar para ele!
	// Sempre usar a JID com @s.whatsapp.net
	if !item.PhoneNumber.IsEmpty() && item.PhoneNumber.Server == types.DefaultUserServer {
		log.Printf("🎯 [JID Resolver] Resolvido via item.PhoneNumber: %s (Original JID: %s)", item.PhoneNumber, item.JID)
		return item.PhoneNumber, nil
	}

	if item.JID.Server == types.DefaultUserServer {
		return item.JID, nil
	}

	// Forçar JID com o número de telefone normalizado em @s.whatsapp.net
	resolvedJID := types.NewJID(cleanPhone, types.DefaultUserServer)
	log.Printf("🛡️ [Anti-LID] JID de entrada era '%s' (@lid detectado). Convertido com sucesso para JID oficial: %s", item.JID, resolvedJID)
	return resolvedJID, nil
}

// ============================================================================
// SIMULAÇÃO DE DIGITAÇÃO HUMANIZADA E DISPARO AVANÇADO (ANTI-BAN)
// ============================================================================

func calculateTypingDuration(text string, cfg AntiBanConfig) time.Duration {
	charCount := len([]rune(text))
	baseMs := charCount * cfg.TypingSpeedMs

	// Pontuações e quebras de linha geram pausas reflexivas humanas
	commaCount := strings.Count(text, ",") + strings.Count(text, ";")
	periodCount := strings.Count(text, ".") + strings.Count(text, "!") + strings.Count(text, "?")
	newlineCount := strings.Count(text, "\n")

	// Ponderação cognitiva de pausas:
	punctuationMs := (commaCount * 280) + (periodCount * 450) + (newlineCount * 700)
	totalMs := baseMs + punctuationMs

	minMs := cfg.MinTypingSec * 1000
	maxMs := cfg.MaxTypingSec * 1000

	if totalMs < minMs {
		totalMs = minMs
	}
	if totalMs > maxMs {
		totalMs = maxMs
	}

	// Oscilação humana dinâmica (jitter de ±20%)
	jitter := 0.80 + (rand.Float64() * 0.40) // 0.80 a 1.20
	finalMs := int(float64(totalMs) * jitter)

	return time.Duration(finalMs) * time.Millisecond
}

func (s *ServiceManager) simulateHumanTyping(ctx context.Context, targetJID types.JID, message string, cfg AntiBanConfig) {
	totalDuration := calculateTypingDuration(message, cfg)
	totalSec := totalDuration.Seconds()

	log.Printf("✍️ [Digitando...] Simulando humano para %s (Duração total estimada: %.2fs com oscilação)", targetJID.User, totalSec)

	// Se a digitação for longa (> 6 segundos), dividimos em rajadas naturais com micro-pausas
	// (como alguém que digita uma oração, para brevemente para ler/pensar e continua)
	if totalDuration > 6*time.Second {
		burst1Ratio := 0.45 + (rand.Float64() * 0.15) // 45% a 60%
		burst1 := time.Duration(float64(totalDuration) * burst1Ratio)
		burst2 := totalDuration - burst1
		microPause := time.Duration(600+rand.Intn(1000)) * time.Millisecond

		// Rajada 1: Digitando...
		log.Printf("✍️ [Rajada 1] Digitando primeira parte (%.2fs)...", burst1.Seconds())
		_ = s.client.SendChatPresence(ctx, targetJID, types.ChatPresenceComposing, types.ChatPresenceMediaText)
		select {
		case <-time.After(burst1):
		case <-ctx.Done():
			return
		}

		// Micro-pausa de reflexão humana (presença pausada)
		log.Printf("⏸️ [Hesitação] Pausa de reflexão (%.2fs)...", microPause.Seconds())
		_ = s.client.SendChatPresence(ctx, targetJID, types.ChatPresencePaused, types.ChatPresenceMediaText)
		select {
		case <-time.After(microPause):
		case <-ctx.Done():
			return
		}

		// Rajada 2: Retomando digitação...
		log.Printf("✍️ [Rajada 2] Concluindo mensagem (%.2fs)...", burst2.Seconds())
		_ = s.client.SendChatPresence(ctx, targetJID, types.ChatPresenceComposing, types.ChatPresenceMediaText)
		select {
		case <-time.After(burst2):
		case <-ctx.Done():
			return
		}
	} else {
		// Mensagens mais curtas: digitação contínua
		_ = s.client.SendChatPresence(ctx, targetJID, types.ChatPresenceComposing, types.ChatPresenceMediaText)
		select {
		case <-time.After(totalDuration):
		case <-ctx.Done():
			return
		}
	}

	// Envia pausa de presença ao encerrar o texto
	_ = s.client.SendChatPresence(ctx, targetJID, types.ChatPresencePaused, types.ChatPresenceMediaText)

	// Pausa final natural humana antes de clicar em "Enviar" (800ms a 2000ms)
	naturalPauseMs := 800 + rand.Intn(1200)
	log.Printf("⏸️ [Pré-Disparo] Aguardando %dms de pausa natural humana antes de enviar...", naturalPauseMs)
	select {
	case <-time.After(time.Duration(naturalPauseMs) * time.Millisecond):
	case <-ctx.Done():
		return
	}
}

func (s *ServiceManager) downloadAndUploadMedia(ctx context.Context, mediaURL string, caption string) (*waE2E.Message, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisição de download: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro ao baixar mídia: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download da mídia retornou status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler bytes da mídia: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}

	// Se for imagem
	if strings.HasPrefix(contentType, "image/") {
		uploadResp, err := s.client.Upload(ctx, data, whatsmeow.MediaImage)
		if err != nil {
			return nil, fmt.Errorf("falha no upload da imagem para WhatsApp: %w", err)
		}

		imgMsg := &waE2E.ImageMessage{
			URL:           proto.String(uploadResp.URL),
			DirectPath:    proto.String(uploadResp.DirectPath),
			MediaKey:      uploadResp.MediaKey,
			Mimetype:      proto.String(contentType),
			FileEncSHA256: uploadResp.FileEncSHA256,
			FileSHA256:    uploadResp.FileSHA256,
			FileLength:    proto.Uint64(uploadResp.FileLength),
		}
		if caption != "" {
			imgMsg.Caption = proto.String(caption)
		}

		return &waE2E.Message{ImageMessage: imgMsg}, nil
	}

	// Caso padrão para outros arquivos: DocumentMessage
	uploadResp, err := s.client.Upload(ctx, data, whatsmeow.MediaDocument)
	if err != nil {
		return nil, fmt.Errorf("falha no upload do documento para WhatsApp: %w", err)
	}

	docMsg := &waE2E.DocumentMessage{
		URL:           proto.String(uploadResp.URL),
		DirectPath:    proto.String(uploadResp.DirectPath),
		MediaKey:      uploadResp.MediaKey,
		Mimetype:      proto.String(contentType),
		FileEncSHA256: uploadResp.FileEncSHA256,
		FileSHA256:    uploadResp.FileSHA256,
		FileLength:    proto.Uint64(uploadResp.FileLength),
		Title:         proto.String("anexo"),
	}
	if caption != "" {
		docMsg.Caption = proto.String(caption)
	}

	return &waE2E.Message{DocumentMessage: docMsg}, nil
}

// ============================================================================
// WORKER SEQUENCIAL E CONTROLE DE ESPAÇAMENTO ANTI-BAN
// ============================================================================

func (s *ServiceManager) startQueueWorker(ctx context.Context) {
	log.Println("🚀 [Queue Worker] Worker sequencial iniciado com sucesso.")

	for {
		item := s.getNextPendingItem()
		if item == nil {
			select {
			case <-ctx.Done():
				log.Println("🛑 [Queue Worker] Encerrando worker...")
				return
			case <-s.notifyCh:
				continue
			case <-time.After(3 * time.Second):
				continue
			}
		}

		s.processQueueItem(ctx, item)
	}
}

func (s *ServiceManager) getNextPendingItem() *QueueItem {
	s.queueMu.Lock()
	defer s.queueMu.Unlock()

	for _, item := range s.queue {
		if item.Status == "queued" {
			return item
		}
	}
	return nil
}

func (s *ServiceManager) processQueueItem(ctx context.Context, item *QueueItem) {
	s.checkMidnightReset()

	s.cfgMu.RLock()
	cfg := s.config
	s.cfgMu.RUnlock()

	// 1. Verificação de Limite Diário
	if cfg.SentToday >= cfg.DailyLimit {
		log.Printf("🛑 [Limite Atingido] %d/%d disparos hoje. Mensagem %s marcada como limit_reached.",
			cfg.SentToday, cfg.DailyLimit, item.ID)
		s.queueMu.Lock()
		item.Status = "limit_reached"
		item.Error = fmt.Sprintf("Limite diário de %d mensagens atingido para hoje (%s). Aguardando reset.",
			cfg.DailyLimit, cfg.LastResetDate)
		s.queueMu.Unlock()
		return
	}

	// 2. Verificação de Conexão com o WhatsApp
	if !s.client.IsConnected() || !s.client.IsLoggedIn() {
		log.Printf("⚠️ [Não Conectado] WhatsApp não autenticado. Mensagem %s falhou.", item.ID)
		s.queueMu.Lock()
		item.Status = "failed"
		item.Error = "WhatsApp desconectado ou não autenticado (leia o QR code em /api/qr)."
		s.queueMu.Unlock()
		s.applyCooldown(cfg)
		return
	}

	// 3. Resolução Anti-LID e Destinatário
	targetJID, err := s.resolveRecipientJID(ctx, item.Phone)
	if err != nil {
		log.Printf("❌ [Erro Destinatário] %v", err)
		s.queueMu.Lock()
		item.Status = "failed"
		item.Error = err.Error()
		s.queueMu.Unlock()
		s.applyCooldown(cfg)
		return
	}

	// 4. Início da Simulação de Digitação Humanizada
	s.queueMu.Lock()
	item.Status = "typing"
	s.queueMu.Unlock()

	s.simulateHumanTyping(ctx, targetJID, item.Message, cfg)

	// 5. Montagem do Payload (Texto ou Mídia)
	var waMsg *waE2E.Message
	if item.MediaURL != "" {
		log.Printf("📎 [Mídia] Baixando e enviando mídia de: %s", item.MediaURL)
		uploadedMsg, err := s.downloadAndUploadMedia(ctx, item.MediaURL, item.Message)
		if err != nil {
			log.Printf("⚠️ Falha ao processar mídia: %v. Enviando como texto.", err)
			waMsg = &waE2E.Message{Conversation: proto.String(item.Message)}
		} else {
			waMsg = uploadedMsg
		}
	} else {
		waMsg = &waE2E.Message{Conversation: proto.String(item.Message)}
	}

	// 6. Disparo Real no WhatsApp
	log.Printf("📤 [Disparo] Enviando mensagem %s para %s...", item.ID, targetJID)
	sendResp, err := s.client.SendMessage(ctx, targetJID, waMsg)
	if err != nil {
		log.Printf("❌ [Erro WhatsApp] Falha ao enviar %s: %v", item.ID, err)
		s.queueMu.Lock()
		item.Status = "failed"
		item.Error = fmt.Sprintf("Erro ao enviar: %v", err)
		s.queueMu.Unlock()
		s.applyCooldown(cfg)
		return
	}

	now := time.Now()
	s.queueMu.Lock()
	item.Status = "sent"
	item.SentAt = &now
	s.queueMu.Unlock()

	// 7. Incrementa contador e persiste
	s.cfgMu.Lock()
	s.config.SentToday++
	saveConfig(s.config)
	currentSent := s.config.SentToday
	dailyLimit := s.config.DailyLimit
	s.cfgMu.Unlock()

	log.Printf("✅ [Sucesso] Mensagem %s enviada com ID WhatsApp: %s (Total hoje: %d/%d)",
		item.ID, sendResp.ID, currentSent, dailyLimit)

	// 8. Intervalo de Espaçamento de Segurança entre Mensagens (Cool-down Anti-Ban)
	s.applyCooldown(cfg)
}

func (s *ServiceManager) applyCooldown(cfg AntiBanConfig) {
	delta := cfg.MaxDelaySec - cfg.MinDelaySec
	var delaySec int
	if delta > 0 {
		delaySec = cfg.MinDelaySec + rand.Intn(delta+1)
	} else {
		delaySec = cfg.MinDelaySec
	}

	log.Printf("🛡️ [Espaçamento Anti-Ban] Aguardando %d segundos antes de liberar a próxima mensagem da fila...", delaySec)
	time.Sleep(time.Duration(delaySec) * time.Second)
}

// ============================================================================
// HANDLERS HTTP DA API REST
// ============================================================================

func handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	appManager.checkMidnightReset()

	appManager.cfgMu.RLock()
	cfg := appManager.config
	appManager.cfgMu.RUnlock()

	appManager.queueMu.RLock()
	pendingCount := 0
	for _, it := range appManager.queue {
		if it.Status == "queued" || it.Status == "typing" {
			pendingCount++
		}
	}
	appManager.queueMu.RUnlock()

	appManager.qrMu.RLock()
	hasQR := appManager.qrCodeBase64 != ""
	appManager.qrMu.RUnlock()

	connected := appManager.client != nil && appManager.client.IsConnected()
	hasStoreID := appManager.client != nil && appManager.client.Store != nil && appManager.client.Store.ID != nil
	loggedIn := connected && appManager.client.IsLoggedIn() && hasStoreID

	var jidStr string
	if loggedIn {
		jidStr = appManager.client.Store.ID.String()
	}

	resp := StatusResponse{
		Connected:     connected,
		LoggedIn:      loggedIn,
		HasQR:         hasQR,
		JID:           jidStr,
		SentToday:     cfg.SentToday,
		DailyLimit:    cfg.DailyLimit,
		LimitReached:  cfg.SentToday >= cfg.DailyLimit,
		QueueLength:   pendingCount,
		LastResetDate: cfg.LastResetDate,
	}

	_ = json.NewEncoder(w).Encode(resp)
}

func handleQR(w http.ResponseWriter, r *http.Request) {
	appManager.qrMu.RLock()
	qrB64 := appManager.qrCodeBase64
	qrRaw := appManager.qrCodeRaw
	appManager.qrMu.RUnlock()

	connected := appManager.client != nil && appManager.client.IsConnected()
	hasStoreID := appManager.client != nil && appManager.client.Store != nil && appManager.client.Store.ID != nil
	loggedIn := connected && appManager.client.IsLoggedIn() && hasStoreID

	// Auto-recuperação: sem login e sem QR ativo -> reinicia o pareamento
	// (só quando não há aparelho pareado; após o pareamento o whatsmeow reconecta sozinho)
	if !loggedIn && qrB64 == "" && appManager.client != nil && !hasStoreID {
		go appManager.startPairing(false)
	}

	// Se a requisição pedir JSON
	if strings.Contains(r.Header.Get("Accept"), "application/json") || r.URL.Query().Get("format") == "json" {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"connected": connected,
			"logged_in": loggedIn,
			"has_qr":    qrB64 != "",
			"qr_code":   qrRaw,
			"qr_base64": qrB64,
		})
		return
	}

	// Resposta HTML amigável para escanear no navegador
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if loggedIn {
		w.Write([]byte(`
			<!DOCTYPE html>
			<html>
			<head><title>WhatsApp Conectado</title><meta charset="utf-8">
			<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;color:#111b21}
			.card{background:white;padding:30px;border-radius:12px;display:inline-block;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
			h1{color:#25d366;margin-bottom:10px}</style></head>
			<body>
				<div class="card">
					<h1>✅ WhatsApp Conectado e Autenticado!</h1>
					<p>O microserviço está pronto para receber disparos com proteção anti-ban.</p>
					<p><a href="/api/status" style="color:#128c7e">Ver Status da API</a></p>
				</div>
			</body></html>
		`))
		return
	}

	if qrB64 == "" {
		w.Write([]byte(`
			<!DOCTYPE html>
			<html>
			<head><title>Aguardando QR Code</title><meta http-equiv="refresh" content="3"><meta charset="utf-8">
			<style>body{font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5}</style></head>
			<body>
				<h2>⏳ Gerando QR Code de Conexão...</h2>
				<p>Aguarde alguns segundos. A página irá recarregar automaticamente.</p>
			</body></html>
		`))
		return
	}

	html := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>Conectar WhatsApp - Whatsmeow</title>
			<meta charset="utf-8">
			<meta http-equiv="refresh" content="15">
			<style>
				body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; background: #0b141a; color: #e9edef; padding: 40px 20px; }
				.card { background: #111b21; border-radius: 16px; padding: 30px; display: inline-block; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #222e35; }
				h2 { margin-top: 0; color: #25d366; }
				img { background: white; padding: 16px; border-radius: 12px; margin: 20px 0; max-width: 280px; }
				.instructions { font-size: 14px; color: #8696a0; text-align: left; line-height: 1.6; }
				.instructions ol { padding-left: 20px; }
				.badge { display: inline-block; background: #005c4b; color: #25d366; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
			</style>
		</head>
		<body>
			<div class="card">
				<span class="badge">WHATSMEOW CGO-FREE</span>
				<h2>Conectar WhatsApp</h2>
				<p style="color:#8696a0;font-size:13px">Escaneie o código abaixo com o seu WhatsApp</p>
				<img src="data:image/png;base64,%s" alt="WhatsApp QR Code" />
				<div class="instructions">
					<ol>
						<li>Abra o WhatsApp no seu celular</li>
						<li>Toque em <b>Mais opções</b> (Android) ou <b>Configurações</b> (iPhone)</li>
						<li>Toque em <b>Aparelhos conectados</b> e depois em <b>Conectar um aparelho</b></li>
						<li>Aponte a câmera para esta tela</li>
					</ol>
				</div>
			</div>
		</body>
		</html>
	`, qrB64)

	w.Write([]byte(html))
}

func handleSend(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "Método não permitido. Utilize POST."})
		return
	}

	var req SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "JSON inválido na requisição."})
		return
	}

	req.Phone = strings.TrimSpace(req.Phone)
	req.Message = strings.TrimSpace(req.Message)

	if req.Phone == "" || req.Message == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "Campos 'phone' e 'message' são obrigatórios."})
		return
	}

	queueID := fmt.Sprintf("msg_%d_%03d", time.Now().Unix(), rand.Intn(1000))
	newItem := &QueueItem{
		ID:        queueID,
		Phone:     req.Phone,
		Message:   req.Message,
		MediaURL:  req.MediaURL,
		Status:    "queued",
		CreatedAt: time.Now(),
	}

	appManager.queueMu.Lock()
	appManager.queue = append(appManager.queue, newItem)

	// Calcular posição na fila
	pos := 0
	for _, it := range appManager.queue {
		if it.Status == "queued" || it.Status == "typing" {
			pos++
			if it.ID == queueID {
				break
			}
		}
	}
	appManager.queueMu.Unlock()

	// Notifica o worker de forma não bloqueante
	select {
	case appManager.notifyCh <- struct{}{}:
	default:
	}

	log.Printf("📥 [Fila] Mensagem %s enfileirada (Posição: %d, Destino: %s)", queueID, pos, req.Phone)

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(SendResponse{
		Success:       true,
		Queued:        true,
		QueueID:       queueID,
		QueuePosition: pos,
		Message:       "Mensagem enfileirada com sucesso.",
	})
}

func handleQueue(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	appManager.queueMu.RLock()
	defer appManager.queueMu.RUnlock()

	pending := 0
	for _, it := range appManager.queue {
		if it.Status == "queued" || it.Status == "typing" {
			pending++
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"total":   len(appManager.queue),
		"pending": pending,
		"queue":   appManager.queue,
	})
}

type CheckRequest struct {
	Phones []string `json:"phones"`
}

type CheckResponse struct {
	Connected bool            `json:"connected"`
	Results   map[string]bool `json:"results"`
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "Método não permitido. Utilize POST."})
		return
	}

	var req CheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "JSON inválido."})
		return
	}

	loggedIn := appManager.client != nil && appManager.client.IsConnected() && appManager.client.IsLoggedIn() && appManager.client.Store != nil && appManager.client.Store.ID != nil
	if !loggedIn {
		_ = json.NewEncoder(w).Encode(CheckResponse{
			Connected: false,
			Results:   make(map[string]bool),
		})
		return
	}

	results := make(map[string]bool)
	if len(req.Phones) == 0 {
		_ = json.NewEncoder(w).Encode(CheckResponse{
			Connected: true,
			Results:   results,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Second)
	defer cancel()

	for _, raw := range req.Phones {
		candidates := phoneCandidates(raw)
		if len(candidates) == 0 {
			results[raw] = false
			continue
		}

		formattedCandidates := make([]string, len(candidates))
		for i, c := range candidates {
			formattedCandidates[i] = "+" + c
		}

		resp, err := appManager.client.IsOnWhatsApp(ctx, formattedCandidates)
		isOnWA := false
		if err == nil {
			for _, item := range resp {
				if item.IsIn {
					isOnWA = true
					break
				}
			}
		}
		results[raw] = isOnWA
	}

	_ = json.NewEncoder(w).Encode(CheckResponse{
		Connected: true,
		Results:   results,
	})
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == http.MethodGet {
		appManager.cfgMu.RLock()
		cfg := appManager.config
		appManager.cfgMu.RUnlock()
		_ = json.NewEncoder(w).Encode(cfg)
		return
	}

	if r.Method == http.MethodPost {
		var updates map[string]any
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": "JSON inválido."})
			return
		}

		appManager.cfgMu.Lock()
		if v, ok := updates["daily_limit"].(float64); ok && v > 0 {
			appManager.config.DailyLimit = int(v)
		}
		if v, ok := updates["min_delay_sec"].(float64); ok && v >= 0 {
			appManager.config.MinDelaySec = int(v)
		}
		if v, ok := updates["max_delay_sec"].(float64); ok && v >= float64(appManager.config.MinDelaySec) {
			appManager.config.MaxDelaySec = int(v)
		}
		if v, ok := updates["typing_speed_ms"].(float64); ok && v > 0 {
			appManager.config.TypingSpeedMs = int(v)
		}
		if v, ok := updates["min_typing_sec"].(float64); ok && v > 0 {
			appManager.config.MinTypingSec = int(v)
		}
		if v, ok := updates["max_typing_sec"].(float64); ok && v >= float64(appManager.config.MinTypingSec) {
			appManager.config.MaxTypingSec = int(v)
		}
		if v, ok := updates["sent_today"].(float64); ok && v >= 0 {
			appManager.config.SentToday = int(v)
		}
		saveConfig(appManager.config)
		cfg := appManager.config
		appManager.cfgMu.Unlock()

		log.Printf("⚙️ [Config] Configurações anti-ban atualizadas via API: %+v", cfg)
		_ = json.NewEncoder(w).Encode(cfg)
		return
	}

	w.WriteHeader(http.StatusMethodNotAllowed)
}

func handleDisconnect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if appManager.client != nil {
		appManager.client.RemoveEventHandlers()
		if appManager.client.IsConnected() && appManager.client.IsLoggedIn() {
			logoutCtx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
			_ = appManager.client.Logout(logoutCtx)
			cancel()
		}
		if appManager.client.Store != nil && appManager.client.Store.ID != nil {
			_ = appManager.client.Store.Delete(context.Background())
		}
		appManager.client.Disconnect()
	}
	appManager.clearQR()
	appManager.newClient()
	go appManager.startPairing(false)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success":   true,
		"connected": false,
		"logged_in": false,
		"message":   "WhatsApp desconectado com sucesso.",
	})
}

// ============================================================================
// PAREAMENTO VIA QR CODE (AUTO-RENOVÁVEL)
// ============================================================================

func (s *ServiceManager) clearQR() {
	s.qrMu.Lock()
	s.qrCodeBase64 = ""
	s.qrCodeRaw = ""
	s.qrMu.Unlock()
}

func (s *ServiceManager) handleEvent(rawEvt any) {
	switch evt := rawEvt.(type) {
	case *events.Connected:
		log.Println("🟢 [WhatsApp] Conectado com sucesso à rede WhatsApp!")
	case *events.LoggedOut:
		log.Println("🔴 [WhatsApp] Sessão desconectada/deslogada pelo celular! Resetando e gerando novo QR...")
		s.clearQR()
		s.newClient()
		go s.startPairing(false)
	case *events.PairSuccess:
		log.Printf("🎉 [WhatsApp] Aparelho pareado com sucesso! JID: %s", evt.ID)
		s.clearQR()
	case *events.PairError:
		log.Printf("❌ [WhatsApp] Erro no pareamento: %v", evt.Error)
	}
}

// newClient cria um dispositivo limpo (necessário após logout, pois o anterior é invalidado)
func (s *ServiceManager) newClient() {
	s.pairMu.Lock()
	oldClient := s.client
	if oldClient != nil {
		oldClient.RemoveEventHandlers()
		if oldClient.Store != nil && oldClient.Store.ID != nil {
			_ = oldClient.Store.Delete(context.Background())
		}
		oldClient.Disconnect()
	}
	device := s.container.NewDevice()
	newCli := whatsmeow.NewClient(device, waLog.Stdout("WhatsApp", "INFO", true))
	newCli.AddEventHandler(s.handleEvent)
	s.client = newCli
	s.pairMu.Unlock()
}

// startPairing mantém um QR válido até o login. Apenas uma instância roda por vez.
// reset=true descarta o aparelho atual (usar somente após logout explícito).
func (s *ServiceManager) startPairing(reset bool) {
	if reset {
		s.newClient()
	}

	s.pairMu.Lock()
	if s.pairing {
		s.pairMu.Unlock()
		return
	}
	s.pairing = true
	s.pairMu.Unlock()
	defer func() {
		s.pairMu.Lock()
		s.pairing = false
		s.pairMu.Unlock()
	}()

	for s.ctx.Err() == nil {
		s.pairMu.Lock()
		cli := s.client
		s.pairMu.Unlock()

		if cli == nil {
			time.Sleep(500 * time.Millisecond)
			continue
		}
		if cli.IsConnected() && cli.IsLoggedIn() && cli.Store != nil && cli.Store.ID != nil {
			return
		}
		if cli.IsConnected() {
			cli.Disconnect()
		}

		qrChan, err := cli.GetQRChannel(s.ctx)
		if err != nil {
			log.Printf("⚠️ [QR Code] Falha ao abrir canal de QR: %v. Recriando cliente...", err)
			s.newClient()
			time.Sleep(2 * time.Second)
			continue
		}
		if err := cli.Connect(); err != nil {
			log.Printf("⚠️ [QR Code] Falha ao conectar: %v. Tentando novamente...", err)
			time.Sleep(3 * time.Second)
			continue
		}

		for evt := range qrChan {
			switch evt.Event {
			case "code":
				pngBytes, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
				if err != nil {
					continue
				}
				s.qrMu.Lock()
				s.qrCodeRaw = evt.Code
				s.qrCodeBase64 = base64.StdEncoding.EncodeToString(pngBytes)
				s.qrMu.Unlock()
				log.Println("📱 [QR Code] Novo QR code gerado! Acesse http://localhost:5001/api/qr no navegador")
			case "success":
				log.Println("🎉 [QR Code] Login realizado com sucesso via QR Code!")
				s.clearQR()
				return
			default:
				log.Printf("⏱️ [QR Code] Canal encerrado (%s). Gerando novo ciclo de QR...", evt.Event)
				s.clearQR()
			}
		}

		cli.Disconnect()
		time.Sleep(time.Second)
	}
}

// ============================================================================
// INICIALIZAÇÃO DO SERVIÇO E CONEXÃO WHATSMEOW
// ============================================================================

func main() {
	log.Println("======================================================================")
	log.Println("  🤖 MICROSERVIÇO WHATSAPP (100% EM MEMÓRIA - SEM BANCO DE DADOS EM DISCO)")
	log.Println("  Fila Sequencial Inteligente & Digitação Humanizada Anti-Ban")
	log.Println("======================================================================")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := loadConfig()

	appManager = &ServiceManager{
		config:   cfg,
		queue:    make([]*QueueItem, 0),
		notifyCh: make(chan struct{}, 100),
	}

	// 1. Armazenamento 100% em Memória RAM (Zero arquivos de banco de dados em disco)
	dbLog := waLog.Stdout("Store", "WARN", true)
	container, err := sqlstore.New(ctx, "sqlite", "file:memdb?mode=memory&cache=shared&_pragma=foreign_keys(1)", dbLog)
	if err != nil {
		log.Fatalf("❌ Falha ao inicializar armazenamento em memória: %v", err)
	}

	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		log.Fatalf("❌ Falha ao obter dispositivo da sessão: %v", err)
	}

	appManager.container = container
	appManager.ctx = ctx
	appManager.client = whatsmeow.NewClient(deviceStore, waLog.Stdout("WhatsApp", "INFO", true))
	appManager.client.AddEventHandler(appManager.handleEvent)

	// 2/3. Conexão e Gerenciamento de QR Code (auto-renovável)
	if appManager.client.Store.ID == nil {
		go appManager.startPairing(false)
	} else {
		// Já pareado, conectar diretamente
		log.Printf("🔑 [WhatsApp] Sessão existente encontrada (%s). Conectando...", appManager.client.Store.ID)
		err = appManager.client.Connect()
		if err != nil {
			log.Fatalf("❌ Falha ao reconectar cliente WhatsApp: %v", err)
		}
	}

	// 4. Iniciar Worker Sequencial da Fila em Background
	go appManager.startQueueWorker(ctx)

	// 5. Configurar Rotas HTTP REST
	mux := http.NewServeMux()
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/qr", handleQR)
	mux.HandleFunc("/api/send", handleSend)
	mux.HandleFunc("/api/queue", handleQueue)
	mux.HandleFunc("/api/config", handleConfig)
	mux.HandleFunc("/api/disconnect", handleDisconnect)
	mux.HandleFunc("/api/check", handleCheck)

	port := os.Getenv("PORT")
	if port == "" && appManager.config.Port > 0 {
		port = fmt.Sprintf("%d", appManager.config.Port)
	}
	if port == "" {
		port = "5001"
	}
	serverAddr := ":" + port

	server := &http.Server{
		Addr:    serverAddr,
		Handler: mux,
	}

	go func() {
		log.Printf("🌐 [HTTP Server] Servidor ouvindo em http://localhost:%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Erro no servidor HTTP na porta %s: %v\n👉 Dica: Se a porta estiver ocupada por outro serviço, altere 'port' no antiban_config.json ou inicie com 'set PORT=5002'", port, err)
		}
	}()

	// 6. Graceful Shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh

	log.Println("\n🛑 [Shutdown] Encerrando serviço graciosamente...")
	cancel()
	appManager.client.Disconnect()
	_ = server.Shutdown(context.Background())
	log.Println("👋 [Shutdown] Microserviço finalizado.")
}
