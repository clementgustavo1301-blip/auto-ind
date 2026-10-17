import { IndustrialLead } from '../types';
import { calculateIndustryScore, guessSaltDetails } from './industryScoring';
import { discoverCnpjViaSearch } from './cnpjDiscovery';
import { fetchCompanyData } from './brasilAPI';
import { filterLeadsWithWhatsApp, isLikelyMobilePhone } from './phone';

/**
 * Mapeia os segmentos selecionados para queries de busca mais ricas
 */
function buildQueries(segments: string[], city: string, state: string, country: string): string[] {
  const locationParts = [];
  if (city) locationParts.push(city);
  if (state) locationParts.push(state);
  if (country) locationParts.push(country);
  
  const baseLocation = `em ${locationParts.join(', ')}`;
  
  if (segments.length === 0 || segments.includes('Todos os segmentos')) {
    return [
      `indústrias ${baseLocation}`,
      `fábricas ${baseLocation}`,
      `empresas industriais ${baseLocation}`,
      `distribuidoras ${baseLocation}`
    ];
  }

  const queries = new Set<string>();
  
  for (const segment of segments) {
    const s = segment.toLowerCase();
    queries.add(`"${segment}" ${baseLocation}`);
    queries.add(`indústria ${segment} ${baseLocation}`);
    queries.add(`fábrica de ${segment} ${baseLocation}`);
    queries.add(`distribuidora ${segment} ${baseLocation}`);

    if (s.includes('tratamento de água') || s.includes('saneamento')) {
      queries.add(`estação de tratamento de água ${baseLocation}`);
      queries.add(`tratamento de efluentes ${baseLocation}`);
      queries.add(`saneamento ${baseLocation}`);
    } else if (s.includes('química') || s.includes('petroquímica')) {
      queries.add(`indústria química ${baseLocation}`);
      queries.add(`produtos químicos industriais ${baseLocation}`);
      queries.add(`distribuidora de químicos ${baseLocation}`);
    } else if (s.includes('petróleo') || s.includes('perfuração')) {
      queries.add(`óleo e gás ${baseLocation}`);
      queries.add(`serviços de perfuração ${baseLocation}`);
      queries.add(`petróleo ${baseLocation}`);
    } else if (s.includes('alimentícia') || s.includes('frigorífico') || s.includes('carnes') || s.includes('alimento')) {
      queries.add(`indústria alimentícia ${baseLocation}`);
      queries.add(`frigorífico ${baseLocation}`);
      queries.add(`fábrica de alimentos ${baseLocation}`);
      queries.add(`laticínios ${baseLocation}`);
    } else if (s.includes('têxtil') || s.includes('confecção')) {
      queries.add(`indústria têxtil ${baseLocation}`);
      queries.add(`fábrica de tecidos ${baseLocation}`);
    } else if (s.includes('cerâmica') || s.includes('vidro')) {
      queries.add(`indústria cerâmica ${baseLocation}`);
      queries.add(`olaria ${baseLocation}`);
    } else if (s.includes('pesca') || s.includes('pescado')) {
      queries.add(`frigorífico de peixes ${baseLocation}`);
      queries.add(`beneficiamento de pescado ${baseLocation}`);
    }
  }

  return Array.from(queries);
}

