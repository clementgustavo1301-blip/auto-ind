import { NextResponse } from 'next/server';
import { 
  getAutomationSettings, 
  getAutomationMetrics, 
  getAutomationLeads, 
  getAutomationLogs,
  calculateNextDispatchSchedule,
  getCurrentlyTyping,
  setCurrentlyTyping,
  ensureAutomationWorkerRunning
} from '@/lib/automation';
import { getWhatsAppQueue, getWhatsAppStatus, setDetectedAppOrigin, updateWhatsAppConfig } from '@/lib/whatsapp';
import { isSamePhone } from '@/lib/phone';
import { syncInboundWhatsAppMessages } from '@/lib/aiSdr';
import { getRecentQualifiedAlerts } from '@/lib/pushNotifications';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    try {
      setDetectedAppOrigin(new URL(request.url).origin);
    } catch {}
    ensureAutomationWorkerRunning();
    await syncInboundWhatsAppMessages().catch(() => 0);

    const [settings, metrics, leads, logs, waQueue, waStatus, qualifiedAlerts] = await Promise.all([
      getAutomationSettings(),
      getAutomationMetrics(),
      getAutomationLeads(),
      getAutomationLogs(40),
      getWhatsAppQueue().catch(() => []),
      getWhatsAppStatus().catch(() => null),
      getRecentQualifiedAlerts().catch(() => [])
    ]);

    // Garante estritamente 1 Lead = 1 Disparo: se o microserviço Go contou múltiplos balões do mesmo lead, sincroniza com dispatchedToday
    if (waStatus && typeof metrics?.dispatchedToday === 'number' && waStatus.sent_today > metrics.dispatchedToday) {
      waStatus.sent_today = metrics.dispatchedToday;
      waStatus.limit_reached = metrics.dispatchedToday >= (settings?.daily_limit || waStatus.daily_limit || 15);
      updateWhatsAppConfig({ sent_today: metrics.dispatchedToday }).catch(() => {});
    }

    // Se o microserviço Go estiver digitando ativamente para alguém na fila, sincroniza com o estado global
    const typingQueueItem = (waQueue || []).find(q => q.status === 'typing');
    if (typingQueueItem) {
      const matchedLead = leads.find(l => isSamePhone(l.phone, typingQueueItem.phone));
      setCurrentlyTyping({
        phone: typingQueueItem.phone,
        company_name: matchedLead?.company_name || 'Contato WhatsApp',
        started_at: typingQueueItem.created_at || new Date().toISOString(),
        estimated_duration_sec: 45,
        message_preview: typingQueueItem.message?.slice(0, 80)
      });
    }

    const nextSchedule = calculateNextDispatchSchedule(settings, leads, metrics);
    const currentlyTyping = getCurrentlyTyping();

    return NextResponse.json({
      settings,
      metrics,
      leads,
      logs,
      next_schedule: nextSchedule,
      currently_typing: currentlyTyping,
      whatsapp_queue: waQueue || [],
      whatsapp_status: waStatus,
      qualified_alerts: qualifiedAlerts || []
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao obter status da automação' },
      { status: 500 }
    );
  }
}
