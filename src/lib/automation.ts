import { randomUUID } from 'crypto';
import { supabase } from './supabase';
import { 
  AutomationSettings, 
  AutomationLead, 
  AutomationMessage, 
  AutomationLog, 
  AutomationMetrics,
  AutomationLeadStatus,
  InterestLevel
} from '@/types';
import { scrapeSerpAPI } from './outscraper';
import { filterLeadsWithWhatsApp, toDialablePhone, isSamePhone, cleanPhoneDigits, formatPhoneDisplay, isWhatsAppGroup } from './phone';
import { 
  isBlacklistedPhone, 
  addPhoneToBlacklist, 
  loadBlacklistedPhones, 
  removePhoneFromBlacklist, 
  getBlacklistedPhones 
} from './phoneBlacklist';
import { sendWhatsAppMessage, getWhatsAppQueue, clearWhatsAppQueue } from './whatsapp';
import { interpolateVariables } from './templateInterpolation';

export { 
  isBlacklistedPhone, 
  addPhoneToBlacklist, 
  removePhoneFromBlacklist, 
  getBlacklistedPhones 
};

export interface AutomationProfilePreset {
  id: 'gustavo' | 'sergio';
  name: string;
  tagline: string;
  initial_message_template: string;
  ai_prompt: string;
  target_segments: string[];
  target_cities: string[];
}

export const AUTOMATION_PROFILES: Record<'gustavo' | 'sergio', AutomationProfilePreset> = {
  gustavo: {
    id: 'gustavo',
    name: 'Gustavo // Tech & Design Studio',
    tagline: 'Sites de Alta Conversão, SEO para IAs & Google, Sistemas Sob Medida e Branding',
    initial_message_template: 'Olá, tudo bem? Notei que a {empresa} é uma referência em {segmento} na região de {cidade}. Estava analisando a presença digital de vocês no Google e ferramentas de IA (como ChatGPT e Perplexity) e notei uma oportunidade clara para ampliar a captação de clientes. É você quem cuida dessa parte comercial/digital ou com quem eu poderia falar?',
    ai_prompt: `Você é o assistente comercial e estrategista digital do Gustavo (Studio de Desenvolvimento Web & Branding). Seu objetivo é atender e qualificar leads pelo WhatsApp de forma consultiva, amigável e profissional.

Nossos serviços principais:
1. Sites Institucionais e Landing Pages de Alta Conversão (design moderno, ultra-rápido, otimizado para transformar visitantes em clientes).
2. Otimização para Buscas e IAs (SEO Avançado + GEO - Generative Engine Optimization para ser recomendado pelo ChatGPT, Perplexity e Google).
3. Sistemas Web e Plataformas sob Medida (painéis administrativos, portais, automações e softwares que eliminam planilhas e processos manuais).
4. Branding e Identidade Visual Completa (logotipos, manuais de marca e identidade corporativa de alto padrão).

Diretrizes de Comunicação:
- Seja cordial, objetivo e conciso (máximo 2 a 3 frases por resposta).
- Entenda a necessidade da empresa (se o site atual está desatualizado, se precisam de mais clientes ou se buscam um sistema para automatizar operações).
- Quando o lead demonstrar interesse ou pedir orçamento/demonstração de portfólio, classifique-o como qualificado (interesse alto) e avise que o Gustavo entrará em contato para apresentar uma análise gratuita e proposta personalizada.`,
    target_segments: [
      'Clínica Médica e Odontológica',
      'Escritório de Advocacia',
      'Imobiliária e Construtora',
      'Arquitetura e Engenharia',
      'Contabilidade e Consultoria',
      'Consultoria Empresarial',
      'Indústria e Distribuidora'
    ],
    target_cities: [
      'São Paulo, SP',
      'Campinas, SP',
      'Ribeirão Preto, SP',
      'Sorocaba, SP',
      'São José dos Campos, SP',
      'Santos, SP'
    ]
  },
  sergio: {
    id: 'sergio',
    name: 'Sérgio // LeadCore Sal Industrial',
    tagline: 'Distribuição B2B de Sal Grosso, Moído, Refinado e Micronizado para Indústrias',
    initial_message_template: 'Olá, tudo bem? Notei que a {empresa} atua no setor de {segmento} em {cidade}. Vocês utilizam sal industrial no processo produtivo ou tratamento?',
    ai_prompt: 'Você é o especialista comercial da LeadCore Sal Industrial (empresa do Sérgio). Seu objetivo é descobrir de forma amigável e profissional se a empresa utiliza sal industrial (grosso, moído, refinado ou micronizado), qual a estimativa de consumo mensal e se tem interesse em receber uma cotação direta da distribuidora. Seja conciso (máximo 2 a 3 frases por mensagem). Quando o cliente demonstrar interesse ou pedir preços, agradeça e avise que nosso consultor comercial entrará em contato com a tabela personalizada.',
    target_segments: [
      'Tratamento de Água',
      'Laticínios',
      'Indústria Química',
      'Curtume',
      'Têxtil',
      'Frigorífico'
    ],
    target_cities: [
      'São Paulo, SP',
      'Campinas, SP',
      'Sorocaba, SP',
      'Ribeirão Preto, SP',
      'São José dos Campos, SP'
    ]
  }
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  is_active: false,
  daily_limit: 10,
  start_hour: '09:00',
  end_hour: '17:30',
  work_days_only: false,
  min_interval_mins: 15,
  max_interval_mins: 35,
  profile: 'gustavo',
  target_segments: AUTOMATION_PROFILES.gustavo.target_segments,
  target_cities: AUTOMATION_PROFILES.gustavo.target_cities,
  initial_message_template: AUTOMATION_PROFILES.gustavo.initial_message_template,
  ai_provider: 'gemini',
  ai_api_key: '',
  ai_model: 'gemini-3.5-flash-lite',
  ai_prompt: AUTOMATION_PROFILES.gustavo.ai_prompt,
  excluded_phones: []
};

