import { NextResponse } from 'next/server';
import { processIncomingWhatsAppMessage } from '@/lib/aiSdr';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = body.phone || body.from || body.sender;
    const message = body.message || body.text || body.body;

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'Parâmetros "phone" e "message" são obrigatórios no webhook.' },
        { status: 400 }
      );
    }

    const result = await processIncomingWhatsAppMessage(phone, message);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Erro ao processar mensagem:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno no processamento do webhook' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    description: 'Endpoint de Webhook para Mensagens Recebidas do WhatsApp (Whatsmeow -> Next.js)'
  });
}
