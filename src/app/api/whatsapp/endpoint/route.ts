import { NextResponse } from 'next/server';
import { getServiceUrl, setServiceUrl, getWhatsAppStatus } from '@/lib/whatsapp';
import fs from 'fs';
import path from 'path';

export async function GET() {
  return NextResponse.json({
    url: getServiceUrl(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newUrl = (body.url || '').trim().replace(/\/+$/, '');

    if (!newUrl) {
      return NextResponse.json({ error: 'URL do microserviço é obrigatória' }, { status: 400 });
    }

    setServiceUrl(newUrl);

    // Tentar atualizar o arquivo .env.local para persistir
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf-8');
        if (content.includes('WHATSAPP_SERVICE_URL=')) {
          content = content.replace(/WHATSAPP_SERVICE_URL=.*/g, `WHATSAPP_SERVICE_URL=${newUrl}`);
        } else {
          content += `\nWHATSAPP_SERVICE_URL=${newUrl}\n`;
        }
        fs.writeFileSync(envPath, content, 'utf-8');
      }
    } catch (fsErr) {
      console.warn('Não foi possível persistir no .env.local:', fsErr);
    }

    // Testar conexão
    const status = await getWhatsAppStatus();

    return NextResponse.json({
      success: true,
      url: newUrl,
      reachable: status !== null,
      status,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Falha ao atualizar endpoint' }, { status: 500 });
  }
}
