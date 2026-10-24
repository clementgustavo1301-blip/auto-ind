import { NextResponse } from 'next/server';
import {
  getOrCreateVapidKeys,
  getPushSubscriptions,
  savePushSubscription,
  getRecentQualifiedAlerts,
  notifyLeadQualified
} from '@/lib/pushNotifications';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [keys, subs, alerts] = await Promise.all([
      getOrCreateVapidKeys(),
      getPushSubscriptions(),
      getRecentQualifiedAlerts()
    ]);

    return NextResponse.json(
      {
        publicKey: keys.publicKey,
        subscribedCount: subs.length,
        alerts
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar chaves Push' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.action === 'test') {
      const result = await notifyLeadQualified(
        {
          phone: body.phone || '5584999999999',
          company_name: body.company_name || 'Empresa Exemplo (Teste Push)',
          city: body.city || 'Mossoró - RN',
          segment: body.segment || 'Clínica / Comércio',
          qualification_notes: 'Lead qualificado! Confirmou interesse e aguarda seu contato para fechamento.'
        },
        body.notes || 'Lead qualificado! Confirmou interesse e aguarda seu contato para fechamento.',
        true
      );
      return NextResponse.json({
        success: true,
        pushedCount: result.pushedCount,
        alert: result.alert
      });
    }

    const subscription = body?.subscription || body;
    const userAgent = request.headers.get('user-agent') || undefined;
    const total = await savePushSubscription(subscription, userAgent);

    return NextResponse.json({
      success: true,
      subscribedCount: total
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Falha ao salvar inscrição Push' },
      { status: 400 }
    );
  }
}
