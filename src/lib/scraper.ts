import { Lead } from '../types';
import { isLikelyMobilePhone } from './phone';

/**
 * Mapeia categorias comuns de busca (PT-BR) para tags do OpenStreetMap.
 * Cada categoria pode ter múltiplas buscas alternativas para maximizar resultados.
 */
const categoryMap: Record<string, { key: string; value: string }[]> = {
  'restaurante':  [{ key: 'amenity', value: 'restaurant' }],
  'restaurantes': [{ key: 'amenity', value: 'restaurant' }],
  'bar':          [{ key: 'amenity', value: 'bar' }],
  'bares':        [{ key: 'amenity', value: 'bar' }],
  'academia':     [{ key: 'leisure', value: 'fitness_centre' }],
  'academias':    [{ key: 'leisure', value: 'fitness_centre' }],
  'cafe':         [{ key: 'amenity', value: 'cafe' }],
  'cafes':        [{ key: 'amenity', value: 'cafe' }],
  'cafeteria':    [{ key: 'amenity', value: 'cafe' }],
  'cafeterias':   [{ key: 'amenity', value: 'cafe' }],
  'padaria':      [{ key: 'shop', value: 'bakery' }],
  'padarias':     [{ key: 'shop', value: 'bakery' }],
  'pizzaria':     [{ key: 'amenity', value: 'restaurant' }],
  'pizzarias':    [{ key: 'amenity', value: 'restaurant' }],
  'lanchonete':   [{ key: 'amenity', value: 'fast_food' }],
  'lanchonetes':  [{ key: 'amenity', value: 'fast_food' }],
  'hamburgueria': [{ key: 'amenity', value: 'fast_food' }, { key: 'amenity', value: 'restaurant' }],
  'hamburguerias':[{ key: 'amenity', value: 'fast_food' }, { key: 'amenity', value: 'restaurant' }],
  'sorveteria':   [{ key: 'amenity', value: 'ice_cream' }, { key: 'shop', value: 'ice_cream' }],
  'sorveterias':  [{ key: 'amenity', value: 'ice_cream' }, { key: 'shop', value: 'ice_cream' }],
  'acai':         [{ key: 'amenity', value: 'ice_cream' }, { key: 'amenity', value: 'fast_food' }],
  'doceria':      [{ key: 'shop', value: 'confectionery' }, { key: 'shop', value: 'pastry' }],
  'docerias':     [{ key: 'shop', value: 'confectionery' }, { key: 'shop', value: 'pastry' }],
  'confeitaria':  [{ key: 'shop', value: 'pastry' }, { key: 'shop', value: 'confectionery' }],
  'churrascaria': [{ key: 'amenity', value: 'restaurant' }],
  'sushi':        [{ key: 'amenity', value: 'restaurant' }],
  'japones':      [{ key: 'amenity', value: 'restaurant' }],
  'food truck':   [{ key: 'amenity', value: 'fast_food' }],
  'distribuidora':[{ key: 'shop', value: 'beverages' }],
  'cervejaria':   [{ key: 'amenity', value: 'bar' }, { key: 'craft', value: 'brewery' }],
  'pub':          [{ key: 'amenity', value: 'pub' }],

  // ===== SAÚDE =====
  'clinica':      [{ key: 'amenity', value: 'clinic' }, { key: 'amenity', value: 'doctors' }],
  'clinicas':     [{ key: 'amenity', value: 'clinic' }, { key: 'amenity', value: 'doctors' }],
  'hospital':     [{ key: 'amenity', value: 'hospital' }],
  'hospitais':    [{ key: 'amenity', value: 'hospital' }],
  'farmacia':     [{ key: 'amenity', value: 'pharmacy' }],
  'farmacias':    [{ key: 'amenity', value: 'pharmacy' }],
  'dentista':     [{ key: 'amenity', value: 'dentist' }],
  'dentistas':    [{ key: 'amenity', value: 'dentist' }],
  'veterinario':  [{ key: 'amenity', value: 'veterinary' }],
  'veterinarios': [{ key: 'amenity', value: 'veterinary' }],
  'psicologo':    [{ key: 'amenity', value: 'clinic' }, { key: 'healthcare', value: 'psychotherapist' }],
  'fisioterapia': [{ key: 'healthcare', value: 'physiotherapist' }, { key: 'amenity', value: 'clinic' }],
  'laboratorio':  [{ key: 'amenity', value: 'clinic' }, { key: 'healthcare', value: 'laboratory' }],
  'otica':        [{ key: 'shop', value: 'optician' }],
  'oticas':       [{ key: 'shop', value: 'optician' }],
  'nutricionista':[{ key: 'amenity', value: 'clinic' }, { key: 'healthcare', value: 'dietitian' }],

  // ===== BELEZA & ESTÉTICA =====
  'salao':        [{ key: 'shop', value: 'hairdresser' }, { key: 'shop', value: 'beauty' }],
  'saloes':       [{ key: 'shop', value: 'hairdresser' }, { key: 'shop', value: 'beauty' }],
  'barbearia':    [{ key: 'shop', value: 'hairdresser' }],
  'barbearias':   [{ key: 'shop', value: 'hairdresser' }],
  'estetica':     [{ key: 'shop', value: 'beauty' }],
  'manicure':     [{ key: 'shop', value: 'beauty' }],
  'spa':          [{ key: 'leisure', value: 'spa' }, { key: 'amenity', value: 'spa' }],
  'tatuagem':     [{ key: 'shop', value: 'tattoo' }],
  'tattoo':       [{ key: 'shop', value: 'tattoo' }],
  'perfumaria':   [{ key: 'shop', value: 'perfumery' }, { key: 'shop', value: 'cosmetics' }],
  'cosmeticos':   [{ key: 'shop', value: 'cosmetics' }],

  // ===== EDUCAÇÃO =====
  'escola':       [{ key: 'amenity', value: 'school' }],
  'escolas':      [{ key: 'amenity', value: 'school' }],
  'faculdade':    [{ key: 'amenity', value: 'university' }, { key: 'amenity', value: 'college' }],
  'universidade': [{ key: 'amenity', value: 'university' }],
  'curso':        [{ key: 'amenity', value: 'school' }, { key: 'amenity', value: 'training' }],
  'cursos':       [{ key: 'amenity', value: 'school' }, { key: 'amenity', value: 'training' }],
  'autoescola':   [{ key: 'amenity', value: 'driving_school' }],
  'creche':       [{ key: 'amenity', value: 'kindergarten' }],
  'idiomas':      [{ key: 'amenity', value: 'language_school' }],

  // ===== FITNESS & ESPORTE =====
  'crossfit':     [{ key: 'leisure', value: 'fitness_centre' }],
  'pilates':      [{ key: 'leisure', value: 'fitness_centre' }],
  'yoga':         [{ key: 'leisure', value: 'fitness_centre' }],
  'piscina':      [{ key: 'leisure', value: 'swimming_pool' }],
  'quadra':       [{ key: 'leisure', value: 'sports_centre' }],
  'esporte':      [{ key: 'leisure', value: 'sports_centre' }, { key: 'shop', value: 'sports' }],

  // ===== COMÉRCIO / VAREJO =====
  'supermercado': [{ key: 'shop', value: 'supermarket' }],
  'supermercados':[{ key: 'shop', value: 'supermarket' }],
  'mercado':      [{ key: 'shop', value: 'supermarket' }, { key: 'shop', value: 'convenience' }],
  'loja':         [{ key: 'shop', value: 'yes' }],
  'lojas':        [{ key: 'shop', value: 'yes' }],
  'roupa':        [{ key: 'shop', value: 'clothes' }],
  'roupas':       [{ key: 'shop', value: 'clothes' }],
  'calcados':     [{ key: 'shop', value: 'shoes' }],
  'sapatos':      [{ key: 'shop', value: 'shoes' }],
  'joalheria':    [{ key: 'shop', value: 'jewelry' }],
  'relojoaria':   [{ key: 'shop', value: 'watches' }],
  'floricultura': [{ key: 'shop', value: 'florist' }],
  'livraria':     [{ key: 'shop', value: 'books' }],
  'papelaria':    [{ key: 'shop', value: 'stationery' }],
  'brinquedos':   [{ key: 'shop', value: 'toys' }],
  'moveis':       [{ key: 'shop', value: 'furniture' }],
  'eletronicos':  [{ key: 'shop', value: 'electronics' }],
  'celular':      [{ key: 'shop', value: 'mobile_phone' }],
  'celulares':    [{ key: 'shop', value: 'mobile_phone' }],
  'informatica':  [{ key: 'shop', value: 'computer' }],
  'pet shop':     [{ key: 'shop', value: 'pet' }],
  'petshop':      [{ key: 'shop', value: 'pet' }],
  'material de construcao': [{ key: 'shop', value: 'doityourself' }, { key: 'shop', value: 'hardware' }],
  'ferragem':     [{ key: 'shop', value: 'hardware' }],
  'conveniencia': [{ key: 'shop', value: 'convenience' }],
  'shopping':     [{ key: 'shop', value: 'mall' }],
  'atacado':      [{ key: 'shop', value: 'wholesale' }],
  'sex shop':     [{ key: 'shop', value: 'erotic' }],
  'tabacaria':    [{ key: 'shop', value: 'tobacco' }],
  'emporio':      [{ key: 'shop', value: 'deli' }, { key: 'shop', value: 'convenience' }],

  // ===== SERVIÇOS =====
  'oficina':      [{ key: 'shop', value: 'car_repair' }],
  'mecanica':     [{ key: 'shop', value: 'car_repair' }],
  'borracharia':  [{ key: 'shop', value: 'tyres' }],
  'lavanderia':   [{ key: 'shop', value: 'laundry' }],
  'grafica':      [{ key: 'shop', value: 'copyshop' }],
  'costureira':   [{ key: 'shop', value: 'tailor' }],
  'chaveiro':     [{ key: 'shop', value: 'locksmith' }],
  'posto':        [{ key: 'amenity', value: 'fuel' }],
  'estacionamento':[{ key: 'amenity', value: 'parking' }],
  'lavajato':     [{ key: 'amenity', value: 'car_wash' }],
  'lava rapido':  [{ key: 'amenity', value: 'car_wash' }],
  'funeraria':    [{ key: 'shop', value: 'funeral_directors' }],

  // ===== ESCRITÓRIOS & SERVIÇOS PROFISSIONAIS =====
  'marketing':    [{ key: 'office', value: 'marketing' }, { key: 'office', value: 'advertising_agency' }, { key: 'office', value: 'company' }],
  'agencia':      [{ key: 'office', value: 'advertising_agency' }, { key: 'office', value: 'marketing' }, { key: 'office', value: 'company' }],
  'escritorio':   [{ key: 'office', value: 'company' }, { key: 'office', value: 'yes' }],
  'advogado':     [{ key: 'office', value: 'lawyer' }],
  'advogados':    [{ key: 'office', value: 'lawyer' }],
  'imobiliaria':  [{ key: 'office', value: 'estate_agent' }, { key: 'shop', value: 'estate_agent' }],
  'imobiliarias': [{ key: 'office', value: 'estate_agent' }, { key: 'shop', value: 'estate_agent' }],
  'contabilidade':[{ key: 'office', value: 'accountant' }],
  'contador':     [{ key: 'office', value: 'accountant' }],
  'seguros':      [{ key: 'office', value: 'insurance' }],
  'seguradora':   [{ key: 'office', value: 'insurance' }],
  'coworking':    [{ key: 'amenity', value: 'coworking_space' }, { key: 'office', value: 'coworking' }],
  'consultoria':  [{ key: 'office', value: 'consulting' }, { key: 'office', value: 'company' }],
  'ti':           [{ key: 'office', value: 'it' }, { key: 'office', value: 'company' }],
  'tecnologia':   [{ key: 'office', value: 'it' }, { key: 'office', value: 'company' }],
  'arquiteto':    [{ key: 'office', value: 'architect' }],
  'engenharia':   [{ key: 'office', value: 'engineer' }],
  'despachante':  [{ key: 'office', value: 'company' }],
  'cartorio':     [{ key: 'office', value: 'notary' }, { key: 'amenity', value: 'courthouse' }],

  // ===== FINANCEIRO =====
  'banco':        [{ key: 'amenity', value: 'bank' }],
  'bancos':       [{ key: 'amenity', value: 'bank' }],
  'loteria':      [{ key: 'shop', value: 'lottery' }, { key: 'amenity', value: 'bank' }],
  'loterica':     [{ key: 'shop', value: 'lottery' }],
  'caixa eletronico': [{ key: 'amenity', value: 'atm' }],

  // ===== HOSPEDAGEM & TURISMO =====
  'hotel':        [{ key: 'tourism', value: 'hotel' }],
  'hoteis':       [{ key: 'tourism', value: 'hotel' }],
  'pousada':      [{ key: 'tourism', value: 'guest_house' }, { key: 'tourism', value: 'hotel' }],
  'pousadas':     [{ key: 'tourism', value: 'guest_house' }, { key: 'tourism', value: 'hotel' }],
  'hostel':       [{ key: 'tourism', value: 'hostel' }],
  'motel':        [{ key: 'tourism', value: 'motel' }],
  'camping':      [{ key: 'tourism', value: 'camp_site' }],
  'turismo':      [{ key: 'tourism', value: 'information' }, { key: 'shop', value: 'travel_agency' }],
  'agencia de viagem': [{ key: 'shop', value: 'travel_agency' }],

  // ===== ENTRETENIMENTO & CULTURA =====
  'cinema':       [{ key: 'amenity', value: 'cinema' }],
  'teatro':       [{ key: 'amenity', value: 'theatre' }],
  'museu':        [{ key: 'tourism', value: 'museum' }],
  'boliche':      [{ key: 'leisure', value: 'bowling_alley' }],
  'escape room':  [{ key: 'leisure', value: 'escape_game' }],
  'parque':       [{ key: 'leisure', value: 'park' }],
  'boate':        [{ key: 'amenity', value: 'nightclub' }],
  'balada':       [{ key: 'amenity', value: 'nightclub' }],
  'casa noturna': [{ key: 'amenity', value: 'nightclub' }],

  // ===== RELIGIÃO =====
  'igreja':       [{ key: 'amenity', value: 'place_of_worship' }],
  'igrejas':      [{ key: 'amenity', value: 'place_of_worship' }],
  'templo':       [{ key: 'amenity', value: 'place_of_worship' }],
};

