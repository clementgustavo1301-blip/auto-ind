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

export interface WhatsAppSendOptions {
  phone: string;
  message: string;
  media_url?: string;
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

/**
 * Enfileira uma mensagem para disparo sequencial humanizado
 */
export async function sendWhatsAppMessage(
  params: WhatsAppSendOptions
): Promise<WhatsAppSendResponse> {
  try {
    const res = await fetch(`${getServiceUrl()}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: params.phone,
        message: params.message,
        media_url: params.media_url,
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
    const res = await fetch(`${getServiceUrl()}/api/status`, {
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
    const res = await fetch(`${getServiceUrl()}/api/queue`, {
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
    const res = await fetch(`${getServiceUrl()}/api/config`, {
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
    const res = await fetch(`${getServiceUrl()}/api/config`, {
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
      fetch(`${getServiceUrl()}/api/qr?format=json`, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`${getServiceUrl()}/api/status`, {
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
    const res = await fetch(`${getServiceUrl()}/api/disconnect`, {
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
    const res = await fetch(`${getServiceUrl()}/api/check`, {
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


