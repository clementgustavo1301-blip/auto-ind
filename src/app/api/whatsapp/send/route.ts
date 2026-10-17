import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message, media_url } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros "phone" e "message" são obrigatórios.' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage({ phone, message, media_url });

    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno ao processar requisição.' },
      { status: 500 }
    );
  }
}
