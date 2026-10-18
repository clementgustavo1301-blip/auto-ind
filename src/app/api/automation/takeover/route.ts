import { NextResponse } from 'next/server';
import { updateAutomationLead, addAutomationLog } from '@/lib/automation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { phone, takeover } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 });
    }

    const success = await updateAutomationLead(phone, {
      human_takeover: Boolean(takeover)
    });

    await addAutomationLog(
      'system',
      `Operador humano ${takeover ? 'ASSUMIU a conversa' : 'DEVOLVEU o controle para a IA'} do lead ${phone}.`,
      phone
    );

    return NextResponse.json({ success, human_takeover: Boolean(takeover) });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao alterar controle da conversa' },
      { status: 500 }
    );
  }
}
