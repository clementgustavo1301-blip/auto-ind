import { randomUUID } from 'crypto';
import { 
  AutomationLead, 
  AutomationMessage, 
  AutomationSettings, 
  InterestLevel, 
  AutomationLeadStatus 
} from '@/types';
import { 
  getAutomationSettings, 
  getAutomationMessages, 
  addAutomationMessage, 
  updateAutomationLead, 
  addAutomationLog,
  getAutomationLeads
} from './automation';
import { sendWhatsAppMessage, sendWhatsAppHumanBubbles, getWhatsAppInbound, clearWhatsAppInbound } from './whatsapp';
import { toDialablePhone, isSamePhone, cleanPhoneDigits, isWhatsAppGroup } from './phone';
import { isBlacklistedPhone } from './phoneBlacklist';
import { supabase } from './supabase';
import { notifyLeadQualified } from './pushNotifications';

interface AIQualificationResult {
  replyMessage: string;
  interestLevel: InterestLevel;
  qualificationStatus: AutomationLeadStatus;
  notes: string;
  shouldNotifyHuman: boolean;
}

/**
 * Normaliza texto removendo acentos, pontuação e espaços extras
 */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-.,!?;:()_—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se o lead enviou uma mensagem de agradecimento ou confirmação cordial
 * (ex: "obrigado", "valeu", "ok", "perfeito", "combinado", "aguardo", "ate", etc.)
 */
export function isThankYouOrPoliteClosing(text: string): boolean {
  if (!text) return false;
  const t = normalizeText(text);

  const politeTokens = [
    'obrigado', 'obrigada', 'obg', 'valeu', 'vlw', 'show', 'show de bola',
    'perfeito', 'combinado', 'combinados', 'blz', 'beleza', 'ok', 'okk', 'okay',
    'certo', 'tks', 'thanks', 'thx', 'agradeco', 'agradecemos',
    'otimo', 'ta bom', 'tabom', 'ta certo', 'tudo bem',
    'aguardo', 'no aguardo', 'maravilha', 'muito obrigado', 'muito obrigada',
    'fechado', 'tranquilo', 'disponha', 'abraco', 'forte abraco',
    'ate breve', 'ate logo', 'ate mais', 'ate', 'tmj', 'top'
  ];

  if (politeTokens.includes(t)) return true;

  if (t.length <= 50 && politeTokens.some(token => t === token || t.startsWith(token + ' ') || t.endsWith(' ' + token) || t.includes(' ' + token + ' '))) {
    return true;
  }

  return false;
}

/**
 * Verifica se em mensagens anteriores enviadas ao lead já foi prometido que o Gustavo (ou consultor) entrará em contato
 */
export function checkAlreadyPromisedContact(history: AutomationMessage[]): boolean {
  return history.some(m => {
    if (m.direction !== 'outbound') return false;
    const text = normalizeText(m.content);
    const hasName = text.includes('gustavo') || text.includes('consultor') || text.includes('especialista');
    const hasContactAction =
      text.includes('contato') ||
      text.includes('falar') ||
      text.includes('falara') ||
      text.includes('chama') ||
      text.includes('chamar') ||
      text.includes('chamara') ||
      text.includes('proposta') ||
      text.includes('preparar') ||
      text.includes('preparando') ||
      text.includes('apresentar') ||
      text.includes('tabela') ||
      text.includes('formalizar') ||
      text.includes('repassei') ||
      text.includes('repassar') ||
      text.includes('analise detalhada');
    return hasName && hasContactAction;
  });
}

/**
 * Verifica se a mensagem cordial final de despedida / handoff já foi enviada após a promessa de contato
 */
export function checkAlreadySentCordialClosing(history: AutomationMessage[]): boolean {
  let promisedIndex = -1;
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (m.direction === 'outbound' && checkAlreadyPromisedContact([m])) {
      promisedIndex = i;
      break;
    }
  }
  if (promisedIndex === -1) return false;

  // Se após a primeira promessa de contato do Gustavo já foi enviada QUALQUER resposta da IA/SDR
  const messagesAfterPromise = history.slice(promisedIndex + 1);
  return messagesAfterPromise.some(m => m.direction === 'outbound');
}

/**
 * Motor de Análise Heurística (Executa quando o usuário ainda não adicionou API Key da IA)
 */
