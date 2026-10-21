/**
 * Cliente de integração com o microserviço Go Whatsmeow
 * Gerencia envio sequencial, verificação de fila e status de conexão.
 */

let customServiceUrl: string | null = null;

export function setServiceUrl(url: string) {
  customServiceUrl = url.trim().replace(/\/+$/, '');
}

export function getServiceUrl(): string {
  if (customServiceUrl) return customServiceUrl;
  return (process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001').trim().replace(/\/+$/, '');
}

/**
 * Helper interno para chamadas HTTP ao microserviço WhatsApp,
 * incluindo automaticamente os headers necessários para bypass de aviso do ngrok e Cloudflare.
 */
async function fetchWhatsAppService(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const url = pathOrUrl.startsWith('http') 
    ? pathOrUrl 
    : `${getServiceUrl()}${pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl}`;

  const headers = new Headers(init?.headers || {});
  headers.set('ngrok-skip-browser-warning', 'true');
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'AutoInd-WhatsAppClient/1.0');
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

export interface WhatsAppSendOptions {
  phone: string;
  message: string;
  media_url?: string;
  is_reply?: boolean;
  skip_interval_check?: boolean;
}

export interface WhatsAppInboundMessage {
  id: string;
  phone: string;
  message: string;
  timestamp: string;
  push_name?: string;
}

export interface WhatsAppSendResponse {
  success: boolean;
  queued: boolean;
  queue_id: string;
  queue_position: number;
  message: string;
  error?: string;
}

export interface WhatsAppStatusResponse {
  connected: boolean;
  logged_in: boolean;
  has_qr: boolean;
  jid?: string;
  sent_today: number;
  daily_limit: number;
  limit_reached: boolean;
  queue_length: number;
  last_reset_date: string;
  is_typing?: boolean;
  typing_phone?: string;
  inbound_count?: number;
}

export interface WhatsAppQueueItem {
  id: string;
  phone: string;
  message: string;
  media_url?: string;
  status: 'queued' | 'typing' | 'sent' | 'failed' | 'limit_reached';
  created_at: string;
  sent_at?: string;
  error?: string;
}

export interface WhatsAppAntiBanConfig {
  daily_limit: number;
  min_delay_sec: number;
  max_delay_sec: number;
  typing_speed_ms: number;
  min_typing_sec: number;
  max_typing_sec: number;
  sent_today: number;
  last_reset_date: string;
}

// Global memory lock to prevent repeated duplicate blasts to the same phone
const globalPhoneLocks: Map<string, number> = ((global as any).__waPhoneLocks =
  (global as any).__waPhoneLocks || new Map<string, number>());

/**
 * Limpa mensagens na fila do microserviço Go (opcionalmente filtrado por telefone)
 */
export async function clearWhatsAppQueue(phone?: string): Promise<boolean> {
  try {
    const path = phone
      ? `/api/queue?phone=${encodeURIComponent(phone)}`
      : `/api/queue`;
    const res = await fetchWhatsAppService(path, {
      method: 'DELETE',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

import { isBlacklistedPhone } from './phoneBlacklist';
import { isWhatsAppGroup, cleanPhoneDigits } from './phone';

/**
 * Divide textos longos em 2 a 3 balões humanizados e naturais de WhatsApp
 */
export function splitIntoHumanBubbles(text: string, maxBubbles = 3): string[] {
  if (!text) return [];
  const cleaned = text.trim();

  // 1. Se o texto tiver quebras de linha explícitas (\n ou \n\n)
  const lineBlocks = cleaned
    .split(/\r?\n+/)
    .map(b => b.trim())
    .filter(Boolean);

  if (lineBlocks.length > 1) {
    const result: string[] = [];
    for (const block of lineBlocks) {
      if (result.length < maxBubbles) {
        result.push(block);
      } else {
        result[result.length - 1] += ' ' + block;
      }
    }
    return result;
  }

  // Se for curto e sem quebras, mantém em 1 balão
  if (cleaned.length <= 90) {
    return [cleaned];
  }

  // 2. Se for um bloco contínuo longo, divide por frases (. ? !)
  const sentenceRegex = /([^.?!]+[.?!]+(?:\s+|$))/g;
  const matches = cleaned.match(sentenceRegex);

  if (!matches || matches.length <= 1) {
    return [cleaned];
  }

  const sentences = matches.map(s => s.trim()).filter(Boolean);
  if (sentences.length <= 1) {
    return [cleaned];
  }

  if (sentences.length === 2) {
    return sentences;
  } else if (sentences.length === 3) {
    return sentences;
  } else {
    const b1 = sentences[0];
    const b2 = sentences.slice(1, -1).join(' ');
    const b3 = sentences[sentences.length - 1];
    return [b1, b2, b3];
  }
}

/**
 * Aguarda a fila do microserviço ficar livre para um número (evita erro de colisão na fila)
 */
async function waitForPhoneQueueIdle(phone: string, maxWaitMs = 20000): Promise<boolean> {
  const start = Date.now();
  const digits = cleanPhoneDigits(phone);
  while (Date.now() - start < maxWaitMs) {
    try {
      const queue = await getWhatsAppQueue();
      const isBusy = (queue || []).some(item => {
        const d = cleanPhoneDigits(item.phone);
        const match = d === digits || (d.length >= 8 && digits.length >= 8 && d.slice(-8) === digits.slice(-8));
        return match && (item.status === 'queued' || item.status === 'typing');
      });
      if (!isBusy) {
        return true;
      }
    } catch {
      break;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return true;
}

/**
 * Envia mensagens divididas em múltiplos balões humanizados sequenciais
 */
export async function sendWhatsAppHumanBubbles(
  options: WhatsAppSendOptions,
  onBubbleSent?: (bubbleText: string, index: number, total: number) => Promise<void>
): Promise<WhatsAppSendResponse> {
  const bubbles = splitIntoHumanBubbles(options.message);

  if (bubbles.length <= 1) {
    const res = await sendWhatsAppMessage(options);
    if ((res.success || res.queued) && onBubbleSent) {
      await onBubbleSent(options.message, 0, 1).catch(() => {});
    }
    return res;
  }

  let lastResponse: WhatsAppSendResponse = {
    success: true,
    queued: true,
    queue_id: '',
    queue_position: 1,
    message: 'Balões humanizados enfileirados'
  };

  for (let i = 0; i < bubbles.length; i++) {
    const bubble = bubbles[i];
    if (i > 0) {
      // Aguarda o celular enviar e liberar a anterior
      await waitForPhoneQueueIdle(options.phone, 30000);
      // Pausa humanizada entre a entrega de um balão e o próximo (mínimo 5.5s para respeitar a trava do microserviço)
      await new Promise(r => setTimeout(r, 5500 + Math.random() * 1500));
    }

    const res = await sendWhatsAppMessage({
      ...options,
      message: bubble,
      is_reply: i > 0 ? true : options.is_reply,
      skip_interval_check: true
    });

    if (res.success || res.queued) {
      if (onBubbleSent) {
        await onBubbleSent(bubble, i, bubbles.length).catch(() => {});
      }
      lastResponse = res;
    } else {
      console.warn(`[HumanBubbles] Falha ao enviar balão ${i + 1}/${bubbles.length}:`, res.message);
      return res;
    }
  }

  return lastResponse;
}

/**
 * Enfileira uma mensagem para disparo sequencial humanizado
 */
export async function sendWhatsAppMessage(
  params: WhatsAppSendOptions
): Promise<WhatsAppSendResponse> {
  if (isWhatsAppGroup(params.phone)) {
    console.warn(`[WhatsApp Block] Disparo evitado: ${params.phone} é um grupo ou canal do WhatsApp.`);
    return {
      success: false,
      queued: false,
      queue_id: '',
      queue_position: -1,
      message: 'Envio para grupos do WhatsApp não é permitido.',
    };
  }

  if (isBlacklistedPhone(params.phone)) {
    console.warn(`[WhatsApp Block] Disparo abortado: o contato ${params.phone} foi excluído do sistema.`);
    return {
      success: false,
      queued: false,
      queue_id: '',
      queue_position: -1,
      message: 'Contato excluído: envios permanentemente bloqueados.',
    };
  }

  const digits = (params.phone || '').replace(/\D/g, '');
  if (!digits) {
    return {
      success: false,
      queued: false,
      queue_id: '',
      queue_position: -1,
      message: 'Telefone inválido para envio.',
    };
  }

  // Trava anti-flood: para prospecção fria, exige 60s; para respostas da IA, exige 8s (ignorado para balões subsequentes)
  const minIntervalMs = params.is_reply ? 8000 : 60000;
  const lastSent = globalPhoneLocks.get(digits) || 0;
  const timeSinceLast = Date.now() - lastSent;
  if (!params.skip_interval_check && timeSinceLast < minIntervalMs) {
    console.warn(`[WhatsApp Anti-Flood] Disparo ignorado para ${params.phone}: enviado há ${Math.round(timeSinceLast / 1000)}s.`);
    return {
      success: false,
      queued: false,
      queue_id: '',
      queue_position: -1,
      message: `Bloqueio anti-flood: aguarde ${Math.round((minIntervalMs - timeSinceLast) / 1000)}s para novo envio.`,
    };
  }

  try {
    const res = await fetchWhatsAppService('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: params.phone,
        message: params.message,
        media_url: params.media_url,
        is_reply: params.is_reply,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        queued: false,
        queue_id: '',
        queue_position: -1,
        message: 'Falha na resposta do microserviço',
        error: errorText,
      };
    }

    const data: WhatsAppSendResponse = await res.json();
    if (data.success || data.queued) {
      globalPhoneLocks.set(digits, Date.now());
    }
    return data;
  } catch (error: any) {
    console.error('Erro ao chamar o microserviço WhatsApp:', error);
    return {
      success: false,
      queued: false,
      queue_id: '',
      queue_position: -1,
      message: 'Não foi possível conectar ao microserviço em Go (localhost:5001)',
      error: error?.message || String(error),
    };
  }
}

let forceDisconnected = false;

/**
 * Consulta o status da conexão do WhatsApp e limites diários
 */
export async function getWhatsAppStatus(): Promise<WhatsAppStatusResponse | null> {
  try {
    const res = await fetchWhatsAppService('/api/status', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const raw = (await res.json()) as WhatsAppStatusResponse;

    // No whatsmeow, cli.Disconnect() derruba connected=false mas pode manter isLoggedIn=true
    // se o dispositivo ainda não foi recriado. Só consideramos logado se ambos forem true.
    const trulyActive = Boolean(raw.connected && raw.logged_in);

    if (trulyActive && !raw.has_qr) {
      forceDisconnected = false;
    }

    if (!trulyActive || forceDisconnected) {
      return {
        ...raw,
        connected: false,
        logged_in: false,
        jid: undefined,
      };
    }

    return raw;
  } catch (error) {
    console.error('Erro ao consultar status do WhatsApp:', error);
    return null;
  }
}

/**
 * Consulta as mensagens atualmente na fila
 */
export async function getWhatsAppQueue(): Promise<WhatsAppQueueItem[]> {
  try {
    const res = await fetchWhatsAppService('/api/queue', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.items || data.queue || []);
    return list as WhatsAppQueueItem[];
  } catch (error) {
    console.error('Erro ao consultar fila do WhatsApp:', error);
    return [];
  }
}

/**
 * Consulta a configuração atual do anti-ban
 */
export async function getWhatsAppConfig(): Promise<WhatsAppAntiBanConfig | null> {
  try {
    const res = await fetchWhatsAppService('/api/config', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    return (await res.json()) as WhatsAppAntiBanConfig;
  } catch (error) {
    console.error('Erro ao consultar configuração anti-ban:', error);
    return null;
  }
}

/**
 * Atualiza parâmetros de configuração anti-ban
 */
export async function updateWhatsAppConfig(
  newConfig: Partial<WhatsAppAntiBanConfig>
): Promise<boolean> {
  try {
    const res = await fetchWhatsAppService('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    return res.ok;
  } catch (error) {
    console.error('Erro ao atualizar configuração anti-ban:', error);
    return false;
  }
}

export interface WhatsAppQRResponse {
  connected?: boolean;
  logged_in?: boolean;
  has_qr?: boolean;
  qr_code?: string;
  qr_base64?: string;
  success?: boolean;
  status?: string;
  stale_session?: boolean;
}

/**
 * Consulta o QR Code atual para conexão do aparelho
 */
export async function getWhatsAppQR(): Promise<WhatsAppQRResponse | null> {
  try {
    const [qrRes, statusRes] = await Promise.all([
      fetchWhatsAppService('/api/qr?format=json', {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }),
      fetchWhatsAppService('/api/status', {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
    ]);

    if (!qrRes.ok) return null;
    const qrData = (await qrRes.json()) as WhatsAppQRResponse;
    const statusData = statusRes && statusRes.ok
      ? ((await statusRes.json().catch(() => null)) as WhatsAppStatusResponse | null)
      : null;

    const isConnected = statusData ? Boolean(statusData.connected) : Boolean(qrData.connected);
    const trulyLoggedIn = Boolean(isConnected && qrData.logged_in && !qrData.has_qr);

    if (trulyLoggedIn) {
      forceDisconnected = false;
    }

    const staleSession = Boolean(!isConnected && qrData.logged_in && !qrData.has_qr);

    return {
      ...qrData,
      connected: trulyLoggedIn && !forceDisconnected,
      logged_in: trulyLoggedIn && !forceDisconnected,
      stale_session: staleSession,
    };
  } catch (error) {
    console.error('Erro ao buscar QR code do WhatsApp:', error);
    return null;
  }
}

/**
 * Desconecta a sessão ativa do WhatsApp para permitir nova conexão
 */
export async function disconnectWhatsApp(): Promise<boolean> {
  forceDisconnected = true;
  try {
    const res = await fetchWhatsAppService('/api/disconnect', {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    return res.ok;
  } catch (error) {
    console.error('Erro ao desconectar WhatsApp:', error);
    return false;
  }
}

export interface CheckWhatsAppResponse {
  connected: boolean;
  results: Record<string, boolean>;
}

/**
 * Consulta se uma lista de telefones possui conta ativa no WhatsApp via microserviço
 */
export async function checkWhatsAppNumbers(
  phones: string[]
): Promise<Record<string, boolean> | null> {
  if (!phones || phones.length === 0) return {};
  try {
    const res = await fetchWhatsAppService('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones }),
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) return null;
    const data: CheckWhatsAppResponse = await res.json();
    if (!data.connected) return null;
    return data.results || {};
  } catch (error) {
    return null;
  }
}

/**
 * Consulta as mensagens recebidas (inbound) armazenadas no microserviço Go (para polling via Cloudflare Tunnel)
 */
export async function getWhatsAppInbound(): Promise<WhatsAppInboundMessage[]> {
  try {
    const res = await fetchWhatsAppService('/api/inbound', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.messages || []);
    return list as WhatsAppInboundMessage[];
  } catch {
    return [];
  }
}

/**
 * Limpa mensagens recebidas já processadas do buffer do microserviço Go
 */
export async function clearWhatsAppInbound(id?: string): Promise<boolean> {
  try {
    const path = id
      ? `/api/inbound?id=${encodeURIComponent(id)}`
      : `/api/inbound`;
    const res = await fetchWhatsAppService(path, {
      method: 'DELETE',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}



