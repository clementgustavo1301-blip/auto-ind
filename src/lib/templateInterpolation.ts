/**
 * Utilitário Centralizado de Interpolação de Mensagens
 * Suporta formatos flexíveis: {variavel}, {{variavel}}, { variavel }, {{ variavel }}
 * Tratamento inteligente de saudação baseada no horário comercial
 */

export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export interface InterpolationContext {
  nome?: string;
  primeiro_nome?: string;
  empresa?: string;
  cidade?: string;
  categoria?: string;
  segmento?: string;
  telefone?: string;
  saudacao?: string;
}

/**
 * Interpola variáveis de template suportando tanto chaves simples {tag} quanto duplas {{tag}}
 * com espaçamento opcional e insensível a maiúsculas/minúsculas.
 */
export function interpolateVariables(template: string, ctx: InterpolationContext = {}): string {
  if (!template) return '';

  const saudacao = ctx.saudacao?.trim() || getGreeting();
  
  // Resolução de nome e primeiro nome
  const rawNome = ctx.primeiro_nome || ctx.nome || '';
  const primeiroNome = rawNome ? rawNome.split(' ')[0] : '';
  const empresa = ctx.empresa?.trim() || 'sua empresa';
  const nomeFinal = primeiroNome || rawNome || empresa;

  const cidade = ctx.cidade?.trim() || 'sua região';
  const categoria = ctx.categoria?.trim() || ctx.segmento?.trim() || 'seu setor';
  const telefone = ctx.telefone?.trim() || '';

  // Dicionário de substituições suportando variações de nomes e chaves
  const replacements: Array<{ regex: RegExp; value: string }> = [
    // Saudações
    { regex: /\{{1,2}\s*saudacao\s*\}{1,2}/gi, value: saudacao },
    { regex: /\{{1,2}\s*saudação\s*\}{1,2}/gi, value: saudacao },
    { regex: /\{{1,2}\s*greeting\s*\}{1,2}/gi, value: saudacao },

    // Nome
    { regex: /\{{1,2}\s*primeiro_nome\s*\}{1,2}/gi, value: primeiroNome || empresa },
    { regex: /\{{1,2}\s*primeironome\s*\}{1,2}/gi, value: primeiroNome || empresa },
    { regex: /\{{1,2}\s*nome\s*\}{1,2}/gi, value: nomeFinal },
    { regex: /\{{1,2}\s*name\s*\}{1,2}/gi, value: nomeFinal },

    // Empresa
    { regex: /\{{1,2}\s*empresa\s*\}{1,2}/gi, value: empresa },
    { regex: /\{{1,2}\s*company\s*\}{1,2}/gi, value: empresa },
    { regex: /\{{1,2}\s*razao_social\s*\}{1,2}/gi, value: empresa },
    { regex: /\{{1,2}\s*razaosocial\s*\}{1,2}/gi, value: empresa },

    // Cidade
    { regex: /\{{1,2}\s*cidade\s*\}{1,2}/gi, value: cidade },
    { regex: /\{{1,2}\s*city\s*\}{1,2}/gi, value: cidade },

    // Categoria / Segmento
    { regex: /\{{1,2}\s*categoria\s*\}{1,2}/gi, value: categoria },
    { regex: /\{{1,2}\s*category\s*\}{1,2}/gi, value: categoria },
    { regex: /\{{1,2}\s*segmento\s*\}{1,2}/gi, value: categoria },
    { regex: /\{{1,2}\s*segment\s*\}{1,2}/gi, value: categoria },
    { regex: /\{{1,2}\s*setor\s*\}{1,2}/gi, value: categoria },

    // Telefone
    { regex: /\{{1,2}\s*telefone\s*\}{1,2}/gi, value: telefone },
    { regex: /\{{1,2}\s*phone\s*\}{1,2}/gi, value: telefone },
    { regex: /\{{1,2}\s*whatsapp\s*\}{1,2}/gi, value: telefone },
  ];

  let result = template;
  for (const item of replacements) {
    result = result.replace(item.regex, item.value);
  }

  // Fallback extra caso tenha sobrado alguma tag {saudacao} ou {saudação} com espaços ou acentos
  result = result.replace(/\{{1,2}\s*sauda[cç][aã]o\s*\}{1,2}/gi, saudacao);

  return result;
}

export const TEMPLATE_AVAILABLE_TAGS = [
  { tag: 'saudacao', label: 'Saudação (Bom dia/tarde/noite)', example: 'Bom dia' },
  { tag: 'nome', label: 'Primeiro Nome / Contato', example: 'Carlos' },
  { tag: 'empresa', label: 'Nome da Empresa', example: 'Laticínio Central' },
  { tag: 'cidade', label: 'Cidade do Lead', example: 'Campinas' },
  { tag: 'categoria', label: 'Segmento / Categoria', example: 'Laticínios' },
  { tag: 'telefone', label: 'Telefone do WhatsApp', example: '(19) 99999-8888' },
] as const;