// Fallback em memória para execução contínua caso as tabelas ainda estejam sendo criadas no Supabase
let inMemorySettings: AutomationSettings = { ...DEFAULT_AUTOMATION_SETTINGS };
let inMemoryLeads: AutomationLead[] = [];
let inMemoryLogs: AutomationLog[] = [
  {
    id: 'log-init',
    event_type: 'system',
    details: '🤖 Sistema de Automação & IA SDR inicializado com sucesso.',
    created_at: new Date().toISOString()
  }
];
let inMemoryMessages: AutomationMessage[] = [];

/**
 * Obtém as configurações da automação
 */
export async function getAutomationSettings(): Promise<AutomationSettings> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        if (Array.isArray(data.excluded_phones)) {
          loadBlacklistedPhones(data.excluded_phones);
        }
        inMemorySettings = {
          ...DEFAULT_AUTOMATION_SETTINGS,
          ...data,
          target_segments: data.target_segments || DEFAULT_AUTOMATION_SETTINGS.target_segments,
          target_cities: data.target_cities || DEFAULT_AUTOMATION_SETTINGS.target_cities,
          ai_api_key: data.ai_api_key || process.env.GEMINI_API_KEY || '',
          excluded_phones: Array.isArray(data.excluded_phones) ? data.excluded_phones : []
        };
        return inMemorySettings;
      }
    } catch (e) {
      console.warn('[Automation] Fallback para configurações em memória:', e);
    }
  }
  if (!inMemorySettings.ai_api_key && process.env.GEMINI_API_KEY) {
    inMemorySettings.ai_api_key = process.env.GEMINI_API_KEY;
  }
  return inMemorySettings;
}

/**
 * Salva as configurações da automação
 */
export async function saveAutomationSettings(updates: Partial<AutomationSettings>): Promise<AutomationSettings> {
  inMemorySettings = { ...inMemorySettings, ...updates };

  if (supabase) {
    try {
      const { data: existing } = await supabase.from('automation_settings').select('id').limit(1).maybeSingle();
      if (existing?.id) {
        await supabase.from('automation_settings').update({
          ...inMemorySettings,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        await supabase.from('automation_settings').insert([inMemorySettings]);
      }
    } catch (e) {
      console.warn('[Automation] Não foi possível salvar configurações no Supabase:', e);
    }
  }

  await addAutomationLog('system', `Configurações da automação atualizadas. Robô ${inMemorySettings.is_active ? 'ATIVO' : 'PAUSADO'}.`);
  return inMemorySettings;
}

/**
 * Alterna entre os perfis pré-definidos (Gustavo vs Sérgio)
 */
export async function switchAutomationProfile(profileId: 'gustavo' | 'sergio'): Promise<AutomationSettings> {
  const preset = AUTOMATION_PROFILES[profileId];
  if (!preset) throw new Error('Perfil inválido: ' + profileId);

  const updates: Partial<AutomationSettings> = {
    profile: profileId,
    initial_message_template: preset.initial_message_template,
    ai_prompt: preset.ai_prompt,
    target_segments: preset.target_segments,
    target_cities: preset.target_cities,
  };

  await addAutomationLog('system', `🔄 Perfil de atendimento alterado para [${preset.name}]. Template e IA SDR atualizados.`);
  return saveAutomationSettings(updates);
}

/**
 * Registra um log de automação
 */
export async function addAutomationLog(
  eventType: AutomationLog['event_type'], 
  details: string, 
  leadPhone?: string
): Promise<AutomationLog> {
  const log: AutomationLog = {
    id: randomUUID(),
    event_type: eventType,
    details,
    lead_phone: leadPhone,
    created_at: new Date().toISOString()
  };

  inMemoryLogs.unshift(log);
  if (inMemoryLogs.length > 200) {
    inMemoryLogs = inMemoryLogs.slice(0, 200);
  }

  if (supabase) {
    try {
      await supabase.from('automation_logs').insert([{
        event_type: eventType,
        details,
        lead_phone: leadPhone || null
      }]);
    } catch (e) {
      // Ignora erro se a tabela ainda não foi criada
    }
  }

  return log;
}

/**
 * Obtém os logs recentes da automação
 */
export async function getAutomationLogs(limit = 40): Promise<AutomationLog[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        return data as AutomationLog[];
      }
    } catch (e) {
      // Fallback
    }
  }
  return inMemoryLogs.slice(0, limit);
}

/**
 * Obtém os leads do pipeline da automação
 */
export async function getAutomationLeads(): Promise<AutomationLead[]> {
  if (supabase) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data, error } = await supabase
          .from('automation_leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          inMemoryLeads = (data as AutomationLead[]).filter(l => !isBlacklistedPhone(l.phone) && !isWhatsAppGroup(l.phone));
          return inMemoryLeads;
        }
      } catch {
        // Retenta em caso de instabilidade momentânea
      }
    }
  }
  return inMemoryLeads.filter(l => !isBlacklistedPhone(l.phone) && !isWhatsAppGroup(l.phone));
}

/**
 * Salva ou atualiza leads no Supabase com resiliência a instabilidades de rede, cold start e duplicidades
 */
