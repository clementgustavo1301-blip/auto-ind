import webpush from 'web-push';
import { supabase } from './supabase';
import { AutomationLead } from '@/types';

const gPush = globalThis as any;

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: string;
}

export interface QualifiedLeadAlertPayload {
  id: string;
  phone: string;
  company_name: string;
  city: string;
  segment: string;
  notes: string;
  timestamp: string;
}

interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Obtém ou gera automaticamente o par de chaves VAPID e persiste no Supabase
 * para funcionar em produção (Vercel) e local sem exigir configuração manual no .env.
 */
export async function getOrCreateVapidKeys(): Promise<VapidKeyPair> {
  if (gPush.__vapidKeys?.publicKey && gPush.__vapidKeys?.privateKey) {
    return gPush.__vapidKeys;
  }

  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    gPush.__vapidKeys = {
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim(),
      privateKey: process.env.VAPID_PRIVATE_KEY.trim()
    };
    return gPush.__vapidKeys;
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('automation_logs')
        .select('details')
        .eq('lead_phone', '__vapid_keys__')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.details) {
        const parsed = JSON.parse(data.details);
        if (parsed?.publicKey && parsed?.privateKey) {
          gPush.__vapidKeys = parsed;
          return parsed;
        }
      }
    } catch {
      // Continua para gerar novas chaves
    }
  }

  const generated = webpush.generateVAPIDKeys();
  const keys: VapidKeyPair = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey
  };
  gPush.__vapidKeys = keys;

  if (supabase) {
    try {
      await supabase.from('automation_logs').delete().eq('lead_phone', '__vapid_keys__');
      await supabase.from('automation_logs').insert([{
        event_type: 'system',
        details: JSON.stringify(keys),
        lead_phone: '__vapid_keys__'
      }]);
    } catch {
      // Fallback em memória
    }
  }

  return keys;
}

/**
 * Carrega todas as inscrições Web Push ativas dos dispositivos do operador
 */
export async function getPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('automation_logs')
        .select('details')
        .eq('lead_phone', '__push_subs__')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.details) {
        const subs = JSON.parse(data.details);
        if (Array.isArray(subs)) {
          gPush.__pushSubscriptions = subs;
          return subs;
        }
      }
    } catch {
      // Fallback para memória
    }
  }

  return Array.isArray(gPush.__pushSubscriptions) ? gPush.__pushSubscriptions : [];
}

/**
 * Salva uma nova inscrição Web Push do navegador do celular/desktop
 */
export async function savePushSubscription(
  sub: { endpoint: string; keys?: { p256dh?: string; auth?: string } },
  userAgent?: string
): Promise<number> {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    throw new Error('Inscrição Push inválida (endpoint ou chaves ausentes).');
  }

  const current = await getPushSubscriptions();
  const filtered = current.filter(item => item.endpoint !== sub.endpoint);

  filtered.unshift({
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth
    },
    userAgent: userAgent || 'Mobile Browser PWA',
    createdAt: new Date().toISOString()
  });

  // Mantém até 15 dispositivos inscritos
  const updated = filtered.slice(0, 15);
  gPush.__pushSubscriptions = updated;

  if (supabase) {
    try {
      await supabase.from('automation_logs').delete().eq('lead_phone', '__push_subs__');
      await supabase.from('automation_logs').insert([{
        event_type: 'system',
        details: JSON.stringify(updated),
        lead_phone: '__push_subs__'
      }]);
    } catch {
      // Continua em memória
    }
  }

  return updated.length;
}

/**
 * Obtém os últimos alertas de leads qualificados para exibir pop-up imediato no app
 */
export async function getRecentQualifiedAlerts(): Promise<QualifiedLeadAlertPayload[]> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('automation_logs')
        .select('details')
        .eq('lead_phone', '__qualified_alert__')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.details) {
        const parsed = JSON.parse(data.details);
        if (Array.isArray(parsed)) {
          gPush.__recentQualifiedAlerts = parsed;
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
  }
  return Array.isArray(gPush.__recentQualifiedAlerts) ? gPush.__recentQualifiedAlerts : [];
}

