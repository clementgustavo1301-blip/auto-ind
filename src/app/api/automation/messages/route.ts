import { NextResponse } from 'next/server';
import { getAutomationMessages, addAutomationMessage } from '@/lib/automation';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
    }

    const messages = await getAutomationMessages(phone);
    return NextResponse.json({ messages }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao obter mensagens' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { phone, content } = await request.json();

    if (!phone || !content) {
      return NextResponse.json({ error: 'Telefone e mensagem são obrigatórios' }, { status: 400 });
    }

    // Envia no WhatsApp via WhatsApp Service
    const sendResult = await sendWhatsAppMessage({ phone, message: content });

    // Salva mensagem manual como enviada por humano
    const message = await addAutomationMessage(phone, 'outbound', 'human', content);

    return NextResponse.json({ success: sendResult.success, message });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao enviar mensagem manual' },
      { status: 500 }
    );
  }
}
