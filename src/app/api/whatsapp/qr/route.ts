import { NextResponse } from 'next/server';
import { getWhatsAppQR } from '@/lib/whatsapp';

export async function GET() {
  try {
    const data = await getWhatsAppQR();
    if (!data) {
      return NextResponse.json({
        connected: false,
        logged_in: false,
        has_qr: false,
        error: 'Microserviço WhatsApp indisponível no momento',
      }, { status: 503 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao obter QR code' },
      { status: 500 }
    );
  }
}
