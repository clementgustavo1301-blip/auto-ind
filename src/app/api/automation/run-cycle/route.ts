import { NextResponse } from 'next/server';
import { runAutomationCycle, ensureAutomationWorkerRunning } from '@/lib/automation';
import { setDetectedAppOrigin } from '@/lib/whatsapp';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    try {
      setDetectedAppOrigin(new URL(request.url).origin);
    } catch {}
    ensureAutomationWorkerRunning();

    let force = false;
    let skipSearch = false;
    let targetLeadId: string | undefined = undefined;
    try {
      const body = await request.json();
      force = Boolean(body?.force);
      skipSearch = Boolean(body?.skipSearch);
      targetLeadId = body?.targetLeadId;
    } catch {
      // Body vazio, force = false
    }

    const result = await runAutomationCycle({ force, skipSearch, targetLeadId });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    console.error('[RunCycle] Erro ao rodar ciclo da automação:', err);
    return NextResponse.json(
      { executed: false, error: err.message || 'Erro interno ao executar ciclo' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    try {
      setDetectedAppOrigin(new URL(request.url).origin);
    } catch {}
    ensureAutomationWorkerRunning();

    // Permite execução via Vercel Cron, Heartbeat Go ou Healthcheck
    const result = await runAutomationCycle({ force: false, skipSearch: false });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    console.error('[RunCycle GET] Erro ao rodar ciclo da automação via cron/GET:', err);
    return NextResponse.json(
      { executed: false, error: err.message || 'Erro interno ao executar ciclo' },
      { status: 500 }
    );
  }
}
