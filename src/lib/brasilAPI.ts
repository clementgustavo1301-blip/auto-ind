/**
 * Integração com a Brasil API para buscar dados oficiais da Receita Federal
 */

export interface CompanyData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  descricao_situacao_cadastral: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  cnaes_secundarios: { codigo: number; descricao: string }[];
  porte: string;
  descricao_porte: string;
  capital_social: number;
}

export async function fetchCompanyData(cnpj: string): Promise<CompanyData | null> {
  try {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return null;

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, { 
      cache: 'no-store',
      // Um pequeno timeout seria ideal em produção, mas o fetch nativo do Next lida bem
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data as CompanyData;
  } catch (error) {
    console.error(`Erro ao buscar dados na Brasil API para o CNPJ ${cnpj}:`, error);
    return null;
  }
}
