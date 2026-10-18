import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { insertWhatsAppLog } from '@/lib/supabase';
import { interpolateVariables } from '@/lib/templateInterpolation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message, media_url, lead_name, company, city, category } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros "phone" e "message" são obrigatórios.' },
        { status: 400 }
      );
    }

    // Camada de segurança: garante que qualquer tag {saudacao}, {{nome}}, etc. seja resolvida antes do envio
    const resolvedMessage = interpolateVariables(message, {
      nome: lead_name,
      empresa: company,
      cidade: city,
      categoria: category,
      telefone: phone
    });

    const result = await sendWhatsAppMessage({ phone, message: resolvedMessage, media_url });

    // Registrar log no Supabase
    insertWhatsAppLog({
      phone,
      message: resolvedMessage,
      media_url,
      lead_name,
      company,
      city,
      category,
      status: result.success ? (result.queued ? 'queued' : 'sent') : 'failed',
      queue_id: result.queue_id || undefined,
      error_message: result.error || undefined,
    }).catch(err => console.error('Erro ao gravar log no Supabase:', err));

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
