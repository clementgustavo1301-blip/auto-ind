import { NextResponse } from 'next/server';
import { scrapeIndustries } from '@/lib/industryScraper';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'Brasil';
    const state = searchParams.get('state') || '';
    const city = searchParams.get('city') || '';
    
    // Arrays vêm separados por vírgula da URL
    const segmentsRaw = searchParams.get('segments') || '';
    const segments = segmentsRaw ? segmentsRaw.split(',').map(s => s.trim()) : [];
    
    // Aplicações e tipos de sal (para uso futuro ou filtragem extra pós-scraping)
    // const applicationsRaw = searchParams.get('applications') || '';
    // const saltTypesRaw = searchParams.get('saltTypes') || '';
    
    const quantity = parseInt(searchParams.get('quantity') || '10', 10);
    const excludeIdsRaw = searchParams.get('excludeIds') || '';
    const excludeIds = excludeIdsRaw ? excludeIdsRaw.split(',') : [];

    if (!country) {
      return NextResponse.json(
        { error: 'País é obrigatório' },
        { status: 400 }
      );
    }

    const result = await scrapeIndustries(
      country,
      state,
      city,
      segments,
      quantity,
      excludeIds
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno do servidor ao buscar indústrias' },
      { status: 500 }
    );
  }
}
