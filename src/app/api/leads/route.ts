import { NextResponse } from 'next/server';
import { scrapeLeads } from '@/lib/scraper';
import { scrapeSerpAPI } from '@/lib/outscraper';
import { Lead } from '@/types';

import { filterLeadsWithWhatsApp } from '@/lib/phone';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const LEADS_PER_BATCH = 100;

function opportunityScore(lead: Lead) {
  return (!lead.website ? 10 : 0) + (lead.whatsapp ? 3 : 0) + (lead.instagram ? 1 : 0);
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function selectBatch(leads: Lead[]) {
  const leadsByScore = new Map<number, Lead[]>();

  for (const lead of leads) {
    const score = opportunityScore(lead);
    const group = leadsByScore.get(score) || [];
    group.push(lead);
    leadsByScore.set(score, group);
  }

  return [...leadsByScore.entries()]
    .sort(([scoreA], [scoreB]) => scoreB - scoreA)
    .flatMap(([, group]) => shuffle(group))
    .slice(0, LEADS_PER_BATCH);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const city = searchParams.get('city');
    const country = searchParams.get('country');
    const source = searchParams.get('source') || 'osm';
    const noSite = searchParams.get('noSite') === 'true';
    const excludedIds = new Set(
      (searchParams.get('excludeIds') || '')
        .split(',')
        .filter(Boolean)
    );

    if (!category || !city || !country) {
      return NextResponse.json(
        { error: 'Categoria, Cidade e País são obrigatórios' },
        { status: 400 }
      );
    }

    if (source === 'serpapi') {
      const result = await scrapeSerpAPI(category, city, country);
      const filtered = noSite ? result.leads.filter(l => !l.website) : result.leads;
      // Descarta números sem WhatsApp ou linhas fixas
      const validWhatsAppLeads = await filterLeadsWithWhatsApp(filtered);
      const unseenLeads = validWhatsAppLeads.filter(lead => !excludedIds.has(lead.id));
      return NextResponse.json({
        leads: selectBatch(unseenLeads),
        credits: result.credits,
        renewalDate: result.renewalDate,
        source: 'serpapi',
        exhausted: excludedIds.size > 0 && unseenLeads.length === 0,
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    } else {
      let leads = await scrapeLeads(category, city, country);
      let filtered = noSite ? leads.filter(l => !l.website) : leads;
      let validWhatsAppLeads = await filterLeadsWithWhatsApp(filtered);

      // Se o OpenStreetMap não contiver números móveis com WhatsApp e houver SERPAPI_KEY, resgata no Google Maps
      let credits: number | null = null;
      let usedSource = 'osm';
      if (validWhatsAppLeads.length === 0 && process.env.SERPAPI_KEY) {
        try {
          const serpResult = await scrapeSerpAPI(category, city, country);
          const serpFiltered = noSite ? serpResult.leads.filter(l => !l.website) : serpResult.leads;
          const serpWhatsApp = await filterLeadsWithWhatsApp(serpFiltered);
          if (serpWhatsApp.length > 0) {
            validWhatsAppLeads = serpWhatsApp;
            credits = serpResult.credits ?? null;
            usedSource = 'serpapi';
          }
        } catch (e) {
          console.warn('[LeadsRoute] Fallback OSM -> SerpAPI falhou:', e);
        }
      }

      const unseenLeads = validWhatsAppLeads.filter(lead => !excludedIds.has(lead.id));
      return NextResponse.json({
        leads: selectBatch(unseenLeads),
        credits,
        source: usedSource,
        exhausted: excludedIds.size > 0 && unseenLeads.length === 0,
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
