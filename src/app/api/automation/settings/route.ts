import { NextResponse } from 'next/server';
import { getAutomationSettings, saveAutomationSettings } from '@/lib/automation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getAutomationSettings();
    return NextResponse.json(settings, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar configurações' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const updates = await request.json();
    const updated = await saveAutomationSettings(updates);
    return NextResponse.json(updated, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar configurações' },
      { status: 500 }
    );
  }
}
