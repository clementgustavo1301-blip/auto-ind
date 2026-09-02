import { NextResponse } from 'next/server';
import { scrapeLeads } from '@/lib/scraper';
import { scrapeSerpAPI } from '@/lib/outscraper';
import { Lead } from '@/types';

const LEADS_PER_BATCH = 50;

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
      const unseenLeads = filtered.filter(lead => !excludedIds.has(lead.id));
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
      const leads = await scrapeLeads(category, city, country);
      const filtered = noSite ? leads.filter(l => !l.website) : leads;
      const unseenLeads = filtered.filter(lead => !excludedIds.has(lead.id));
      return NextResponse.json({
        leads: selectBatch(unseenLeads),
        credits: null,
        source: 'osm',
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