async function saveLeadsToSupabaseWithRetry(leadsToSave: AutomationLead[]): Promise<boolean> {
  const sanitizedLeads = leadsToSave.filter(l => !isBlacklistedPhone(l.phone) && !isWhatsAppGroup(l.phone));
  if (!supabase || sanitizedLeads.length === 0) return false;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await supabase
        .from('automation_leads')
        .upsert(sanitizedLeads, { onConflict: 'phone', ignoreDuplicates: true });

      if (!error) {
        return true;
      }

      console.warn(`[Automation] Tentativa ${attempt}/3 de salvar leads no Supabase falhou: ${error.message}`);
      if (attempt === 3) {
        await addAutomationLog('error', `Falha ao salvar no banco: ${error.message}`);
      }
    } catch (err: any) {
      console.warn(`[Automation] Tentativa ${attempt}/3 gerou falha de conexão:`, err?.message || err);
      if (attempt === 3) {
        await addAutomationLog('error', `Instabilidade de rede ao salvar no banco: ${err?.message || 'fetch failed'}`);
      }
    }
    // Aguarda com backoff exponencial antes de retentar
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
  return false;
}

/**
 * Adiciona leads na esteira da automação (importados de buscas ou inseridos manualmente)
 */
export async function addLeadsToAutomation(
  leadsToImport: Array<{
    company_name: string;
    phone: string;
    city?: string;
    state?: string;
    segment?: string;
    source?: string;
  }>
): Promise<{
  added: number;
  duplicates: number;
  total: number;
  leads: AutomationLead[];
}> {
  if (!leadsToImport || leadsToImport.length === 0) {
    const current = await getAutomationLeads();
    return { added: 0, duplicates: 0, total: current.length, leads: [] };
  }

  // Obter leads existentes para evitar duplicidade de telefone
  const existing = await getAutomationLeads();
  const existingPhones = new Set(existing.map(l => toDialablePhone(l.phone)));

  const newLeads: AutomationLead[] = [];
  let duplicates = 0;

  for (const item of leadsToImport) {
    if (!item.phone || !item.company_name) continue;
    const normPhone = toDialablePhone(item.phone);
    if (!normPhone || existingPhones.has(normPhone)) {
      duplicates++;
      continue;
    }

    const lead: AutomationLead = {
      id: randomUUID(),
      company_name: item.company_name.trim(),
      phone: normPhone,
      city: item.city?.trim() || 'São Paulo',
      state: item.state?.trim() || 'SP',
      segment: item.segment?.trim() || 'Indústria',
      source: item.source?.trim() || 'import_leadcore',
      status: 'pending',
      interest_level: 'unknown',
      human_takeover: false,
      created_at: new Date().toISOString()
    };

    existingPhones.add(normPhone);
    newLeads.push(lead);
  }

  if (newLeads.length > 0) {
    inMemoryLeads = [...newLeads, ...inMemoryLeads];
    await saveLeadsToSupabaseWithRetry(newLeads);
    await addAutomationLog('system', `📥 ${newLeads.length} novos leads importados para a fila da automação (${duplicates} duplicados ignorados).`);
  }

  const updatedTotal = await getAutomationLeads();
  return {
    added: newLeads.length,
    duplicates,
    total: updatedTotal.length,
    leads: newLeads
  };
}

export interface CurrentlyTypingInfo {
  phone: string;
  company_name: string;
  started_at: string;
  estimated_duration_sec: number;
  message_preview?: string;
}

let activeTypingState: CurrentlyTypingInfo | null = null;

export function getCurrentlyTyping(): CurrentlyTypingInfo | null {
  if (!activeTypingState) return null;
  // Expira automaticamente se passou mais tempo que o dobro do estimado (proteção contra vazamento de estado)
  const elapsedSec = (Date.now() - new Date(activeTypingState.started_at).getTime()) / 1000;
  if (elapsedSec > (activeTypingState.estimated_duration_sec + 20)) {
    activeTypingState = null;
    return null;
  }
  return activeTypingState;
}

export function setCurrentlyTyping(info: CurrentlyTypingInfo | null) {
  activeTypingState = info;
}

/**
 * Atualiza o status ou dados de um lead da automação com busca inteligente por telefone
 */
export async function updateAutomationLead(
  phone: string, 
  updates: Partial<AutomationLead>
): Promise<boolean> {
  const normalizedPhone = toDialablePhone(phone);
  
  // Atualiza em memória local
  const index = inMemoryLeads.findIndex(l => isSamePhone(l.phone, phone));
  if (index >= 0) {
    inMemoryLeads[index] = { ...inMemoryLeads[index], ...updates };
  }

  if (supabase) {
    try {
      // 1. Tenta localizar por correspondência exata ou variações
      const digits = cleanPhoneDigits(phone);
      const { data: matched } = await supabase
        .from('automation_leads')
        .select('id, phone')
        .or(`phone.eq.${normalizedPhone},phone.eq.${phone},phone.eq.+${digits},phone.eq.${digits}`)
        .limit(1);

      if (matched && matched.length > 0) {
        const { error } = await supabase
          .from('automation_leads')
          .update(updates)
          .eq('id', matched[0].id);
        return !error;
      }

      // 2. Se não encontrou por ID, tenta buscar todos e usar isSamePhone
      const { data: allLeads } = await supabase
        .from('automation_leads')
        .select('id, phone')
        .limit(150);

      const found = (allLeads || []).find(l => isSamePhone(l.phone, phone));
      if (found) {
        const { error } = await supabase
          .from('automation_leads')
          .update(updates)
          .eq('id', found.id);
        return !error;
      }

      // 3. Fallback: update direto pela string normalizada
      const { error } = await supabase
        .from('automation_leads')
        .update(updates)
        .eq('phone', normalizedPhone);
      return !error;
    } catch (e) {
      console.warn('[Automation] Falha ao atualizar lead no Supabase:', e);
      return false;
    }
  }
  return true;
}

