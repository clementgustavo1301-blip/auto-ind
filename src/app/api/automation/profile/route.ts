import { NextResponse } from 'next/server';
import { 
  getAutomationSettings, 
  switchAutomationProfile, 
  AUTOMATION_PROFILES 
} from '@/lib/automation';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getAutomationSettings();
    return NextResponse.json({
      active_profile: settings.profile || 'gustavo',
      profiles: AUTOMATION_PROFILES
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao consultar perfis' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawProfile = body.profile;

    if (rawProfile !== 'gustavo' && rawProfile !== 'sergio') {
      return NextResponse.json(
        { error: 'Perfil inválido. Opções disponíveis: "gustavo" ou "sergio"' },
        { status: 400 }
      );
    }

    const profileId = rawProfile as 'gustavo' | 'sergio';

    const updated = await switchAutomationProfile(profileId);
    return NextResponse.json({
      success: true,
      active_profile: profileId,
      profile_details: AUTOMATION_PROFILES[profileId],
      settings: updated
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao alternar perfil' },
      { status: 500 }
    );
  }
}
