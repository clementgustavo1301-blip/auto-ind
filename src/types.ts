export interface Lead {
  id: string;
  name: string;
  category: string;
  city: string;
  country: string;
  website?: string;
  instagram?: string;
  whatsapp?: string;
}

export type ConsumptionPotential = 'Alto' | 'Médio' | 'Baixo' | 'Desconhecido';

export interface IndustrialLead extends Lead {
  state?: string;
  cnpj?: string;
  razaoSocial?: string;
  cnae?: string;
  cnaesSecundarios?: string[];
  porteReceita?: string;
  capitalSocial?: number;
  companySize?: string;
  mainActivity?: string; // atividade principal ou segmento identificado
  expectedApplications: string[]; // Aplicação provável do sal
  expectedSaltTypes: string[]; // Tipo de sal potencialmente utilizado
  consumptionPotential: ConsumptionPotential;
  score: number; // 0 a 100
  justification: string; // Exemplo: “Empresa do setor de tratamento de água, com processos que podem utilizar sal...”
}