/**
 * Exclui um lead do pipeline, seu histórico de mensagens e limpa a fila do WhatsApp
 */
export async function deleteAutomationLead(options: { id?: string; phone?: string }): Promise<boolean> {
  const { id, phone } = options;
  if (!id && !phone) return false;

  // Localiza o lead na memória ou no Supabase para identificar telefone e dados
  let targetLead = inMemoryLeads.find(l => (id && l.id === id) || (phone && (l.phone === phone || isSamePhone(l.phone, phone))));
  
  if (!targetLead && supabase && id) {
    try {
      const { data } = await supabase.from('automation_leads').select('*').eq('id', id).maybeSingle();
      if (data) targetLead = data as AutomationLead;
    } catch {
      // Continua
    }
  }

  const targetPhone = targetLead ? targetLead.phone : (phone || '');
  const targetId = targetLead ? targetLead.id : id;

  // 1. Adiciona o telefone à blacklist permanente para parar imediatamente qualquer disparo ou resposta
  if (targetPhone) {
    addPhoneToBlacklist(targetPhone);
    const currentExcluded = inMemorySettings.excluded_phones || [];
    if (!currentExcluded.some(p => isSamePhone(p, targetPhone))) {
      inMemorySettings.excluded_phones = [...currentExcluded, toDialablePhone(targetPhone) || targetPhone];
      // Salva de forma persistente nas configurações da automação
      if (supabase) {
        supabase.from('automation_settings').update({
          excluded_phones: inMemorySettings.excluded_phones,
          updated_at: new Date().toISOString()
        }).neq('id', '00000000-0000-0000-0000-000000000000').then(() => {}, () => {});
      }
    }
  }

  // 2. Se estava simulando digitação para este contato, cancela imediatamente no painel
  const currentTyping = getCurrentlyTyping();
  if (currentTyping && targetPhone && isSamePhone(currentTyping.phone, targetPhone)) {
    setCurrentlyTyping(null);
  }

  // 3. Cancela imediatamente qualquer mensagem enfileirada ou em digitação no microserviço Go WhatsApp
  if (targetPhone) {
    await clearWhatsAppQueue(targetPhone).catch(() => false);
  }

  // 4. Remove da memória local (leads e mensagens)
  inMemoryLeads = inMemoryLeads.filter(l => {
    if (targetId && l.id === targetId) return false;
    if (targetPhone && isSamePhone(l.phone, targetPhone)) return false;
    return true;
  });

  if (targetPhone) {
    inMemoryMessages = inMemoryMessages.filter(m => !isSamePhone(m.lead_phone, targetPhone));
  }

  // 5. Exclui definitivamente do banco de dados Supabase
  if (supabase) {
    try {
      // 5.1 Busca IDs dos leads correspondentes no Supabase para deletar com 100% de precisão por ID
      const { data: dbLeads } = await supabase.from('automation_leads').select('id, phone');
      const leadIdsToDelete: string[] = [];
      if (targetId) leadIdsToDelete.push(targetId);
      if (dbLeads) {
        for (const dl of dbLeads) {
          if ((targetId && dl.id === targetId) || (targetPhone && isSamePhone(dl.phone, targetPhone))) {
            if (!leadIdsToDelete.includes(dl.id)) {
              leadIdsToDelete.push(dl.id);
            }
          }
        }
      }

      if (leadIdsToDelete.length > 0) {
        await supabase.from('automation_leads').delete().in('id', leadIdsToDelete);
      }

      // 5.2 Busca IDs das mensagens trocadas com este telefone e deleta por ID
      if (targetPhone) {
        const { data: dbMsgs } = await supabase.from('automation_messages').select('id, lead_phone');
        if (dbMsgs && dbMsgs.length > 0) {
          const msgIdsToDelete = dbMsgs
            .filter(m => isSamePhone(m.lead_phone, targetPhone))
            .map(m => m.id);
          if (msgIdsToDelete.length > 0) {
            await supabase.from('automation_messages').delete().in('id', msgIdsToDelete);
          }
        }

        // Defesa em profundidade adicional
        const digits = cleanPhoneDigits(targetPhone);
        const normalized = toDialablePhone(targetPhone);
        await supabase.from('automation_leads').delete().or(`phone.eq.${targetPhone},phone.eq.${normalized},phone.eq.+${digits},phone.eq.${digits}`);
        await supabase.from('automation_messages').delete().or(`lead_phone.eq.${targetPhone},lead_phone.eq.${normalized},lead_phone.eq.+${digits},lead_phone.eq.${digits}`);
      }
    } catch (e) {
      console.warn('[Automation] Erro ao excluir lead no Supabase:', e);
    }
  }

  const companyName = targetLead ? targetLead.company_name : (targetPhone || 'Lead');
  await addAutomationLog('system', `🗑️ Lead "${companyName}" (${formatPhoneDisplay(targetPhone)}) excluído do banco de dados e adicionado à lista de bloqueio (envios interrompidos).`);

  return true;
}

/**
 * Exclui todos os leads desqualificados de uma só vez
 */
