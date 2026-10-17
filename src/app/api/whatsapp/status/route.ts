import { NextResponse } from 'next/server';
import { getWhatsAppStatus, getWhatsAppQueue } from '@/lib/whatsapp';

export async function GET() {
  try {
    const [status, queue] = await Promise.all([
      getWhatsAppStatus(),
      getWhatsAppQueue(),
    ]);

    return NextResponse.json({
      status: status || { connected: false, logged_in: false, has_qr: false, sent_today: 0, daily_limit: 15, limit_reached: false, queue_length: 0 },
      queue,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao consultar status' },
      { status: 500 }
    );
  }
}