/**
 * Dispara alerta de Lead Qualificado (Web Push para barra do celular + Pop-up em tempo real no app)
 */
export async function notifyLeadQualified(
  lead: Partial<AutomationLead> & Pick<AutomationLead, 'phone'>,
  customNote?: string,
  isTest = false
): Promise<{ pushedCount: number; alert: QualifiedLeadAlertPayload }> {
  const cleanDigits = String(lead.phone || '').replace(/\D/g, '');
  if (!gPush.__notifiedQualifiedPhones) {
    gPush.__notifiedQualifiedPhones = new Set<string>();
  }

  const alertPayload: QualifiedLeadAlertPayload = {
    id: `qual-${cleanDigits || Date.now()}-${Date.now()}`,
    phone: lead.phone,
    company_name: lead.company_name || 'Lead Qualificado',
    city: lead.city || '',
    segment: lead.segment || '',
    notes: customNote || lead.qualification_notes || 'Lead qualificado pela IA e pronto para fechamento!',
    timestamp: new Date().toISOString()
  };

  // Evita duplicar notificação repetida para o mesmo telefone na mesma sessão (exceto se for teste)
  if (!isTest && cleanDigits && gPush.__notifiedQualifiedPhones.has(cleanDigits)) {
    return { pushedCount: 0, alert: alertPayload };
  }
  if (!isTest && cleanDigits) {
    gPush.__notifiedQualifiedPhones.add(cleanDigits);
  }

  // 1. Registra no buffer de alertas recentes para o Pop-up in-app e Service Worker local
  try {
    const existingAlerts = await getRecentQualifiedAlerts();
    const updatedAlerts = [
      alertPayload,
      ...existingAlerts.filter(a => a.phone !== lead.phone)
    ].slice(0, 10);

    gPush.__recentQualifiedAlerts = updatedAlerts;

    if (supabase) {
      await supabase.from('automation_logs').delete().eq('lead_phone', '__qualified_alert__');
      await supabase.from('automation_logs').insert([{
        event_type: 'system',
        details: JSON.stringify(updatedAlerts),
        lead_phone: '__qualified_alert__'
      }]);
    }
  } catch (e) {
    console.warn('[Push] Aviso ao gravar alerta recente:', e);
  }

  // 2. Dispara Web Push criptografado para todos os celulares/navegadores inscritos
  let pushedCount = 0;
  try {
    const keys = await getOrCreateVapidKeys();
    webpush.setVapidDetails(
      'mailto:contato@leadcore.app',
      keys.publicKey,
      keys.privateKey
    );

    const subs = await getPushSubscriptions();
    if (subs.length > 0) {
      const validSubs: PushSubscriptionRecord[] = [];
      const payloadStr = JSON.stringify(alertPayload);

      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys
              },
              payloadStr,
              {
                TTL: 86400,
                urgency: 'high'
              }
            );
            pushedCount++;
            validSubs.push(sub);
          } catch (err: any) {
            // Se o endpoint expirou (404 / 410), descarta automaticamente
            if (err?.statusCode !== 404 && err?.statusCode !== 410) {
              validSubs.push(sub);
            }
          }
        })
      );

      if (validSubs.length !== subs.length) {
        gPush.__pushSubscriptions = validSubs;
        if (supabase) {
          await supabase.from('automation_logs').delete().eq('lead_phone', '__push_subs__');
          await supabase.from('automation_logs').insert([{
            event_type: 'system',
            details: JSON.stringify(validSubs),
            lead_phone: '__push_subs__'
          }]);
        }
      }
    }
  } catch (err) {
    console.warn('[Push] Erro ao enviar Web Push:', err);
  }

  return { pushedCount, alert: alertPayload };
}