export async function deleteDisqualifiedLeads(): Promise<number> {
  const leads = await getAutomationLeads();
  const disqualified = leads.filter(l => l.status === 'disqualified' || l.interest_level === 'none');
  let deletedCount = 0;

  for (const lead of disqualified) {
    const ok = await deleteAutomationLead({ id: lead.id, phone: lead.phone });
    if (ok) deletedCount++;
  }

  if (deletedCount > 0) {
    await addAutomationLog('system', `🗑️ Limpeza em lote: ${deletedCount} leads desqualificados foram excluídos.`);
  }

  return deletedCount;
}

/**
 * Registra uma mensagem na thread de conversa
 */
export async function addAutomationMessage(
  leadPhone: string,
  direction: 'inbound' | 'outbound',
  sender: 'lead' | 'ai' | 'human',
  content: string
): Promise<AutomationMessage> {
  const normalizedPhone = toDialablePhone(leadPhone);
  const msg: AutomationMessage = {
    id: randomUUID(),
    lead_phone: normalizedPhone,
    direction,
    sender,
    content,
    created_at: new Date().toISOString()
  };

  inMemoryMessages.push(msg);

  if (supabase) {
    try {
      await supabase.from('automation_messages').insert([{
        lead_phone: normalizedPhone,
        direction,
        sender,
        content
      }]);
    } catch (e) {
      // Fallback
    }
  }

  return msg;
}

/**
 * Obtém mensagens trocadas com um lead específico
 */
export async function getAutomationMessages(leadPhone: string): Promise<AutomationMessage[]> {
  const normalizedPhone = toDialablePhone(leadPhone);

  if (supabase) {
    try {
      // Busca mensagens usando variantes do telefone
      const digits = cleanPhoneDigits(leadPhone);
      const { data, error } = await supabase
        .from('automation_messages')
        .select('*')
        .or(`lead_phone.eq.${normalizedPhone},lead_phone.eq.${leadPhone},lead_phone.eq.+${digits},lead_phone.eq.${digits}`)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        return data as AutomationMessage[];
      }
    } catch (e) {
      // Fallback
    }
  }

  return inMemoryMessages
    .filter(m => isSamePhone(m.lead_phone, leadPhone))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * Calcula a programação exata do próximo disparo automático
 */
export function calculateNextDispatchSchedule(
  settings: AutomationSettings,
  leads: AutomationLead[],
  metrics: AutomationMetrics
): {
  status: 'active' | 'paused' | 'outside_hours' | 'weekend' | 'limit_reached' | 'typing' | 'ready_now' | 'queue_empty';
  scheduled_at: string;
  formatted_time: string;
  countdown_seconds: number;
  reason: string;
  is_window_active: boolean;
  next_lead: AutomationLead | null;
  currently_typing: CurrentlyTypingInfo | null;
} {
  const now = new Date();
  const currentHour = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const currentDay = now.getDay(); // 0 = Domingo, 6 = Sábado

  const typing = getCurrentlyTyping();
  const pendingLeads = leads.filter(l => l.status === 'pending' && !isBlacklistedPhone(l.phone));
  const nextLead = pendingLeads[0] || null;

  // Se está digitando ativamente no momento
  if (typing) {
    return {
      status: 'typing',
      scheduled_at: now.toISOString(),
      formatted_time: 'Digitando agora...',
      countdown_seconds: 0,
      reason: `Digitando humanizadamente para ${typing.company_name} (${typing.phone})`,
      is_window_active: true,
      next_lead: nextLead,
      currently_typing: typing
    };
  }

  // 1. Robô Pausado
  if (!settings.is_active) {
    return {
      status: 'paused',
      scheduled_at: '',
      formatted_time: 'Pausado',
      countdown_seconds: 0,
      reason: 'Robô pausado pelo operador. Ative a chave mestra para retomar.',
      is_window_active: false,
      next_lead: nextLead,
      currently_typing: null
    };
  }

  // 2. Fim de semana
  if (settings.work_days_only && (currentDay === 0 || currentDay === 6)) {
    return {
      status: 'weekend',
      scheduled_at: '',
      formatted_time: 'Segunda-feira 09:00',
      countdown_seconds: 0,
      reason: 'Fora dos dias úteis configurados. Disparos retomarão na segunda-feira.',
      is_window_active: false,
      next_lead: nextLead,
      currently_typing: null
    };
  }

  // 3. Fora de horário comercial
  const isBeforeStart = currentHour < settings.start_hour;
  const isAfterEnd = currentHour > settings.end_hour;
  if (isBeforeStart || isAfterEnd) {
    const targetDate = new Date();
    if (isAfterEnd) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    const [startH, startM] = settings.start_hour.split(':').map(Number);
    targetDate.setHours(startH || 9, startM || 0, 0, 0);

    const diffSec = Math.max(0, Math.round((targetDate.getTime() - now.getTime()) / 1000));
    return {
      status: 'outside_hours',
      scheduled_at: targetDate.toISOString(),
      formatted_time: `${settings.start_hour}:00`,
      countdown_seconds: diffSec,
      reason: `Fora do expediente comercial (${settings.start_hour} às ${settings.end_hour}). Próximo início às ${settings.start_hour}.`,
      is_window_active: false,
      next_lead: nextLead,
      currently_typing: null
    };
  }

  // 4. Limite Diário Atingido
  if (metrics.dispatchedToday >= settings.daily_limit) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [startH, startM] = settings.start_hour.split(':').map(Number);
    tomorrow.setHours(startH || 9, startM || 0, 0, 0);
    const diffSec = Math.max(0, Math.round((tomorrow.getTime() - now.getTime()) / 1000));

    return {
      status: 'limit_reached',
      scheduled_at: tomorrow.toISOString(),
      formatted_time: `Amanhã às ${settings.start_hour}`,
      countdown_seconds: diffSec,
      reason: `Meta diária de ${settings.daily_limit} mensagens atingida hoje. Próximo ciclo amanhã às ${settings.start_hour}.`,
      is_window_active: false,
      next_lead: nextLead,
      currently_typing: null
    };
  }

  // 5. Fila Vazia
  if (pendingLeads.length === 0) {
    return {
      status: 'queue_empty',
      scheduled_at: now.toISOString(),
      formatted_time: 'Aguardando leads',
      countdown_seconds: 0,
      reason: 'Fila de leads vazia. O robô minerará automaticamente novos contatos no Google.',
      is_window_active: true,
      next_lead: null,
      currently_typing: null
    };
  }

  // 6. Cálculo do intervalo baseado no último disparo
  const dispatchedLeads = leads
    .filter(l => Boolean(l.dispatched_at))
    .sort((a, b) => new Date(b.dispatched_at!).getTime() - new Date(a.dispatched_at!).getTime());

  const lastDispatched = dispatchedLeads[0];
  const minIntervalSec = Math.max(1, (settings.min_interval_mins || 25) * 60);
  const maxIntervalSec = Math.max(minIntervalSec, (settings.max_interval_mins || 50) * 60);
  const avgIntervalSec = Math.round((minIntervalSec + maxIntervalSec) / 2);

  if (lastDispatched && lastDispatched.dispatched_at) {
    const lastTime = new Date(lastDispatched.dispatched_at).getTime();
    const nextTimeMs = lastTime + (avgIntervalSec * 1000);
    const remainingSec = Math.round((nextTimeMs - now.getTime()) / 1000);

    if (remainingSec > 0) {
      const scheduledDate = new Date(nextTimeMs);
      const timeStr = scheduledDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return {
        status: 'active',
        scheduled_at: scheduledDate.toISOString(),
        formatted_time: timeStr,
        countdown_seconds: remainingSec,
        reason: `Espaçamento de segurança anti-ban (${settings.min_interval_mins}-${settings.max_interval_mins} min).`,
        is_window_active: true,
        next_lead: nextLead,
        currently_typing: null
      };
    }
  }

  // Pronto para disparar imediatamente
  return {
    status: 'ready_now',
    scheduled_at: now.toISOString(),
    formatted_time: 'Pronto para disparar',
    countdown_seconds: 0,
    reason: `Janela comercial aberta. Próximo lead: ${nextLead?.company_name || 'Próximo da fila'}.`,
    is_window_active: true,
    next_lead: nextLead,
    currently_typing: null
  };
}

