import { NextResponse } from 'next/server';
import { disconnectWhatsApp } from '@/lib/whatsapp';

export async function POST() {
  try {
    const ok = await disconnectWhatsApp();
    return NextResponse.json({ success: ok });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Falha ao desconectar WhatsApp' },
      { status: 500 }
    );
  }
}