function analyzeHeuristic(
  lead: AutomationLead,
  incomingText: string,
  history: AutomationMessage[],
  profile: 'gustavo' | 'sergio' = 'gustavo'
): AIQualificationResult {
  const text = incomingText.toLowerCase();

  // 1. Padrões de Rejeição / Desinteresse (Desqualifica)
  const rejectionPatterns = [
    'não temos interesse', 'nao temos interesse',
    'não tenho interesse', 'nao tenho interesse',
    'sem interesse', 'não quero', 'nao quero',
    'não usamos', 'nao usamos', 'não utilizamos', 'nao utilizamos',
    'já temos fornecedor', 'ja temos fornecedor',
    'já temos site', 'ja temos site', 'já temos equipe', 'ja temos equipe',
    'já temos', 'ja temos', 'favor retirar', 'retirar meu número', 'retire meu numero',
    'número errado', 'numero errado', 'engano', 'não obrigado', 'nao obrigado',
    'não preciso', 'nao preciso', 'pare de mandar', 'não mande mais'
  ];

  for (const pattern of rejectionPatterns) {
    if (text.includes(pattern)) {
      return {
        replyMessage: 'Entendido! Agradeço pelo retorno e desejo muito sucesso para a equipe.',
        interestLevel: 'none',
        qualificationStatus: 'disqualified',
        notes: `Lead informou não ter interesse: "${incomingText.slice(0, 100)}"`,
        shouldNotifyHuman: false
      };
    }
  }

  // 1.1 Regra de Handoff e Encerramento: se a IA já prometeu o contato e o lead agradece
  const alreadyPromisedContact = checkAlreadyPromisedContact(history);
  if (alreadyPromisedContact && isThankYouOrPoliteClosing(incomingText)) {
    return {
      replyMessage: profile === 'sergio'
        ? 'Por nada!\n\nEm breve nosso consultor comercial fala com você. Tenha um excelente dia! 😊'
        : 'Por nada!\n\nEm breve o Gustavo fala com você. Tenha um excelente dia! 😊',
      interestLevel: 'high',
      qualificationStatus: 'qualified',
      notes: 'Lead agradeceu após confirmação de contato. Atendimento transferido definitivamente para o humano.',
      shouldNotifyHuman: true
    };
  }

  // 1.2 Pergunta sobre localização ("de onde você é?", "qual cidade?", "onde ficam?") -> informa Mossoró - RN APENAS porque perguntaram
  const normIncoming = normalizeText(incomingText);
  const locationPatterns = [
    'de onde voce e', 'de onde voces sao', 'voces sao de onde', 'voce e de onde',
    'qual cidade voce', 'qual cidade voces', 'qual sua cidade', 'qual a cidade de voces',
    'onde fica a empresa', 'onde voces ficam', 'fica onde', 'ficam onde',
    'voce fala de onde', 'voces falam de onde', 'sao daqui', 'e daqui de', 'qual estado'
  ];
  if (locationPatterns.some(p => normIncoming.includes(p))) {
    if (profile === 'sergio') {
      return {
        replyMessage: `Nós somos de Mossoró - RN, maior polo salineiro do Brasil, e atendemos indústrias de todo o país.\n\nVocês utilizam sal industrial na operação da ${lead.company_name}?`,
        interestLevel: 'medium',
        qualificationStatus: 'chatting',
        notes: 'Lead perguntou a localização; informado Mossoró - RN.',
        shouldNotifyHuman: false
      };
    }
    return {
      replyMessage: `Nós somos de Mossoró - RN e atendemos empresas de todo o Brasil de forma 100% digital.\n\nHoje a ${lead.company_name} já conta com um site atualizado ou buscam ampliar a captação de clientes pelo Google e IAs?`,
      interestLevel: 'medium',
      qualificationStatus: 'chatting',
      notes: 'Lead perguntou a localização; informado Mossoró - RN.',
      shouldNotifyHuman: false
    };
  }

  // 2. Padrões de Interesse Explícito (Qualifica APENAS se disser claramente que tem interesse ou solicitar cotação/proposta)
  const explicitInterestPatterns = [
    'tenho interesse', 'temos interesse', 'tenho sim', 'temos sim',
    'quero saber mais', 'quero entender mais', 'quero proposta', 'quero cotacao', 'quero cotação',
    'me manda a tabela', 'manda a tabela', 'envia a tabela', 'pode mandar a tabela',
    'quanto custa', 'qual o valor', 'qual o preco', 'qual o preço',
    'gostaria de uma cotacao', 'gostaria de uma cotação', 'pode mandar', 'pode enviar',
    'solicito orcamento', 'solicito orçamento', 'me liga', 'pode ligar', 'orçamento', 'orcamento'
  ];

  let hasExplicitInterest = false;
  for (const pattern of explicitInterestPatterns) {
    if (text.includes(pattern)) {
      hasExplicitInterest = true;
      break;
    }
  }

  if (hasExplicitInterest) {
    if (profile === 'sergio') {
      return {
        replyMessage: `Perfeito!\n\nNós fornecemos sal industrial direto com entrega programada e laudo técnico.\n\nQual a estimativa de consumo mensal ou tipo de sal (grosso, moído ou refinado) que a ${lead.company_name} mais consome? Nosso consultor já vai formalizar a tabela para vocês.`,
        interestLevel: 'high',
        qualificationStatus: 'qualified',
        notes: `Lead declarou interesse explícito em cotação/produtos: "${incomingText.slice(0, 100)}"`,
        shouldNotifyHuman: true
      };
    }
    return {
      replyMessage: `Perfeito!\n\nNós desenvolvemos sites institucionais de alta conversão, sistemas sob medida e estratégias de SEO para o Google e IAs.\n\nVocês já têm um site que gostariam de modernizar ou seria um projeto novo para a ${lead.company_name}? O Gustavo pode preparar uma prévia de proposta personalizada para vocês.`,
      interestLevel: 'high',
      qualificationStatus: 'qualified',
      notes: `Lead declarou interesse explícito em serviços: "${incomingText.slice(0, 100)}"`,
      shouldNotifyHuman: true
    };
  }

  // 3. Qualquer outra mensagem (saudações, "sim", "teste", dúvidas) permanece ESTRITAMENTE em 'chatting' (NUNCA qualifica antecipadamente)
  if (profile === 'sergio') {
    return {
      replyMessage: `Olá, tudo bem?\n\nSomos fornecedores especializados em sal industrial (grosso, moído, refinado e micronizado) para indústrias e tratamento.\n\nVocês utilizam sal na operação da ${lead.company_name}?`,
      interestLevel: 'medium',
      qualificationStatus: 'chatting',
      notes: `Mensagem em conversa: "${incomingText.slice(0, 80)}"`,
      shouldNotifyHuman: false
    };
  }

  return {
    replyMessage: `Olá, tudo bem?\n\nO Gustavo lidera um studio especializado em criação de sites de alta conversão, sistemas web sob medida e estratégias para empresas serem recomendadas no Google e em ferramentas de IA.\n\nGostariam de uma análise rápida da presença digital da ${lead.company_name}?`,
    interestLevel: 'medium',
    qualificationStatus: 'chatting',
    notes: `Mensagem em conversa: "${incomingText.slice(0, 80)}"`,
    shouldNotifyHuman: false
  };
}