/**
 * Calcula as métricas consolidadas de hoje (garantindo que respostas sejam contadas com precisão)
 */
export async function getAutomationMetrics(): Promise<AutomationMetrics> {
  const leads = await getAutomationLeads();
  const todayStr = new Date().toISOString().slice(0, 10);

  const minedToday = leads.filter(l => l.created_at?.startsWith(todayStr)).length;
  const dispatchedToday = leads.filter(l => l.dispatched_at?.startsWith(todayStr)).length;
  // Considera resposta se tem data de resposta hoje OU se o status foi alterado para em conversa/qualificado
  const repliesToday = leads.filter(l => {
    const hasReplyDateToday = l.last_reply_at && l.last_reply_at.startsWith(todayStr);
    const hasActiveChat = l.status === 'chatting' || l.status === 'qualified';
    return Boolean(hasReplyDateToday || hasActiveChat);
  }).length;

  const qualifiedToday = leads.filter(l => l.status === 'qualified' || l.interest_level === 'high').length;
  const disqualifiedToday = leads.filter(l => l.status === 'disqualified' || l.interest_level === 'none').length;
  const pendingInQueue = leads.filter(l => l.status === 'pending').length;

  return {
    minedToday,
    dispatchedToday,
    repliesToday,
    qualifiedToday,
    disqualifiedToday,
    pendingInQueue,
    totalInPipeline: leads.length
  };
}

/**
 * Formata o texto inicial substituindo variáveis dinâmicas
 */
export function formatInitialMessage(template: string, lead: AutomationLead): string {
  return interpolateVariables(template, {
    empresa: lead.company_name,
    nome: lead.company_name ? lead.company_name.split(' ')[0] : '',
    primeiro_nome: lead.company_name ? lead.company_name.split(' ')[0] : '',
    cidade: lead.city,
    categoria: lead.segment,
    segmento: lead.segment,
    telefone: lead.phone
  });
}

let isCycleRunning = false;

/**
 * Executa um ciclo completo do robô autônomo:
 * 1. Verifica regras de horário e limites.
 * 2. Se a fila de pendentes estiver baixa (< 5), busca automaticamente mais leads via Google SerpAPI.
 * 3. Se estiver no momento de envio, despacha o próximo lead com anti-ban.
 */
export async function runAutomationCycle(options: {
  force?: boolean;
  skipSearch?: boolean;
  targetLeadId?: string;
} | boolean = false): Promise<{
  executed: boolean;
  actionTaken?: 'searched_and_dispatched' | 'searched_only' | 'dispatched_only' | 'idle';
  message: string;
  leadDispatched?: AutomationLead;
}> {
  if (isCycleRunning) {
    return { executed: false, message: 'Ciclo de automação já em andamento.' };
  }
  isCycleRunning = true;
  try {
    const result = await executeAutomationCycleInternal(options);
    return result;
  } finally {
    isCycleRunning = false;
  }
}

