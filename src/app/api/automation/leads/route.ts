import { NextResponse } from 'next/server';
import { 
  getAutomationLeads, 
  deleteAutomationLead, 
  deleteDisqualifiedLeads 
} from '@/lib/automation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leads = await getAutomationLeads();
    return NextResponse.json({ leads }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao carregar leads' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || undefined;
    const phone = searchParams.get('phone') || undefined;
    const isDisqualified = searchParams.get('disqualified') === 'true';

    if (isDisqualified) {
      const count = await deleteDisqualifiedLeads();
      return NextResponse.json({
        success: true,
        deleted_count: count,
        message: `${count} leads desqualificados excluídos com sucesso.`
      });
    }

    if (!id && !phone) {
      return NextResponse.json(
        { error: 'Informe "id" ou "phone" do lead para exclusão.' },
        { status: 400 }
      );
    }

    const success = await deleteAutomationLead({ id, phone });
    return NextResponse.json({
      success,
      message: success ? 'Lead excluído com sucesso.' : 'Lead não encontrado.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao excluir lead' },
      { status: 500 }
    );
  }
}