/**
 * Etapa 1: Usa o Nominatim para pegar lat/lon da cidade.
 */
async function geocodeCity(city: string, country: string): Promise<{ lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(city + ', ' + country)}` +
    `&format=json&limit=1&accept-language=pt`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'LeadGeneratorApp/1.0' },
  });

  if (!res.ok) throw new Error(`Geocoding falhou (${res.status})`);

  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`Cidade "${city}" não encontrada no mapa.`);
  }

  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

/**
 * Etapa 2: Busca por raio no Overpass. Aceita múltiplas tags para maximizar resultados.
 */
async function searchOverpass(
  lat: number,
  lon: number,
  tags: { key: string; value: string }[]
): Promise<any[]> {
  const radius = 22000;

  // Busca em node (extremamente rápido e leve para não estourar timeout do Overpass)
  const tagFilters = tags.map(t => `node["${t.key}"="${t.value}"]`).join(`;`);
  const query = `[out:json][timeout:25];(${tagFilters.split(';').map(f => `${f}(around:${radius},${lat},${lon})`).join(';')};);out tags 1000;`;
  const body = 'data=' + encodeURIComponent(query);

  const servers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  for (const server of servers) {
    try {
      console.log(`[LeadEngine] Overpass: ${server}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(server, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'LeadMinerApp/2.0 (contact@leadminer.local)'
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) { console.error(`[LeadEngine] ${server} -> ${res.status}`); continue; }

      const data = await res.json();
      const elements = data.elements || [];
      if (elements.length > 0) return elements;
    } catch (err: any) {
      console.error(`[LeadEngine] ${server}: ${err.name === 'AbortError' ? 'Timeout' : err.message}`);
      continue;
    }
  }

  return [];
}

