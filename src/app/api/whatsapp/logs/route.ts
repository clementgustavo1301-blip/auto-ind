import { NextResponse } from 'next/server';
import { getWhatsAppLogs, insertWhatsAppLog, updateWhatsAppLogStatus, WhatsAppLog } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const logs = await getWhatsAppLogs({ status, search, limit });
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao buscar logs' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Se for uma atualização de status pelo queue_id
    if (body.action === 'update_status' && body.queue_id && body.status) {
      const ok = await updateWhatsAppLogStatus(body.queue_id, body.status, body.error_message);
      return NextResponse.json({ success: ok });
    }

    // Se for inserção de novo log
    const logData: WhatsAppLog = {
      phone: body.phone,
      lead_name: body.lead_name,
      company: body.company,
      city: body.city,
      category: body.category,
      message: body.message,
      media_url: body.media_url,
      status: body.status || 'queued',
      queue_id: body.queue_id,
      error_message: body.error_message,
    };

    const inserted = await insertWhatsAppLog(logData);
    return NextResponse.json({ success: inserted !== null, log: inserted });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao processar log' },
      { status: 500 }
    );
  }
}