/**
 * Executa chamada à API de IA (Google Gemini ou OpenAI) caso a chave esteja presente
 */
async function callLLM(
  settings: AutomationSettings,
  lead: AutomationLead,
  incomingText: string,
  history: AutomationMessage[]
): Promise<AIQualificationResult | null> {
  const apiKey = settings.ai_api_key || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const formattedHistory = history.map(m => `${m.sender === 'lead' ? 'Lead' : 'SDR'}: ${m.content}`).join('\n');
    
    const systemPrompt = `
${settings.ai_prompt || 'Você é o SDR da distribuidora de sal industrial LeadCore.'}
Dados da Empresa do Lead:
- Nome: ${lead.company_name}
- Cidade: ${lead.city}
- Segmento: ${lead.segment}

Histórico da conversa até agora:
${formattedHistory}

Última mensagem enviada pelo lead:
"${incomingText}"

REGRAS DE VERACIDADE E LOCALIZAÇÃO (RIGOR ABSOLUTO - NÃO INVENTE NADA):
- PROIBIDO INVENTAR QUALQUER INFORMAÇÃO: NUNCA invente preços, valores, prazos, nomes de clientes atendidos, resultados fictícios, endereços, telefone ou condições que não estão escritos aqui. Se o lead perguntar um preço, prazo ou detalhe específico que você não sabe, diga de forma simples e transparente que o Gustavo (ou nosso consultor) passará essa informação exata em seguida.
- LOCALIZAÇÃO (MOSSORÓ - RN APENAS SE PERGUNTAREM): Você/Gustavo é de Mossoró - RN (e atende empresas de todo o Brasil). Porém, você SÓ deve falar que é de Mossoró - RN SE o lead perguntar explicitamente de onde você é, qual sua cidade ou onde fica a empresa. Se o lead NÃO perguntar de onde você é, NUNCA mencione Mossoró por conta própria.

REGRAS OBRIGATÓRIAS E RESTRITAS DE STATUS (SIGA COM RIGOR ABSOLUTO):
1. "qualified": Atribua "qualified" (e interestLevel "high") EXCLUSIVAMENTE se o lead declarou EXPRESSAMENTE que TEM INTERESSE (ex: "tenho interesse", "quero saber mais", "pode mandar uma proposta", "quanto custa?", "me envia a cotação/tabela").
2. "disqualified": Atribua "disqualified" (e interestLevel "none") se o lead disse que NÃO TEM INTERESSE, que não quer, que já tem fornecedor/site/equipe ou pediu para retirar. A resposta da IA deve ser breve, cordial e agradecendo pelo tempo.
3. "chatting": Para QUALQUER outra resposta (como "sim", "olá", "bom dia", "teste", "quem é?", "como funciona?"), o status DEVE ser estritamente "chatting" (interestLevel "medium"). NUNCA qualifique antes do lead declarar interesse explícito!
4. "handoff": Se no histórico você já avisou que o Gustavo (ou consultor) entrará em contato:
   - Se o lead agradecer ou confirmar (ex: "obrigado", "valeu", "ok", "perfeito", "combinado", "aguardo", "show"):
     Responda apenas com uma cordialidade breve e finalizadora (ex: "Por nada! Em breve o Gustavo fala com você. Tenha um excelente dia! 😊").
     Defina "shouldNotifyHuman": true e "qualificationStatus": "qualified".
   - Se o lead já agradeceu e já recebeu essa resposta cordial final:
     NÃO responda mais nada ("replyMessage": "").

DIRETRIZ DE HUMANIZAÇÃO OBRIGATÓRIA (MENSAGENS CURTAS EM BALÕES SEPARADOS):
- NUNCA envie blocos grandes de texto ou mensagens longas. Mensagens longas parecem robô e diminuem a resposta.
- Divida sempre sua resposta em 2 ou 3 frases curtas, separadas por quebra de linha dupla (\n\n), para serem entregues como balões separados de conversa no WhatsApp.
- Seja informal, amigável e direto como alguém digitando no WhatsApp pelo celular.

Responda em formato estritamente JSON:
{
  "replyMessage": "Sua resposta amigável e curta, dividida em 2 ou 3 frases curtas separadas por \\n\\n para formar balões separados no WhatsApp.",
  "interestLevel": "high" | "medium" | "none" | "unknown",
  "qualificationStatus": "qualified" | "disqualified" | "chatting",
  "notes": "Resumo do que o lead precisa em 1 frase.",
  "shouldNotifyHuman": true/false (true se ele declarou interesse claro e quer proposta ou falar com vendedor)
}
`;

    // 1. Google Gemini (Cascata de Alta Cota: 500 RPD com gemini-3.5-flash-lite e gemini-3.1-flash-lite)
    if (settings.ai_provider === 'gemini' || apiKey.startsWith('AIza') || apiKey.startsWith('AQ') || Boolean(process.env.GEMINI_API_KEY)) {
      const modelsToTry = [
        settings.ai_model || 'gemini-3.5-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-1.5-flash'
      ];
      const uniqueModels = Array.from(new Set(modelsToTry));

      for (const model of uniqueModels) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3
              }
            })
          });

          if (!res.ok) {
            const errorBody = await res.text().catch(() => '');
            console.warn(`[AI SDR] Modelo ${model} retornou ${res.status}: ${errorBody.slice(0, 100)}. Tentando próximo da cascata...`);
            continue;
          }

          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson) as AIQualificationResult;
          }
        } catch (mErr) {
          console.warn(`[AI SDR] Exceção com modelo ${model}:`, mErr);
        }
      }
    }

    // 2. OpenAI (se configurada)
    if (settings.ai_provider === 'openai' || apiKey.startsWith('sk-')) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: settings.ai_model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Responda estritamente em formato JSON.' },
            { role: 'user', content: systemPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return JSON.parse(content) as AIQualificationResult;
        }
      }
    }
  } catch (err) {
    console.warn('[AI SDR] Erro ao consultar LLM, executando fallback heurístico:', err);
  }

  return null;
}