/**
 * Etapa 3 (Fallback): Se a categoria exata não retornou nada, busca estabelecimentos
 * da região e filtra pelo nome contendo a palavra-chave.
 */
async function fallbackNameSearch(lat: number, lon: number, keyword: string): Promise<any[]> {
  const radius = 22000;
  const query = `[out:json][timeout:25];(node["name"~"${keyword}",i](around:${radius},${lat},${lon}););out tags 800;`;
  const body = 'data=' + encodeURIComponent(query);

  const servers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const server of servers) {
    try {
      console.log(`[LeadEngine] Fallback: buscando por nome contendo "${keyword}" em ${server}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(server, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'LeadMinerApp/2.0 (contact@leadminer.local)'
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) continue;

      const data = await res.json();
      return data.elements || [];
    } catch {
      continue;
    }
  }
  return [];
}

export async function scrapeLeads(category: string, city: string, country: string): Promise<Lead[]> {
  const queryCategory = category
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const mapped = categoryMap[queryCategory];
  const tags = mapped || [{ key: 'amenity', value: queryCategory }];

  // PASSO 1: Geocoding
  console.log(`[LeadEngine] Geocoding: ${city}, ${country}...`);
  const coords = await geocodeCity(city, country);
  console.log(`[LeadEngine] Coordenadas: ${coords.lat}, ${coords.lon}`);

  // PASSO 2: Busca por tags do OSM
  console.log(`[LeadEngine] Buscando ${tags.map(t => `${t.key}=${t.value}`).join(' | ')} em raio de 25km...`);
  let elements = await searchOverpass(coords.lat, coords.lon, tags);

  // PASSO 3: Se não achou resultados pela tag, tenta buscar pelo NOME
  if (elements.length === 0) {
    console.log(`[LeadEngine] Nenhum resultado por tag. Tentando fallback por nome...`);
    elements = await fallbackNameSearch(coords.lat, coords.lon, category);
  }

  if (elements.length === 0) return [];

  console.log(`[LeadEngine] Encontrados ${elements.length} elementos brutos.`);

  // PASSO 4: Formata os dados
  const leads: Lead[] = elements
    .map((el: any) => {
      const t = el.tags || {};
      // Prioriza tags de contato direto e WhatsApp móvel
      let phone = t['contact:whatsapp'] || t['whatsapp'] || t['contact:mobile'] || t['mobile'] || t['phone:mobile'] || undefined;
      if (!phone || !isLikelyMobilePhone(phone)) {
        const generalPhone = t['contact:phone'] || t.phone || undefined;
        if (generalPhone && isLikelyMobilePhone(generalPhone)) {
          phone = generalPhone;
        }
      }
      const website = t['contact:website'] || t.website || t.url || undefined;

      // Resgata WhatsApp direto de links wa.me se presentes no website se ainda sem celular válido
      if ((!phone || !isLikelyMobilePhone(phone)) && website && /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/i.test(website)) {
        const match = website.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/i);
        if (match && match[1]) phone = '+' + match[1];
      }

      return {
        id: String(el.id),
        name: t.name || null,
        category,
        city,
        country,
        website,
        instagram: t['contact:instagram'] || t.instagram || undefined,
        whatsapp: phone,
      };
    })
    .filter((l: Lead) => l.name !== null);

  // ESTRATÉGIA: Prioriza leads SEM website (oportunidade) + COM contato
  const withContact = leads.filter((l: Lead) => l.whatsapp || l.instagram);
  const withoutContact = leads.filter((l: Lead) => !l.whatsapp && !l.instagram);

  // Ordena cada grupo: sem site primeiro
  const sortByOpportunity = (a: Lead, b: Lead) => {
    const scoreA = (!a.website ? 10 : 0) + (a.whatsapp ? 3 : 0) + (a.instagram ? 1 : 0);
    const scoreB = (!b.website ? 10 : 0) + (b.whatsapp ? 3 : 0) + (b.instagram ? 1 : 0);
    return scoreB - scoreA;
  };

  withContact.sort(sortByOpportunity);
  withoutContact.sort(sortByOpportunity);

  // Junta: primeiro os com contato, depois os sem (para não ficar vazio se não tem contato)
  const result = [...withContact, ...withoutContact];

  return result;
}
