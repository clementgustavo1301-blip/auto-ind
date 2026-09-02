/**
 * Serviço de descoberta de CNPJ via OSINT (Open-Source Intelligence)
 * Utiliza o Google Search para encontrar o CNPJ de uma empresa pelo nome.
 */

export async function discoverCnpjViaSearch(companyName: string, city: string, state: string, country: string): Promise<string | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  // Busca focada em diretórios de empresas e Receita
  const query = `"${companyName}" ${city} ${state} ${country} CNPJ`;
  
  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('hl', 'pt-br');
    url.searchParams.set('gl', 'br');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('num', '5'); // Apenas os 5 primeiros resultados são suficientes

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.organic_results || [];

    // Tentar encontrar um CNPJ válido nos snippets de texto dos resultados
    for (const result of results) {
      const textToSearch = `${result.title || ''} ${result.snippet || ''}`;
      
      // Regex para encontrar CNPJ com ou sem pontuação (14 dígitos)
      // Formato: 00.000.000/0001-00 ou 00000000000100
      const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
      const matches = textToSearch.match(cnpjRegex);
      
      if (matches && matches.length > 0) {
        // Pega o primeiro match válido
        const possibleCnpj = matches[0].replace(/\D/g, ''); // Limpa tudo que não é número
        if (possibleCnpj.length === 14) {
          return possibleCnpj;
        }
      }
    }
  } catch (error) {
    console.error('Erro ao buscar CNPJ via OSINT:', error);
  }

  return null;
}
