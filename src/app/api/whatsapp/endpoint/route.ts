import { NextResponse } from 'next/server';
import { 
  ensureServiceUrlLoaded, 
  persistServiceUrlToCloud, 
  setDetectedAppOrigin, 
  getDetectedAppOrigin,
  getWhatsAppStatus,
  updateWhatsAppConfig 
} from '@/lib/whatsapp';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    setDetectedAppOrigin(new URL(req.url).origin);
  } catch {}
  const url = await ensureServiceUrlLoaded();
  return NextResponse.json({
    url,
  });
}

export async function POST(req: Request) {
  try {
    try {
      setDetectedAppOrigin(new URL(req.url).origin);
    } catch {}

    const body = await req.json();
    const newUrl = (body.url || '').trim().replace(/\/+$/, '');

    if (!newUrl) {
      return NextResponse.json({ error: 'URL do microserviço é obrigatória' }, { status: 400 });
    }

    await persistServiceUrlToCloud(newUrl);

    // Tentar atualizar o arquivo .env.local para persistir localmente
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

    // Sincronizar URL de webhook/app com o microserviço Go para que ele acione a automação 24/7
    const appOrigin = getDetectedAppOrigin();
    await updateWhatsAppConfig({
      webhook_url: `${appOrigin}/api/whatsapp/webhook`
    } as any).catch(() => false);

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