export async function scrapeIndustries(
  country: string,
  state: string,
  city: string,
  segments: string[],
  quantity: number,
  excludeIds: string[] = []
): Promise<{ leads: IndustrialLead[]; credits?: number; renewalDate?: string; exhausted: boolean }> {
  
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_KEY não configurada. Crie uma conta grátis em serpapi.com.');
  }

  const queries = buildQueries(segments, city, state, country);
  let allPlaces = new Map<string, any>(); // Usar map para evitar duplicatas por place_id
  let credits: number | undefined;
  let renewalDate: string | undefined;
  
  let totalSearches = 0;
  // Meta bruta aumentada para garantir abundância pós-filtro de WhatsApp
  const targetRawPlaces = Math.max(quantity * 4, 60);
  
  for (const query of queries) {
    if (allPlaces.size >= targetRawPlaces) break;

    console.log(`[IndustryScraper] Buscando: "${query}"...`);

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google_maps');
    url.searchParams.set('q', query);
    url.searchParams.set('hl', 'pt');
    url.searchParams.set('type', 'search');
    url.searchParams.set('api_key', apiKey);

    let currentUrl = url.toString();
    let pagesFetched = 0;
    const MAX_PAGES = 5; // Aumentado para 5 páginas para maximizar volume de leads

    while (pagesFetched < MAX_PAGES && allPlaces.size < targetRawPlaces) {
      const res = await fetch(currentUrl);
      if (!res.ok) break;

      const data = await res.json();
      totalSearches++;
      
      const places = data?.local_results || [];
      for (const place of places) {
        if (place.place_id && !excludeIds.includes(place.place_id)) {
          allPlaces.set(place.place_id, place);
        }
      }
      
      pagesFetched++;

      if (data?.serpapi_pagination?.next) {
        currentUrl = data.serpapi_pagination.next + `&api_key=${apiKey}`;
      } else {
        break;
      }
    }
  }

  // Converter para IndustrialLead e aplicar scoring
  const rawPlaces = Array.from(allPlaces.values());
  const processedLeads: IndustrialLead[] = [];

  for (const place of rawPlaces) {
    const name = place.title || '';
    const category = place.type || '';
    const snippet = place.description || '';
    
    // Filtro básico de sem-nome
    if (!name || name === 'Sem Nome') continue;

    const scoring = calculateIndustryScore(name, category, snippet, segments);
    
    // Informações de contato
    let phone = place.phone || place.unformatted_phone || undefined;
    const website = place.website || undefined;

    // Se não tem telefone OU o telefone extraído é linha fixa,
    // resgata ativamente o WhatsApp celular do unformatted_phone, website ou redes
    if (!phone || !isLikelyMobilePhone(phone)) {
      if (place.unformatted_phone && isLikelyMobilePhone(place.unformatted_phone)) {
        phone = place.unformatted_phone;
      } else if (website && /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/i.test(website)) {
        const match = website.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/i);
        if (match && match[1]) phone = '+' + match[1];
      } else if (place.links) {
        for (const val of Object.values(place.links)) {
          const match = String(val).match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/i);
          if (match && match[1]) {
            phone = '+' + match[1];
            break;
          }
        }
      }
    }

    let instagram: string | undefined;
    if (place.links) {
      const instaLink = Object.entries(place.links).find(([key]) => key.toLowerCase().includes('instagram'));
      if (instaLink) {
        instagram = String(instaLink[1]).split('instagram.com/')[1]?.split(/[?/]/)[0];
      }
    }

    const { applications, types } = guessSaltDetails(`${name} ${category} ${snippet}`);

    processedLeads.push({
      id: place.place_id,
      name,
      category,
      city,
      state,
      country,
      website,
      whatsapp: phone,
      instagram,
      // Novos campos industriais
      cnpj: undefined, // não temos na API pública facilmente
      companySize: 'Desconhecido',
      mainActivity: category,
      expectedApplications: applications,
      expectedSaltTypes: types,
      consumptionPotential: scoring.potential,
      score: scoring.score,
      justification: scoring.justification,
    });
  }

  // Descarta leads sem WhatsApp ou com telefone fixo
  const validWhatsAppLeads = await filterLeadsWithWhatsApp(processedLeads);

  // Ordenar por maior potencial/score
  validWhatsAppLeads.sort((a, b) => b.score - a.score);

  // Consulta de créditos do SerpAPI (opcional, só para manter a interface igual)
  try {
    const accountRes = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`);
    if (accountRes.ok) {
      const accountData = await accountRes.json();
      credits = accountData.total_searches_left;
      
      const renewalDayStr = process.env.SERPAPI_RENEWAL_DAY;
      if (renewalDayStr) {
        const renewalDay = parseInt(renewalDayStr, 10);
        const today = new Date();
        const currentMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let nextRenewal = new Date(today.getFullYear(), today.getMonth(), renewalDay);
        
        if (currentMidnight.getTime() >= nextRenewal.getTime()) {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        }
        
        const diffTime = nextRenewal.getTime() - currentMidnight.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        renewalDate = `em ${diffDays} dias`;
      }
    }
  } catch (e) {
    console.error('Erro ao pegar conta serpapi', e);
  }

  // Corta a quantidade solicitada (após filtrar por WhatsApp e ordenar por score)
  let finalLeads = validWhatsAppLeads.slice(0, quantity);

  // ENRIQUECIMENTO B2B VIA BRASIL API (e OSINT de CNPJ)
  // Limita o enriquecimento em lote aos top 10 para preservar cota mensal do SerpAPI
  const leadsToEnrich = finalLeads.slice(0, 10);
  const remainingLeads = finalLeads.slice(10);
  console.log(`[IndustryScraper] Iniciando enriquecimento de ${leadsToEnrich.length} leads prioritários...`);
  
  const enrichedTopLeads = await Promise.all(leadsToEnrich.map(async (lead) => {
    try {
      // 1. Achar CNPJ
      const cnpj = await discoverCnpjViaSearch(lead.name, city, state, country);
      if (cnpj) {
        lead.cnpj = cnpj;
        
        // 2. Buscar dados oficiais na Receita (Brasil API)
        const companyData = await fetchCompanyData(cnpj);
        
        if (companyData) {
          lead.razaoSocial = companyData.razao_social;
          lead.cnae = companyData.cnae_fiscal_descricao;
          lead.cnaesSecundarios = companyData.cnaes_secundarios.map(c => c.descricao);
          lead.porteReceita = companyData.descricao_porte;
          lead.capitalSocial = companyData.capital_social;
          
          // Re-avaliar o score com os dados oficiais (CNAE)
          const newScoring = calculateIndustryScore(lead.name, lead.category, '', segments, lead.cnae);
          
          // Se o score melhorou com os dados oficiais da Receita, atualiza.
          if (newScoring.score > lead.score) {
            lead.score = newScoring.score;
            lead.consumptionPotential = newScoring.potential;
            lead.justification = newScoring.justification;
          }
        }
      }
    } catch (e) {
      console.error(`Erro ao enriquecer lead ${lead.name}:`, e);
    }
    
    return lead;
  }));

  finalLeads = [...enrichedTopLeads, ...remainingLeads];
  
  // Re-ordenar após enriquecimento
  finalLeads.sort((a, b) => b.score - a.score);

  return { 
    leads: finalLeads, 
    credits, 
    renewalDate,
    exhausted: validWhatsAppLeads.length <= quantity
  };
}