async function executeAutomationCycleInternal(options: {
  force?: boolean;
  skipSearch?: boolean;
  targetLeadId?: string;
} | boolean = false): Promise<{
  executed: boolean;
  actionTaken?: 'searched_and_dispatched' | 'searched_only' | 'dispatched_only' | 'idle';
  message: string;
  leadDispatched?: AutomationLead;
}> {
  const force = typeof options === 'boolean' ? options : Boolean(options?.force);
  const skipSearch = typeof options === 'object' ? Boolean(options?.skipSearch) : false;
  const targetLeadId = typeof options === 'object' ? options?.targetLeadId : undefined;

  const settings = await getAutomationSettings();

  if (!settings.is_active && !force) {
    return { executed: false, message: 'Automação pausada pelo operador.' };
  }

  const now = new Date();
  const currentHour = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const currentDay = now.getDay(); // 0 = Domingo, 6 = Sábado

  // 1. Verificação de dias úteis
  if (settings.work_days_only && (currentDay === 0 || currentDay === 6) && !force) {
    return { executed: false, message: 'Fora dos dias de operação configurados (fim de semana).' };
  }

  // 2. Verificação de horário comercial
  if (!force && (currentHour < settings.start_hour || currentHour > settings.end_hour)) {
    return { 
      executed: false, 
      message: `Fora do horário de expediente comercial (${settings.start_hour} às ${settings.end_hour}). Horário atual: ${currentHour}` 
    };
  }

  const metrics = await getAutomationMetrics();

  // 3. Verificação de cota diária
  if (!force && metrics.dispatchedToday >= settings.daily_limit) {
    return { 
      executed: false, 
      message: `Limite diário atingido (${metrics.dispatchedToday}/${settings.daily_limit} disparos hoje). Próximos disparos amanhã.` 
    };
  }

  let leads = await getAutomationLeads();
  let pendingLeads = leads.filter(l => l.status === 'pending' && !isBlacklistedPhone(l.phone));
  let searchedCount = 0;

  // 4. Se a fila estiver totalmente vazia e NÃO for solicitado pular busca, dispara a busca automática via Google API
  if (pendingLeads.length === 0 && !skipSearch) {
    try {
      const segments = settings.target_segments.length > 0 
        ? settings.target_segments 
        : DEFAULT_AUTOMATION_SETTINGS.target_segments;
      const cities = settings.target_cities.length > 0 
        ? settings.target_cities 
        : DEFAULT_AUTOMATION_SETTINGS.target_cities;

      // Escolhe aleatoriamente um segmento e uma cidade configurada
      const chosenSegment = segments[Math.floor(Math.random() * segments.length)];
      const chosenCity = cities[Math.floor(Math.random() * cities.length)];

      await addAutomationLog('search', `🔍 Minerando leads no Google: "${chosenSegment}" em "${chosenCity}"...`);

      const serpResult = await scrapeSerpAPI(chosenSegment, chosenCity, 'Brasil');
      const validLeads = await filterLeadsWithWhatsApp(serpResult.leads);

      // Conjunto de telefones existentes para nunca duplicar
      const existingPhones = new Set(leads.map(l => toDialablePhone(l.phone)));

      const freshLeadsToInsert: AutomationLead[] = [];
      for (const scraped of validLeads) {
        if (!scraped.whatsapp) continue;
        const norm = toDialablePhone(scraped.whatsapp);
        if (existingPhones.has(norm) || isBlacklistedPhone(norm) || isBlacklistedPhone(scraped.whatsapp) || isWhatsAppGroup(norm) || isWhatsAppGroup(scraped.whatsapp)) continue;

        const newLead: AutomationLead = {
          id: randomUUID(),
          company_name: scraped.name,
          phone: norm,
          city: scraped.city || chosenCity,
          state: 'SP',
          segment: chosenSegment,
          source: 'google_serpapi',
          status: 'pending',
          interest_level: 'unknown',
          human_takeover: false,
          created_at: new Date().toISOString()
        };

        existingPhones.add(norm);
        freshLeadsToInsert.push(newLead);
        if (freshLeadsToInsert.length >= 10) break; // Garante lote ideal
      }

      if (freshLeadsToInsert.length > 0) {
        searchedCount = freshLeadsToInsert.length;
        inMemoryLeads = [...freshLeadsToInsert, ...inMemoryLeads];
        await saveLeadsToSupabaseWithRetry(freshLeadsToInsert);

        await addAutomationLog('search', `✅ ${searchedCount} novos leads qualificados e enfileirados para ${chosenSegment} (${chosenCity}).`);
        // Recarrega lista atualizada
        leads = await getAutomationLeads();
        pendingLeads = leads.filter(l => l.status === 'pending' && !isBlacklistedPhone(l.phone));
      } else {
        await addAutomationLog('system', `Nenhum novo lead inédito encontrado para ${chosenSegment} em ${chosenCity}. Tentará outro nicho no próximo ciclo.`);
      }
    } catch (searchErr: any) {
      console.error('[Automation] Erro na busca automática:', searchErr);
      await addAutomationLog('error', `Falha na busca do Google: ${searchErr.message || 'Erro desconhecido'}`);
    }
  }

  // 5. Se não houver lead para disparar agora
  if (pendingLeads.length === 0) {
    return {
      executed: true,
      actionTaken: searchedCount > 0 ? 'searched_only' : 'idle',
      message: searchedCount > 0 
        ? `Busca realizada com sucesso (${searchedCount} leads), mas nenhum pronto para disparo imediato.` 
        : 'Fila de leads pendentes vazia no momento.'
    };
  }

  // 6. Realiza o disparo do próximo lead da fila ou do lead alvo solicitado
  const nextLead = targetLeadId 
    ? (pendingLeads.find(l => l.id === targetLeadId) || pendingLeads[0])
    : pendingLeads[0];

  if (!nextLead || nextLead.status !== 'pending' || nextLead.dispatched_at || isBlacklistedPhone(nextLead.phone)) {
    return {
      executed: false,
      message: 'Lead já foi disparado, não está mais pendente ou foi excluído.'
    };
  }

  const messageToSend = formatInitialMessage(settings.initial_message_template, nextLead);
  const nowIso = new Date().toISOString();

  // Trava imediata em memória e banco de dados para NUNCA disparar duas vezes para o mesmo contato
  nextLead.status = 'sent';
  nextLead.dispatched_at = nowIso;
  await updateAutomationLead(nextLead.phone, {
    status: 'sent',
    dispatched_at: nowIso
  });

  await addAutomationLog('dispatch', `✉️ Enviando disparo automático para ${nextLead.company_name} (${nextLead.phone})...`, nextLead.phone);

  const charCount = messageToSend.length;
  const estimatedSec = Math.max(15, Math.min(60, Math.round(charCount * 0.25)));
  setCurrentlyTyping({
    phone: nextLead.phone,
    company_name: nextLead.company_name,
    started_at: nowIso,
    estimated_duration_sec: estimatedSec,
    message_preview: messageToSend.slice(0, 80)
  });

  try {
    const sendResult = await sendWhatsAppMessage({
      phone: nextLead.phone,
      message: messageToSend
    });

    if (sendResult.success) {
      await addAutomationMessage(nextLead.phone, 'outbound', 'ai', messageToSend);
      await addAutomationLog('dispatch', `✅ Disparo ${metrics.dispatchedToday + 1}/${settings.daily_limit} enviado com sucesso para ${nextLead.company_name}.`, nextLead.phone);

      return {
        executed: true,
        actionTaken: searchedCount > 0 ? 'searched_and_dispatched' : 'dispatched_only',
        message: `Disparo ${metrics.dispatchedToday + 1}/${settings.daily_limit} efetuado com sucesso para ${nextLead.company_name}!`,
        leadDispatched: { ...nextLead, status: 'sent', dispatched_at: nowIso }
      };
    } else {
      await addAutomationLog('error', `Falha ao disparar para ${nextLead.company_name}: ${sendResult.error || 'Erro no WhatsApp Service'}`, nextLead.phone);
      return {
        executed: false,
        message: `Erro no serviço WhatsApp: ${sendResult.error}`
      };
    }
  } catch (sendErr: any) {
    await addAutomationLog('error', `Erro na conexão com WhatsApp Service: ${sendErr.message}`, nextLead.phone);
    return {
      executed: false,
      message: `Falha de conexão com o WhatsApp: ${sendErr.message}`
    };
  } finally {
    // Mantém o estado ativo por mais alguns segundos ou limpa se falhou
    setTimeout(() => {
      setCurrentlyTyping(null);
    }, 5000);
  }
}

