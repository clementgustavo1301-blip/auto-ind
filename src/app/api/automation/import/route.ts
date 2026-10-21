import { NextRequest, NextResponse } from 'next/server';
import { addLeadsToAutomation, runAutomationCycle } from '@/lib/automation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leads = body.leads;
    const dispatchImmediately = Boolean(body.dispatchImmediately);

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead fornecido para importação.' },
        { status: 400 }
      );
    }

    const result = await addLeadsToAutomation(leads);

    let dispatchResult = null;
    if (dispatchImmediately && result.leads && result.leads.length > 0) {
      const targetLead = result.leads[0];
      dispatchResult = await runAutomationCycle({
        force: true,
        skipSearch: true,
        targetLeadId: targetLead.id
      });
    }

    return NextResponse.json({
      success: true,
      message: dispatchResult?.executed
        ? `Lead cadastrado e disparo teste enviado com sucesso!`
        : `${result.added} leads adicionados à fila de automação com sucesso.`,
      added: result.added,
      duplicates: result.duplicates,
      total: result.total,
      leads: result.leads,
      dispatchResult
    });
  } catch (err: any) {
    console.error('[API /api/automation/import] Erro:', err);
    return NextResponse.json(
      { error: err.message || 'Falha ao importar leads' },
      { status: 500 }
    );
  }
}
