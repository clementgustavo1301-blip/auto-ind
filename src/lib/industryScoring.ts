import { ConsumptionPotential, IndustrialLead } from '../types';

interface ScoreResult {
  score: number;
  potential: ConsumptionPotential;
  justification: string;
}

const SALT_POTENTIAL_KEYWORDS = {
  high: [
    'tratamento de água', 'estação de tratamento', 'eta', 'abrandamento', 'troca iônica',
    'resina', 'regeneração de resinas', 'cloro', 'hipoclorito', 'petroquímica',
    'química', 'produtos químicos', 'perfuração', 'petróleo e gás', 'salina',
    'frigorífico', 'processamento de carnes', 'pescados', 'curtume', 'couro',
    'saneamento', 'produção de cloro', 'produtos de limpeza', 'detergentes', 'sabões'
  ],
  medium: [
    'têxtil', 'conservação de alimentos', 'laticínios', 'farmacêutica', 'cosméticos',
    'papel e celulose', 'plásticos', 'borracha', 'vidro', 'metalúrgica', 'mineração',
    'fertilizantes', 'ração animal', 'biodiesel', 'biocombustíveis', 'usina',
    'indústria alimentícia'
  ],
  low: [
    'distribuidor', 'atacado', 'supermercado', 'restaurante', 'varejo', 'comércio',
    'embalagens', 'transporte', 'logística', 'higiene'
  ]
};

const NEGATIVE_KEYWORDS = [
  'beleza', 'cabelo', 'estética', 'salão', 'manicure', 'spa', 'restaurante', 'lanchonete',
  'padaria', 'doceria', 'sorveteria', 'barbearia', 'roupas', 'boutique', 'mercado', 'supermercado',
  'varejo', 'distribuidor', 'representação'
];

export function calculateIndustryScore(
  name: string,
  category: string,
  snippet: string = '',
  selectedSegments: string[] = [],
  cnaeDescricao: string = ''
): ScoreResult {
  const textToAnalyze = `${name} ${category} ${snippet} ${selectedSegments.join(' ')} ${cnaeDescricao}`.toLowerCase();

  // Se contém muitas palavras negativas, joga o score lá pra baixo.
  const hasNegative = NEGATIVE_KEYWORDS.some(kw => textToAnalyze.includes(kw));
  if (hasNegative) {
    return {
      score: 10,
      potential: 'Baixo',
      justification: 'Atividade comercial (varejo, serviços ou alimentação local) com uso de sal possivelmente restrito ao consumo final ou estético.'
    };
  }

  let baseScore = 0;
  let matchesHigh = 0;
  let matchesMedium = 0;

  // Analisa High
  for (const kw of SALT_POTENTIAL_KEYWORDS.high) {
    if (textToAnalyze.includes(kw)) {
      baseScore += 35;
      matchesHigh++;
    }
  }

  // Analisa Medium
  for (const kw of SALT_POTENTIAL_KEYWORDS.medium) {
    if (textToAnalyze.includes(kw)) {
      baseScore += 20;
      matchesMedium++;
    }
  }

  // Analisa Low
  for (const kw of SALT_POTENTIAL_KEYWORDS.low) {
    if (textToAnalyze.includes(kw)) {
      baseScore += 10;
    }
  }

  // Cap do score
  let score = Math.min(100, baseScore);

  // Se o CNAE indicou forte perfil industrial, garantir bump de score
  if (cnaeDescricao) {
    const cnae = cnaeDescricao.toLowerCase();
    if (cnae.includes('fabricação') || cnae.includes('indústria') || cnae.includes('tratamento de água') || cnae.includes('frigorífico') || cnae.includes('químic')) {
      score = Math.max(score, 80); // Se a Receita diz que é fábrica, o potencial base sobe.
    }
  }

  // Se o usuário selecionou especificamente o segmento e não teve match orgânico, dá um bump
  if (score === 0 && selectedSegments.length > 0) {
    score = 40;
  }

  let potential: ConsumptionPotential = 'Desconhecido';
  let justification = 'Sem informações suficientes para classificar o uso industrial de sal.';

  if (score >= 75) {
    potential = 'Alto';
    justification = 'Empresa com processos industriais (ex: químicos, tratamento de água, petroquímica, frigorífico) que demandam uso intensivo de sal ou derivados.';
  } else if (score >= 50) {
    potential = 'Médio';
    justification = 'Indústria de transformação ou setor cujas formulações/processos podem utilizar sal (ex: têxtil, alimentícia, cosmética) em etapas específicas.';
  } else if (score >= 25) {
    potential = 'Baixo';
    justification = 'Empresa com relação possível, mas cuja dependência de sal industrial em larga escala não é evidente na atividade principal.';
  } else {
    potential = 'Baixo'; // score < 25
    justification = 'Baixa relevância encontrada para o perfil de consumo de sal industrial em larga escala.';
  }

  return { score, potential, justification };
}

// Helper para sugerir tipo e aplicação de sal baseado no segmento/snippet
export function guessSaltDetails(text: string): { applications: string[], types: string[] } {
  const applications = new Set<string>();
  const types = new Set<string>();
  const t = text.toLowerCase();

  if (t.includes('água') || t.includes('eta') || t.includes('abrandamento') || t.includes('resina')) {
    applications.add('Regeneração de sistemas de abrandamento de água');
    applications.add('Tratamento de água');
    types.add('Sal para tratamento de água');
    types.add('Sal grosso industrial');
  }
  
  if (t.includes('químic') || t.includes('cloro') || t.includes('hipoclorito')) {
    applications.add('Processos químicos');
    applications.add('Produção de cloro/hipoclorito');
    types.add('Sal para processos químicos');
    types.add('Cloreto de sódio industrial');
  }

  if (t.includes('petróleo') || t.includes('gás') || t.includes('perfuração') || t.includes('drilling')) {
    applications.add('Perfuração de poços');
    applications.add('Fluidos de perfuração');
    types.add('Sal grosso industrial');
    types.add('Sal industrial');
  }

  if (t.includes('alimento') || t.includes('carne') || t.includes('frigorífico') || t.includes('pescado')) {
    applications.add('Processamento de alimentos');
    applications.add('Conservação');
    types.add('Sal refinado industrial');
    types.add('Sal grosso industrial');
  }

  if (t.includes('têxtil') || t.includes('tecido') || t.includes('curtume') || t.includes('couro')) {
    applications.add('Indústria têxtil / Curtimento');
    types.add('Sal industrial');
    types.add('Sal grosso industrial');
  }

  if (applications.size === 0) {
    applications.add('Processos industriais diversos');
    types.add('Sal industrial');
  }

  return { applications: Array.from(applications), types: Array.from(types) };
}
