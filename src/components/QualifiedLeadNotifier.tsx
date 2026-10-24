'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Bell, BellRing, MessageSquare, Bot, X, ExternalLink, CheckCircle2, Volume2 } from 'lucide-react';
import { formatPhoneDisplay, cleanPhoneDigits } from '@/lib/phone';
import { soundEngine } from '@/lib/sound-effects';

export interface QualifiedAlertItem {
  id: string;
  phone: string;
  company_name: string;
  city: string;
  segment: string;
  notes: string;
  timestamp: string;
}

interface QualifiedLeadNotifierProps {
  onOpenLeadInAutomation: (phone: string) => void;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const SEEN_ALERTS_KEY = 'leadcore_seen_qualified_alerts_v1';

function getSeenAlertIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_ALERTS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markAlertIdSeen(id: string) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const seen = Array.from(getSeenAlertIds());
    if (!seen.includes(id)) {
      seen.unshift(id);
      window.localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify(seen.slice(0, 80)));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function QualifiedLeadNotifier({ onOpenLeadInAutomation }: QualifiedLeadNotifierProps) {
  const [activeAlert, setActiveAlert] = useState<QualifiedAlertItem | null>(null);
  const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const initializedRef = useRef(false);

  const triggerInAppPopup = useCallback((alert: QualifiedAlertItem, triggerLocalOsNotification = false) => {
    if (!alert || !alert.id) return;
    markAlertIdSeen(alert.id);
    setActiveAlert(alert);

    // 1. Toca alerta sonoro industrial ascendente
    try {
      soundEngine.playQualifiedLeadAlert();
    } catch {}

    // 2. Vibra o celular se suportado
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([250, 100, 250, 100, 400]);
      }
    } catch {}

    // 3. Dispara também na barra de notificações do sistema via Service Worker se solicitado
    if (triggerLocalOsNotification && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          if (reg.active) {
            reg.active.postMessage({
              type: 'SHOW_QUALIFIED_NOTIFICATION',
              payload: alert
            });
          } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            reg.showNotification(`🔥 LEAD QUALIFICADO: ${alert.company_name}`, {
              body: `${alert.notes}\n📱 ${formatPhoneDisplay(alert.phone)}`,
              icon: '/icon.svg',
              badge: '/icon.svg',
              tag: `qualified-lead-${cleanPhoneDigits(alert.phone)}`
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, []);

  const syncPushSubscription = useCallback(async (vapidPublicKey?: string) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      if (Notification.permission !== 'granted') {
        return false;
      }

      let pubKey = vapidPublicKey;
      if (!pubKey) {
        const res = await fetch('/api/push/subscribe', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          pubKey = data.publicKey;
        }
      }
      if (!pubKey) return false;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const convertedKey = urlBase64ToUint8Array(pubKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as BufferSource
        });
      }

      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() })
        });
        setPushSubscribed(true);
        return true;
      }
    } catch (err) {
      console.warn('[PushNotifier] Aviso ao sincronizar Push Subscription:', err);
    }
    return false;
  }, []);

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionState('unsupported');
      return;
    }

    setIsSubscribing(true);
    try {
      soundEngine.playMechanicalClick('primary');
      const result = await Notification.requestPermission();
      setPermissionState(result);

      if (result === 'granted') {
        await syncPushSubscription();
        // Envia notificação de confirmação imediata na barra do celular
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification('✅ Alertas de Leads Qualificados Ativados!', {
            body: 'Você receberá um Pop-up + Notificação no celular sempre que a IA qualificar um lead.',
            icon: '/icon.svg',
            badge: '/icon.svg',
            tag: 'leadcore-welcome-push'
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[PushNotifier] Erro ao solicitar permissão:', err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTestingPush(true);
    try {
      soundEngine.playMechanicalClick('primary');
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
        if (perm === 'granted') {
          await syncPushSubscription();
        }
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.alert) {
          triggerInAppPopup(data.alert, data.pushedCount === 0);
        }
      }
    } catch (err) {
      console.error('[PushNotifier] Erro ao testar notificação:', err);
    } finally {
      setIsTestingPush(false);
    }
  };

  // Inicializa Service Worker, verifica permissão e monitora alertas em segundo plano
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('Notification' in window)) {
      setPermissionState('unsupported');
    } else {
      setPermissionState(Notification.permission);
      if (Notification.permission === 'granted') {
        syncPushSubscription();
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});

      const handleSwMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'LEAD_QUALIFIED_PUSH' && data.payload) {
          const alertPayload: QualifiedAlertItem = {
            id: data.payload.id || `push-${Date.now()}`,
            phone: data.payload.phone || '',
            company_name: data.payload.company_name || 'Lead Qualificado',
            city: data.payload.city || '',
            segment: data.payload.segment || '',
            notes: data.payload.notes || 'Lead qualificado pela IA!',
            timestamp: data.payload.timestamp || new Date().toISOString()
          };
          triggerInAppPopup(alertPayload, false);
        } else if (data.type === 'OPEN_QUALIFIED_LEAD' && data.payload?.phone) {
          onOpenLeadInAutomation(data.payload.phone);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [onOpenLeadInAutomation, syncPushSubscription, triggerInAppPopup]);

  // Escuta evento customizado disparado pelo polling do AutomationPanel ou faz polling leve próprio
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const processIncomingAlertsList = (alerts: QualifiedAlertItem[], isInitialLoad = false) => {
      if (!Array.isArray(alerts) || alerts.length === 0) return;
      const seen = getSeenAlertIds();

      // Na primeira carga da sessão, marca alertas antigos (mais de 2 minutos atrás) como vistos
      // para não repetir pop-ups velhos ao abrir o app, mas exibe imediatamente se aconteceu nos últimos 2 minutos!
      const nowMs = Date.now();
      for (const item of alerts) {
        if (!item?.id || seen.has(item.id)) continue;
        const itemAgeMs = nowMs - new Date(item.timestamp || 0).getTime();
        if (isInitialLoad && itemAgeMs > 120000) {
          markAlertIdSeen(item.id);
          continue;
        }
        triggerInAppPopup(item, true);
        break;
      }
    };

    const handleCustomAlertEvent = (e: Event) => {
      const customEvent = e as CustomEvent<QualifiedAlertItem[]>;
      if (customEvent.detail) {
        processIncomingAlertsList(customEvent.detail, false);
      }
    };

    const handleManualTestEvent = () => {
      handleTestNotification();
    };

    window.addEventListener('leadcore:qualified-alerts', handleCustomAlertEvent);
    window.addEventListener('leadcore:test-qualified-popup', handleManualTestEvent);

    const pollAlerts = async () => {
      try {
        const res = await fetch('/api/push/subscribe', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const isFirst = !initializedRef.current;
          initializedRef.current = true;
          if (Array.isArray(data.alerts)) {
            processIncomingAlertsList(data.alerts, isFirst);
          }
        }
      } catch {
        // Silencioso
      }
    };

    pollAlerts();
    const interval = setInterval(pollAlerts, 10000);

    return () => {
      window.removeEventListener('leadcore:qualified-alerts', handleCustomAlertEvent);
      window.removeEventListener('leadcore:test-qualified-popup', handleManualTestEvent);
      clearInterval(interval);
    };
  }, [triggerInAppPopup]);

  const cleanDigits = activeAlert ? cleanPhoneDigits(activeAlert.phone) : '';
  const whatsappHref = cleanDigits ? `https://wa.me/${cleanDigits}` : '#';

  return (
    <>
      {/* Barra de ativação rápida de Notificações no Celular (visível se ainda não ativado) */}
      {permissionState === 'default' && !bannerDismissed && (
        <div className="bg-zinc-950 text-white border-b-4 border-[#E5FF00] px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap z-40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 bg-[#E5FF00] text-zinc-950 border-2 border-white flex items-center justify-center shrink-0 animate-bounce">
              <BellRing size={15} strokeWidth={3} />
            </span>
            <p className="font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wide text-zinc-100">
              Ative o <span className="text-[#E5FF00] font-black">Pop-up no Celular</span> para receber alerta sonoro assim que a IA qualificar um lead!
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={isSubscribing}
              className="bg-[#25D366] hover:bg-[#E5FF00] text-zinc-950 border-2 border-white px-3 py-1 font-mono font-black text-[11px] uppercase shadow-[2px_2px_0_0_#ffffff] cursor-pointer flex items-center gap-1.5"
            >
              <Bell size={13} strokeWidth={3} />
              {isSubscribing ? 'Ativando...' : 'Ativar Alertas no Celular'}
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Fechar aviso"
              className="text-zinc-400 hover:text-white p-1 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* POP-UP FLUTUANTE DE ALTA PRIORIDADE QUANDO UM LEAD É QUALIFICADO */}
      <AnimatePresence>
        {activeAlert && (
          <div className="fixed inset-x-0 top-3 sm:top-5 z-[100] px-3 sm:px-6 flex justify-center pointer-events-none">
            <motion.div
              key={activeAlert.id}
              initial={{ opacity: 0, y: -60, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className="pointer-events-auto w-full max-w-xl bg-zinc-950 text-white border-4 border-[#E5FF00] shadow-[8px_8px_0_0_#25D366] overflow-hidden"
            >
              {/* Cabeçalho Neon Industrial */}
              <div className="bg-[#E5FF00] text-zinc-950 px-4 py-2.5 border-b-4 border-zinc-950 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="bg-zinc-950 text-[#E5FF00] p-1 border-2 border-zinc-950 shrink-0 animate-pulse">
                    <Flame size={16} strokeWidth={3} />
                  </span>
                  <span className="font-mono font-black text-xs sm:text-sm uppercase tracking-wider truncate">
                    🔥 LEAD QUALIFICADO PRONTO P/ FECHAMENTO!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAlert(null)}
                  className="bg-zinc-950 text-white hover:bg-red-600 p-1 border-2 border-zinc-950 transition-colors cursor-pointer shrink-0"
                  title="Fechar Pop-up"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>

              {/* Corpo do Pop-up */}
              <div className="p-4 sm:p-5 flex flex-col gap-3.5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-white leading-tight">
                      {activeAlert.company_name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {activeAlert.segment && (
                        <span className="bg-zinc-800 text-[#E5FF00] border border-zinc-700 px-2 py-0.5 font-mono text-[10px] sm:text-xs font-bold uppercase">
                          {activeAlert.segment}
                        </span>
                      )}
                      {activeAlert.city && (
                        <span className="bg-zinc-900 text-zinc-300 border border-zinc-700 px-2 py-0.5 font-mono text-[10px] sm:text-xs font-bold uppercase">
                          📍 {activeAlert.city}
                        </span>
                      )}
                      {activeAlert.phone && (
                        <span className="bg-[#25D366]/20 text-[#25D366] border border-[#25D366] px-2 py-0.5 font-mono text-[10px] sm:text-xs font-black">
                          📱 {formatPhoneDisplay(activeAlert.phone)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumo da Qualificação da IA */}
                <div className="bg-zinc-900 border-l-4 border-[#25D366] p-3 font-mono text-xs sm:text-sm text-zinc-200 leading-relaxed">
                  {activeAlert.notes}
                </div>

                {/* Botões de Ação Rápida Mobile-First (Fitts' Law: >= 48px) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const targetPhone = activeAlert.phone;
                      setActiveAlert(null);
                      onOpenLeadInAutomation(targetPhone);
                    }}
                    className="min-h-[48px] bg-[#E5FF00] hover:bg-white text-zinc-950 border-3 border-white font-mono font-black text-xs sm:text-sm uppercase px-4 py-2.5 shadow-[4px_4px_0_0_#25D366] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-y-0.5"
                  >
                    <Bot size={18} strokeWidth={2.75} />
                    <span>Ver no Piloto Automático</span>
                  </button>

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setActiveAlert(null)}
                    className="min-h-[48px] bg-[#25D366] hover:bg-emerald-400 text-zinc-950 border-3 border-white font-mono font-black text-xs sm:text-sm uppercase px-4 py-2.5 shadow-[4px_4px_0_0_#E5FF00] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-y-0.5"
                  >
                    <MessageSquare size={18} strokeWidth={2.75} />
                    <span>Abrir no WhatsApp</span>
                    <ExternalLink size={14} strokeWidth={2.75} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