/**
 * Motor autônomo em segundo plano (Server Background Worker)
 * Monitora continuamente o agendamento e executa o disparo pontualmente
 * assim que o contador regressivo atinge zero e a janela comercial está aberta.
 */
let isWorkerExecuting = false;
let globalWorkerTimer: NodeJS.Timeout | null = null;

export function ensureAutomationWorkerRunning() {
  if (globalWorkerTimer) return;

  console.log('[Automation Worker] 🚀 Inicializando motor autônomo de disparos e escuta de IA em segundo plano...');
  globalWorkerTimer = setInterval(async () => {
    if (isWorkerExecuting) return;
    try {
      isWorkerExecuting = true;

      // 1. Sincroniza mensagens recebidas (inbound) do microserviço WhatsApp (mesmo com robô de prospecção pausado)
      try {
        const { syncInboundWhatsAppMessages } = await import('./aiSdr');
        await syncInboundWhatsAppMessages();
      } catch (inbErr) {
        // Ignora silenciosamente se microserviço estiver offline
      }

      // 2. Avalia próximo disparo ativo de prospecção
      const settings = await getAutomationSettings();
      if (!settings.is_active) {
        return;
      }

      const leads = await getAutomationLeads();
      const metrics = await getAutomationMetrics();
      const schedule = calculateNextDispatchSchedule(settings, leads, metrics);
      
      // Se estiver pronto para disparar ou o contador zerou
      if (schedule.status === 'ready_now' || (schedule.status === 'active' && schedule.countdown_seconds <= 0)) {
        console.log(`[Automation Worker] ⏰ Horário programado atingido! Disparando para ${schedule.next_lead?.company_name || 'próximo lead'}...`);
        const result = await runAutomationCycle(false);
        if (result.executed) {
          console.log(`[Automation Worker] ✅ Disparo automático efetuado: ${result.message}`);
        } else {
          console.log(`[Automation Worker] ℹ️ Ciclo avaliado: ${result.message}`);
        }
      }
    } catch (err: any) {
      console.error('[Automation Worker] Erro no ciclo de disparo:', err?.message || err);
    } finally {
      isWorkerExecuting = false;
    }
  }, 4000);
}

// Inicializa automaticamente no carregamento do módulo
if (typeof window === 'undefined') {
  ensureAutomationWorkerRunning();
}