// Controle de deduplicação com persistência em globalThis para sobreviver a re-renderizações e múltiplos workers
const g = global as any;
const recentInboundSignatures: Map<string, number> = (g.__recentInboundSignatures =
  g.__recentInboundSignatures || new Map<string, number>());
const processedInboundIds: Set<string> = (g.__processedInboundIds =
  g.__processedInboundIds || new Set<string>());
const lastAiReplyTimestampByPhone: Map<string, number> = (g.__lastAiReplyTimestampByPhone =
  g.__lastAiReplyTimestampByPhone || new Map<string, number>());

/**
 * Processa uma mensagem recebida do WhatsApp via Webhook ou Polling (/api/inbound)
 */
export async function processIncomingWhatsAppMessage(
  rawPhone: string,
  incomingText: string,
  meta?: {
    pushName?: string;
    senderJid?: string;
    chatJid?: string;
  }
): Promise<{
  success: boolean;
  replied: boolean;
  lead?: AutomationLead;
  qualification?: AIQualificationResult;
}> {
  const cleanIncoming = cleanPhoneDigits(rawPhone);
  const normalizedPhone = toDialablePhone(rawPhone);
  const trimmedText = (incomingText || '').trim();

  // 1. Bloqueio estrito de grupos, comunidades e canais do WhatsApp
  if (isWhatsAppGroup(rawPhone) || isWhatsAppGroup(cleanIncoming) || isWhatsAppGroup(normalizedPhone)) {
    console.log(`[AI SDR] Mensagem de grupo do WhatsApp ignorada (${rawPhone}). A IA não participa de grupos.`);
    return { success: true, replied: false };
  }

  // 2. Bloqueio permanente de contatos excluídos do pipeline
  if (isBlacklistedPhone(rawPhone) || isBlacklistedPhone(cleanIncoming) || isBlacklistedPhone(normalizedPhone)) {
    console.log(`[AI SDR] Mensagem recebida de contato excluído/bloqueado (${rawPhone}). Ignorando silenciosamente.`);
    return { success: true, replied: false };
  }

  const leads = await getAutomationLeads();
  
  // Localiza o lead usando comparação inteligente de número
  let lead = leads.find(l => isSamePhone(l.phone, rawPhone));

  // Fallback 1: se chatJid ou senderJid trouxer o telefone
  if (!lead && meta?.chatJid && !meta.chatJid.includes('@lid')) {
    lead = leads.find(l => isSamePhone(l.phone, meta.chatJid!));
  }
  if (!lead && meta?.senderJid && !meta.senderJid.includes('@lid')) {
    lead = leads.find(l => isSamePhone(l.phone, meta.senderJid!));
  }

  // Fallback 2: se veio de um @lid do WhatsApp Multi-Device, verifica correspondência pelo PushName ou pelo lead disparado recentemente
  const isLikelyLid =
    rawPhone.includes('@lid') ||
    Boolean(meta?.senderJid?.includes('@lid')) ||
    Boolean(meta?.chatJid?.includes('@lid')) ||
    cleanIncoming.length >= 14;

  if (!lead && meta?.pushName) {
    const normPush = normalizeText(meta.pushName);
    if (normPush.length >= 3) {
      lead = leads.find(l => {
        if (l.status === 'pending' || isBlacklistedPhone(l.phone)) return false;
        const normCompany = normalizeText(l.company_name);
        return normCompany === normPush || normCompany.includes(normPush) || normPush.includes(normCompany);
      });
    }
  }

  if (!lead && isLikelyLid) {
    // Busca leads ativos que receberam disparo nas últimas 12 horas
    const recentActiveLeads = leads
      .filter(l => (l.status === 'sent' || l.status === 'chatting') && Boolean(l.dispatched_at) && !isBlacklistedPhone(l.phone))
      .sort((a, b) => new Date(b.dispatched_at!).getTime() - new Date(a.dispatched_at!).getTime());

    if (recentActiveLeads.length > 0) {
      const mostRecent = recentActiveLeads[0];
      const hoursSinceDispatch = (Date.now() - new Date(mostRecent.dispatched_at!).getTime()) / (1000 * 60 * 60);
      if (hoursSinceDispatch <= 12) {
        console.log(`[AI SDR LID Match] Mensagem @lid (${rawPhone}) vinculada ao lead ativo disparado recentemente: ${mostRecent.company_name} (${mostRecent.phone})`);
        lead = mostRecent;
      }
    }
  }

  // 3. REGRA CRÍTICA: A IA SDR DEVE RESPONDER EXCLUSIVAMENTE A LEADS CADASTRADOS NO PIPELINE!
  // Contatos pessoais, conversas externas, grupos ou contatos que foram excluídos NUNCA são respondidos nem cadastrados.
  if (!lead) {
    console.log(`[AI SDR] Contato ${rawPhone} não é um lead cadastrado no pipeline (ou foi excluído). Mensagem ignorada.`);
    return { success: true, replied: false };
  }

  const canonicalDigits = cleanPhoneDigits(lead.phone) || cleanIncoming;

  // Deduplicação em janela de 15 segundos para evitar que Webhook e Polling executem a mesma mensagem
  const dedupKey = `${canonicalDigits}:${trimmedText.toLowerCase()}`;
  const lastSeen = recentInboundSignatures.get(dedupKey) || 0;
  if (Date.now() - lastSeen < 15000) {
    return { success: true, replied: false };
  }
  recentInboundSignatures.set(dedupKey, Date.now());

  // 4. Se o telefone do lead estiver na lista de exclusão/bloqueio
  if (isBlacklistedPhone(lead.phone)) {
    console.log(`[AI SDR] Lead ${lead.company_name} (${lead.phone}) está na lista de exclusão. Nenhuma resposta será enviada.`);
    return { success: true, replied: false };
  }

  const targetPhone = lead.phone;
  const nowIso = new Date().toISOString();

  // 5. Se o operador humano já assumiu a conversa, a IA NÃO deve responder automaticamente
  if (lead.human_takeover) {
    await addAutomationMessage(targetPhone, 'inbound', 'lead', trimmedText);
    await updateAutomationLead(targetPhone, {
      last_reply_at: nowIso,
      status: 'chatting'
    });
    await addAutomationLog('reply', `💬 Resposta recebida de ${lead.company_name} (Operador no controle - IA não respondeu): "${trimmedText}"`, targetPhone);
    return { success: true, replied: false, lead };
  }

  // 6. 🛡️ Se o contato JÁ ESTÁ desqualificado, a IA NÃO deve enviar novas mensagens
  if (lead.status === 'disqualified' || lead.interest_level === 'none') {
    await addAutomationMessage(targetPhone, 'inbound', 'lead', trimmedText);
    await updateAutomationLead(targetPhone, {
      last_reply_at: nowIso
    });
    await addAutomationLog('reply', `💬 Mensagem de contato desqualificado (${lead.company_name}): "${trimmedText.slice(0, 80)}" (IA não responde contatos desqualificados)`, targetPhone);
    return { success: true, replied: false, lead };
  }

  // Registra mensagem recebida no histórico apenas para leads legítimos e ativos
  await addAutomationMessage(targetPhone, 'inbound', 'lead', trimmedText);

  const currentLead: AutomationLead = lead;

  const settings = await getAutomationSettings();
  const history = await getAutomationMessages(targetPhone);

  // 🛡️ REGRA CRÍTICA DE HANDOFF GUSTAVO / OPERADOR HUMANO:
  // "depois que a ia disser que gustavo vai entrar em contato, se a pessoa agradecer ai ele é cordial e dai em diante ele n responde mais"
  const previousMessages = history.slice(0, -1);
  const alreadyPromisedContact = checkAlreadyPromisedContact(previousMessages);
  const alreadySentCordialClosing = checkAlreadySentCordialClosing(previousMessages);

  if (alreadyPromisedContact) {
    // Caso 1: O lead já havia agradecido e a IA já enviou a resposta cordial de encerramento anteriormente
    // "e dai em diante ele n responde mais" -> Silêncio total da IA e ativa human_takeover!
    if (alreadySentCordialClosing) {
      console.log(`[AI SDR Handoff] Lead ${lead.company_name} já recebeu encerramento cordial. IA silenciada definitivamente para o Gustavo assumir.`);
      await updateAutomationLead(targetPhone, {
        human_takeover: true,
        last_reply_at: nowIso
      });
      await addAutomationLog('reply', `💬 Mensagem recebida de ${lead.company_name}: "${trimmedText.slice(0, 80)}" (Atendimento exclusivo do Gustavo - IA em silêncio)`, targetPhone);
      return {
        success: true,
        replied: false,
        lead: { ...currentLead, human_takeover: true, last_reply_at: nowIso }
      };
    }

    // Caso 2: O lead está agradecendo ou confirmando (ex: "obrigado", "valeu", "ok", "perfeito", "combinado", "aguardo")
    // "se a pessoa agradecer ai ele é cordial e dai em diante ele n responde mais"
    if (isThankYouOrPoliteClosing(trimmedText)) {
      const isSergio = settings.profile === 'sergio';
      const cordialReply = isSergio
        ? 'Por nada! Em breve nosso consultor comercial fala com você. Tenha um excelente dia! 😊'
        : 'Por nada! Em breve o Gustavo fala com você. Tenha um excelente dia! 😊';

      await updateAutomationLead(targetPhone, {
        human_takeover: true, // Bloqueia permanentemente respostas futuras da IA para este lead
        status: 'qualified',
        interest_level: 'high',
        qualification_notes: 'Lead agradeceu após confirmação de contato. Atendimento transferido definitivamente para o Gustavo.',
        last_reply_at: nowIso
      });

      await notifyLeadQualified(
        {
          ...currentLead,
          qualification_notes: `Lead confirmou interesse ("${trimmedText.slice(0, 60)}") e aguarda seu contato!`
        },
        `Lead confirmou ("${trimmedText.slice(0, 60)}") e está pronto para você assumir!`
      ).catch(() => {});

      try {
        const sendRes = await sendWhatsAppHumanBubbles(
          {
            phone: targetPhone,
            message: cordialReply,
            is_reply: true
          },
          async (bubbleText, index, total) => {
            await addAutomationMessage(targetPhone, 'outbound', 'ai', bubbleText);
            await addAutomationLog('dispatch', `🤝 IA foi cordial [${index + 1}/${total}] e transferiu controle para Gustavo: "${bubbleText}"`, targetPhone);
          }
        );
        if (!sendRes.success && !sendRes.queued) {
          console.warn('[AI SDR] Falha ao enviar resposta cordial:', sendRes.message);
        }
      } catch (err: any) {
        console.error('[AI SDR] Erro ao enviar resposta cordial de encerramento:', err);
      }

      return {
        success: true,
        replied: true,
        lead: { ...currentLead, human_takeover: true, status: 'qualified', interest_level: 'high', last_reply_at: nowIso }
      };
    }
  }

  // 1. Tenta qualificação via LLM (se houver chave de IA), senão usa Heurística especializada
  let analysis = await callLLM(settings, currentLead, trimmedText, history);
  if (!analysis) {
    analysis = analyzeHeuristic(currentLead, trimmedText, history, (settings.profile || 'gustavo') as any);
  }

  // 2. Atualiza os dados do lead no banco para "chatting", "qualified" ou "disqualified"
  const updatedStatus = analysis.qualificationStatus || 'chatting';
  await updateAutomationLead(targetPhone, {
    status: updatedStatus,
    interest_level: analysis.interestLevel,
    qualification_notes: analysis.notes,
    last_reply_at: nowIso
  });

  const leadStatusTag = analysis.interestLevel === 'high' ? '🔥 QUALIFICADO' : updatedStatus.toUpperCase();
  await addAutomationLog(
    analysis.interestLevel === 'high' ? 'qualified' : 'reply',
    `💬 Resposta recebida de ${currentLead.company_name} (${targetPhone}): "${trimmedText.slice(0, 80)}". Status: [${leadStatusTag}]`,
    targetPhone
  );

  // 🔔 Se o lead acabou de ser QUALIFICADO (pronto para humano assumir), dispara notificação Push + Pop-up no celular
  if (updatedStatus === 'qualified' || analysis.interestLevel === 'high') {
    await notifyLeadQualified(
      {
        ...currentLead,
        qualification_notes: analysis.notes || `Respondeu: "${trimmedText.slice(0, 70)}"`
      },
      `${analysis.notes || 'Lead qualificado pela IA!'} — Última msg: "${trimmedText.slice(0, 60)}"`
    ).catch(() => {});
  }

  // 🛡️ Se o status for desqualificado, verifica se já enviou mensagem de despedida/encerramento anteriormente
  if (updatedStatus === 'disqualified') {
    const alreadySentClosing = history.some(m => m.direction === 'outbound' && (
      m.content.toLowerCase().includes('agradeço') ||
      m.content.toLowerCase().includes('respeitamos') ||
      m.content.toLowerCase().includes('encerramos') ||
      m.content.toLowerCase().includes('sucesso')
    ));
    if (alreadySentClosing) {
      console.log(`[AI SDR Anti-Spam] Contato ${targetPhone} já recebeu encerramento anteriormente. Nenhuma nova mensagem enviada.`);
      return {
        success: true,
        replied: false,
        lead: { ...currentLead, status: 'disqualified', interest_level: 'none', last_reply_at: nowIso },
        qualification: analysis
      };
    }
  }

  // 3. Envia a resposta automática via WhatsApp Service (com proteção anti-spam para evitar mensagens repetidas em sequência)
  const lastReplyTime = lastAiReplyTimestampByPhone.get(canonicalDigits) || 0;
  const isWithinCooldown = (Date.now() - lastReplyTime) < 8000; // Cooldown de 8s para evitar chamadas concorrentes duplicadas

  if (analysis.replyMessage && !isWithinCooldown) {
    lastAiReplyTimestampByPhone.set(canonicalDigits, Date.now());
    try {
      const sendRes = await sendWhatsAppHumanBubbles(
        {
          phone: targetPhone,
          message: analysis.replyMessage,
          is_reply: true
        },
        async (bubbleText, index, total) => {
          await addAutomationMessage(targetPhone, 'outbound', 'ai', bubbleText);
          await addAutomationLog('dispatch', `🤖 IA SDR enviou balão [${index + 1}/${total}] para ${currentLead.company_name}: "${bubbleText}"`, targetPhone);
        }
      );
      if (!sendRes.success && !sendRes.queued) {
        await addAutomationLog('error', `⚠️ Falha ao enfileirar resposta da IA para ${currentLead.company_name}: ${sendRes.error || sendRes.message}`, targetPhone);
      }
    } catch (e: any) {
      console.error('[AI SDR] Falha ao enviar resposta no WhatsApp:', e);
      await addAutomationLog('error', `⚠️ Erro de conexão ao responder ${currentLead.company_name}: ${e.message}`, targetPhone);
    }
  } else if (analysis.replyMessage && isWithinCooldown) {
    console.log(`[AI SDR Anti-Spam] Resposta suprimida para ${targetPhone}: mensagem recente já enviada há menos de 60s.`);
  }

  return {
    success: true,
    replied: Boolean(analysis.replyMessage && !isWithinCooldown),
    lead: { ...currentLead, status: updatedStatus, interest_level: analysis.interestLevel, last_reply_at: nowIso },
    qualification: analysis
  };
}

