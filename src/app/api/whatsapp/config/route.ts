import { NextResponse } from 'next/server';
import { getWhatsAppConfig, updateWhatsAppConfig } from '@/lib/whatsapp';
import { getAutomationMetrics } from '@/lib/automation';

export async function GET() {
  try {
    const [config, metrics] = await Promise.all([
      getWhatsAppConfig(),
      getAutomationMetrics().catch(() => null)
    ]);
    if (!config) {
      return NextResponse.json(
        { error: 'Não foi possível carregar a configuração do microserviço WhatsApp' },
        { status: 502 }
      );
    }
    if (metrics && typeof metrics.dispatchedToday === 'number' && config.sent_today > metrics.dispatchedToday) {
      config.sent_today = metrics.dispatchedToday;
      updateWhatsAppConfig({ sent_today: metrics.dispatchedToday }).catch(() => {});
    }
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao consultar configuração' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const success = await updateWhatsAppConfig(body);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Falha ao atualizar parâmetros no microserviço' },
        { status: 502 }
      );
    }
    const updated = await getWhatsAppConfig();
    return NextResponse.json({ success: true, config: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno ao salvar configuração' },
      { status: 500 }
    );
  }
}
