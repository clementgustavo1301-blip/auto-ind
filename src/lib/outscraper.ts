import { Lead } from '../types';

/**
 * SerpAPI Google Maps Scraper
 * Endpoint: https://serpapi.com/search?engine=google_maps
 * Free tier: 250 buscas/mês (sem cartão)
 * Cadastro: https://serpapi.com/users/sign_up
 */
export async function scrapeSerpAPI(category: string, city: string, country: string): Promise<{ leads: Lead[]; credits?: number; renewalDate?: string }> {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error('SERPAPI_KEY não configurada. Crie uma conta grátis em serpapi.com e adicione a key ao .env.local');
  }

  const query = `${category} em ${city}, ${country}`;
  console.log(`[SerpAPI] Buscando: "${query}"...`);

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'pt');
  url.searchParams.set('type', 'search');
  url.searchParams.set('api_key', apiKey);

  let allPlaces: any[] = [];
  let currentUrl = url.toString();
  let pagesFetched = 0;
  const MAX_PAGES = 3;

  while (pagesFetched < MAX_PAGES) {
    console.log(`[SerpAPI] Buscando página ${pagesFetched + 1}...`);
    const res = await fetch(currentUrl);

    if (res.status === 401) {
      if (pagesFetched === 0) throw new Error('API Key do SerpAPI inválida. Verifique o .env.local');
      console.error('[SerpAPI] Erro 401 em página extra. Ignorando e continuando com o que temos.');
      break;
    }

    if (res.status === 429) {
      if (pagesFetched === 0) throw new Error('Limite mensal de buscas SerpAPI atingido (250/mês). Use o OpenStreetMap.');
      console.error('[SerpAPI] Erro 429 em página extra. Ignorando e continuando com o que temos.');
      break;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[SerpAPI] Erro ${res.status}:`, errText.slice(0, 300));
      if (pagesFetched === 0) throw new Error(`SerpAPI retornou erro ${res.status}`);
      break;
    }

    const data = await res.json();
    const places = data?.local_results || [];
    allPlaces = allPlaces.concat(places);
    pagesFetched++;

    if (data?.serpapi_pagination?.next) {
      currentUrl = data.serpapi_pagination.next + `&api_key=${apiKey}`;
    } else {
      break;
    }
  }

  if (allPlaces.length === 0) {
    return { leads: [], credits: undefined };
  }

  console.log(`[SerpAPI] ${allPlaces.length} resultados listados de ${pagesFetched} página(s).`);

  const leads: Lead[] = allPlaces.map((place: any, idx: number) => {
    // Extrai telefone
    const phone = place.phone || undefined;

    // Extrai website
    const website = place.website || undefined;

    // SerpAPI não retorna Instagram diretamente, mas podemos extrair dos links
    let instagram: string | undefined;
    if (place.links) {
      const instaLink = Object.entries(place.links).find(([key]) => 
        key.toLowerCase().includes('instagram')
      );
      if (instaLink) {
        const instaUrl = String(instaLink[1]);
        instagram = instaUrl.split('instagram.com/')[1]?.split(/[?/]/)[0];
      }
    }

    return {
      id: place.place_id || String(idx),
      name: place.title || 'Sem Nome',
      category,
      city,
      country,
      website,
      instagram,
      whatsapp: phone,
    };
  });

  const validLeads = leads.filter((l: Lead) => l.name !== 'Sem Nome');

  // Mesma estratégia: SEM website = oportunidade, COM contato = prioridade
  validLeads.sort((a: Lead, b: Lead) => {
    const scoreA = (!a.website ? 10 : 0) + (a.whatsapp ? 3 : 0) + (a.instagram ? 1 : 0);
    const scoreB = (!b.website ? 10 : 0) + (b.whatsapp ? 3 : 0) + (b.instagram ? 1 : 0);
    return scoreB - scoreA;
  });

  // Consulta créditos restantes
  let credits: number | undefined;
  let renewalDate: string | undefined;
  try {
    const accountRes = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`);
    if (accountRes.ok) {
      const accountData = await accountRes.json();
      credits = accountData.total_searches_left;
      console.log(`[SerpAPI] Créditos restantes: ${credits}`);

      const renewalDayStr = process.env.SERPAPI_RENEWAL_DAY;
      if (renewalDayStr) {
        const renewalDay = parseInt(renewalDayStr, 10);
        const today = new Date();
        // Zera as horas para comparar corretamente apenas as datas
        const currentMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let nextRenewal = new Date(today.getFullYear(), today.getMonth(), renewalDay);
        
        // Se a data de renovação deste mês já passou ou é hoje, a próxima é no mês que vem
        if (currentMidnight.getTime() >= nextRenewal.getTime()) {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        }
        
        const diffTime = nextRenewal.getTime() - currentMidnight.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        renewalDate = `em ${diffDays} dias (${nextRenewal.toLocaleDateString('pt-BR')})`;
      } else {
        renewalDate = 'Configure SERPAPI_RENEWAL_DAY no .env.local para ver os dias';
      }
    }
  } catch {
    // Se falhar, não bloqueia
  }

  return { leads: validLeads, credits, renewalDate };
}