/**
 * Sincroniza mensagens recebidas do buffer /api/inbound do microserviço Go (necessário quando o Go roda no Termux/Cloudflare Tunnel)
 */
export async function syncInboundWhatsAppMessages(): Promise<number> {
  if (g.__isSyncingInbound) return 0;
  g.__isSyncingInbound = true;
  let processedCount = 0;

  try {
    const inboundList = await getWhatsAppInbound();
    if (!inboundList || inboundList.length === 0) {
      return 0;
    }

    for (const item of inboundList) {
      if (!item || !item.id || !item.phone || !item.message) continue;
      if (processedInboundIds.has(item.id)) {
        await clearWhatsAppInbound(item.id);
        continue;
      }

      processedInboundIds.add(item.id);
      if (processedInboundIds.size > 500) {
        const firstKey = processedInboundIds.values().next().value;
        if (firstKey) processedInboundIds.delete(firstKey);
      }

      // Limpa IMEDIATAMENTE do buffer para evitar que polling concorrente capture o mesmo item
      await clearWhatsAppInbound(item.id);

      console.log(`[AI SDR Polling] 📩 Nova mensagem detectada via /api/inbound de ${item.phone}: "${item.message}"`);
      await processIncomingWhatsAppMessage(item.phone, item.message, {
        pushName: item.push_name,
        senderJid: item.sender_jid,
        chatJid: item.chat_jid,
      });
      processedCount++;
    }
  } catch (err) {
    console.warn('[AI SDR Polling] Erro ao sincronizar /api/inbound:', err);
  } finally {
    g.__isSyncingInbound = false;
  }

  return processedCount;
}

