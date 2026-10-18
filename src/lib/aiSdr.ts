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
import { sendWhatsAppMessage, getWhatsAppInbound, clearWhatsAppInbound } from './whatsapp';
import { toDialablePhone, isSamePhone, cleanPhoneDigits } from './phone';
import { supabase } from './supabase';

interface AIQualificationResult {
  replyMessage: string;
  interestLevel: InterestLevel;
  qualificationStatus: AutomationLeadStatus;
  notes: string;
  shouldNotifyHuman: boolean;
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
        replyMessage: `Perfeito! Nós fornecemos sal industrial direto com entrega programada e laudo técnico. Qual a estimativa de consumo mensal ou tipo de sal (grosso, moído ou refinado) que a ${lead.company_name} mais consome? Nosso consultor comercial já vai formalizar a tabela para vocês.`,
        interestLevel: 'high',
        qualificationStatus: 'qualified',
        notes: `Lead declarou interesse explícito em cotação/produtos: "${incomingText.slice(0, 100)}"`,
        shouldNotifyHuman: true
      };
    }
    return {
      replyMessage: `Perfeito! Nós desenvolvemos sites institucionais de alta conversão, sistemas sob medida e estratégias de SEO para o Google e IAs. Vocês já têm um site que gostariam de modernizar ou seria um projeto novo para a ${lead.company_name}? O Gustavo pode preparar uma prévia de proposta personalizada para vocês.`,
      interestLevel: 'high',
      qualificationStatus: 'qualified',
      notes: `Lead declarou interesse explícito em serviços: "${incomingText.slice(0, 100)}"`,
      shouldNotifyHuman: true
    };
  }

  // 3. Qualquer outra mensagem (saudações, "sim", "teste", dúvidas) permanece ESTRITAMENTE em 'chatting' (NUNCA qualifica antecipadamente)
  if (profile === 'sergio') {
    return {
      replyMessage: `Olá! Somos fornecedores especializados em sal industrial (grosso, moído, refinado e micronizado) para indústrias e tratamento. Vocês utilizam sal na operação da ${lead.company_name}?`,
      interestLevel: 'medium',
      qualificationStatus: 'chatting',
      notes: `Mensagem em conversa: "${incomingText.slice(0, 80)}"`,
      shouldNotifyHuman: false
    };
  }

  return {
    replyMessage: `Olá! O Gustavo lidera um studio especializado em criação de sites institucionais de alta conversão, sistemas web sob medida, branding e estratégias para empresas serem recomendadas no Google e em ferramentas de IA. Gostariam de uma análise rápida da presença digital da ${lead.company_name}?`,
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

REGRAS OBRIGATÓRIAS E RESTRITAS DE STATUS (SIGA COM RIGOR ABSOLUTO):
1. "qualified": Atribua "qualified" (e interestLevel "high") EXCLUSIVAMENTE se o lead declarou EXPRESSAMENTE que TEM INTERESSE (ex: "tenho interesse", "quero saber mais", "pode mandar uma proposta", "quanto custa?", "me envia a cotação/tabela").
2. "disqualified": Atribua "disqualified" (e interestLevel "none") se o lead disse que NÃO TEM INTERESSE, que não quer, que já tem fornecedor/site/equipe ou pediu para retirar. A resposta da IA deve ser breve, cordial e agradecendo pelo tempo.
3. "chatting": Para QUALQUER outra resposta (como "sim", "olá", "bom dia", "teste", "quem é?", "como funciona?"), o status DEVE ser estritamente "chatting" (interestLevel "medium"). NUNCA qualifique antes do lead declarar interesse explícito!

Responda em formato estritamente JSON:
{
  "replyMessage": "Sua resposta amigável, curta e direta (máximo 2 a 3 frases em português brasileiro).",
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
  incomingText: string
): Promise<{
  success: boolean;
  replied: boolean;
  lead?: AutomationLead;
  qualification?: AIQualificationResult;
}> {
  const cleanIncoming = cleanPhoneDigits(rawPhone);
  const normalizedPhone = toDialablePhone(rawPhone);
  const trimmedText = (incomingText || '').trim();

  // Deduplicação em janela de 15 segundos para evitar que Webhook e Polling executem a mesma mensagem
  const dedupKey = `${cleanIncoming}:${trimmedText.toLowerCase()}`;
  const lastSeen = recentInboundSignatures.get(dedupKey) || 0;
  if (Date.now() - lastSeen < 15000) {
    return { success: true, replied: false };
  }
  recentInboundSignatures.set(dedupKey, Date.now());

  const leads = await getAutomationLeads();
  
  // Localiza o lead usando comparação inteligente de número
  const lead = leads.find(l => isSamePhone(l.phone, rawPhone));
  const targetPhone = lead ? lead.phone : normalizedPhone;
  const nowIso = new Date().toISOString();

  // Registra mensagem recebida no histórico
  await addAutomationMessage(targetPhone, 'inbound', 'lead', trimmedText);

  // Se o lead não existir no pipeline de automação, cria um registro persistido
  let currentLead: AutomationLead = lead || {
    id: randomUUID(),
    company_name: `Lead WhatsApp (+${cleanIncoming})`,
    phone: targetPhone,
    city: 'Brasil',
    state: 'BR',
    segment: 'Indústria / Geral',
    source: 'inbound_whatsapp',
    status: 'chatting',
    interest_level: 'unknown',
    human_takeover: false,
    last_reply_at: nowIso,
    created_at: nowIso
  };

  if (!lead && supabase) {
    try {
      await supabase.from('automation_leads').insert([currentLead]);
    } catch (insertErr) {
      console.warn('[AI SDR] Falha ao criar novo lead recebido no Supabase:', insertErr);
    }
  }

  // Se o operador humano já assumiu a conversa, a IA NÃO deve responder automaticamente
  if (currentLead.human_takeover) {
    await updateAutomationLead(targetPhone, {
      last_reply_at: nowIso,
      status: 'chatting'
    });
    await addAutomationLog('reply', `💬 Resposta recebida de ${currentLead.company_name} (Operador no controle - IA não respondeu): "${trimmedText}"`, targetPhone);
    return { success: true, replied: false, lead: currentLead };
  }

  // 🛡️ Se o contato JÁ ESTÁ desqualificado, a IA NÃO deve enviar novas mensagens
  if (currentLead.status === 'disqualified') {
    await updateAutomationLead(targetPhone, {
      last_reply_at: nowIso
    });
    await addAutomationLog('reply', `💬 Mensagem de contato desqualificado (${currentLead.company_name}): "${trimmedText.slice(0, 80)}" (IA não responde contatos desqualificados)`, targetPhone);
    return { success: true, replied: false, lead: currentLead };
  }

  const settings = await getAutomationSettings();
  const history = await getAutomationMessages(targetPhone);

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
  const lastReplyTime = lastAiReplyTimestampByPhone.get(cleanIncoming) || 0;
  const isWithinCooldown = (Date.now() - lastReplyTime) < 8000; // Cooldown de 8s para evitar chamadas concorrentes duplicadas

  if (analysis.replyMessage && !isWithinCooldown) {
    lastAiReplyTimestampByPhone.set(cleanIncoming, Date.now());
    try {
      const sendRes = await sendWhatsAppMessage({
        phone: targetPhone,
        message: analysis.replyMessage,
        is_reply: true
      });
      if (sendRes.success || sendRes.queued) {
        await addAutomationMessage(targetPhone, 'outbound', 'ai', analysis.replyMessage);
        await addAutomationLog('dispatch', `🤖 IA SDR respondeu para ${currentLead.company_name}: "${analysis.replyMessage.slice(0, 80)}..."`, targetPhone);
      } else {
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
      await processIncomingWhatsAppMessage(item.phone, item.message);
      processedCount++;
    }
  } catch (err) {
    console.warn('[AI SDR Polling] Erro ao sincronizar /api/inbound:', err);
  } finally {
    g.__isSyncingInbound = false;
  }

  return processedCount;
}

