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
import { sendWhatsAppMessage, sendWhatsAppHumanBubbles, getWhatsAppQueue, clearWhatsAppQueue, updateWhatsAppConfig } from './whatsapp';
import { interpolateVariables } from './templateInterpolation';

export { 
  isBlacklistedPhone, 
  addPhoneToBlacklist, 
  removePhoneFromBlacklist, 
  getBlacklistedPhones 
};

import { AUTOMATION_PROFILES, type AutomationProfilePreset } from './automationProfiles';
export { AUTOMATION_PROFILES, type AutomationProfilePreset };

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

const gState = globalThis as any;

// Fallback em memória global (compartilhado entre todas as rotas do servidor Next.js)
let inMemorySettings: AutomationSettings = gState.__inMemorySettings || { ...DEFAULT_AUTOMATION_SETTINGS };
gState.__inMemorySettings = inMemorySettings;
let inMemoryLeads: AutomationLead[] = gState.__inMemoryLeads || [];
gState.__inMemoryLeads = inMemoryLeads;
let inMemoryLogs: AutomationLog[] = gState.__inMemoryLogs || [
  {
    id: 'log-init',
    event_type: 'system',
    details: '🤖 Sistema de Automação & IA SDR inicializado com sucesso.',
    created_at: new Date().toISOString()
  }
];
gState.__inMemoryLogs = inMemoryLogs;
let inMemoryMessages: AutomationMessage[] = gState.__inMemoryMessages || [];
gState.__inMemoryMessages = inMemoryMessages;

function sanitizeSettingsObject(raw: Partial<AutomationSettings>): AutomationSettings {
  const base = gState.__inMemorySettings || DEFAULT_AUTOMATION_SETTINGS;
  const merged: AutomationSettings = {
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...base,
    ...raw,
    daily_limit: Number(raw.daily_limit ?? base.daily_limit ?? DEFAULT_AUTOMATION_SETTINGS.daily_limit) || 10,
    min_interval_mins: Number(raw.min_interval_mins ?? base.min_interval_mins ?? DEFAULT_AUTOMATION_SETTINGS.min_interval_mins) || 15,
    max_interval_mins: Number(raw.max_interval_mins ?? base.max_interval_mins ?? DEFAULT_AUTOMATION_SETTINGS.max_interval_mins) || 35,
    start_hour: (raw.start_hour ?? base.start_hour ?? DEFAULT_AUTOMATION_SETTINGS.start_hour).trim() || '09:00',
    end_hour: (raw.end_hour ?? base.end_hour ?? DEFAULT_AUTOMATION_SETTINGS.end_hour).trim() || '17:30',
    work_days_only: Boolean(raw.work_days_only ?? base.work_days_only ?? false),
    is_active: Boolean(raw.is_active ?? base.is_active ?? false),
    profile: (raw.profile || base.profile || 'gustavo') as any,
    target_segments: Array.isArray(raw.target_segments) && raw.target_segments.length > 0
      ? raw.target_segments
      : (Array.isArray(base.target_segments) && base.target_segments.length > 0 ? base.target_segments : DEFAULT_AUTOMATION_SETTINGS.target_segments),
    target_cities: Array.isArray(raw.target_cities) && raw.target_cities.length > 0
      ? raw.target_cities
      : (Array.isArray(base.target_cities) && base.target_cities.length > 0 ? base.target_cities : DEFAULT_AUTOMATION_SETTINGS.target_cities),
    initial_message_template: raw.initial_message_template ?? base.initial_message_template ?? DEFAULT_AUTOMATION_SETTINGS.initial_message_template,
    ai_provider: (raw.ai_provider || base.ai_provider || 'gemini') as any,
    ai_api_key: raw.ai_api_key ?? base.ai_api_key ?? process.env.GEMINI_API_KEY ?? '',
    ai_model: raw.ai_model || base.ai_model || 'gemini-3.5-flash-lite',
    ai_prompt: raw.ai_prompt ?? base.ai_prompt ?? DEFAULT_AUTOMATION_SETTINGS.ai_prompt,
    excluded_phones: Array.isArray(raw.excluded_phones)
      ? raw.excluded_phones
      : (Array.isArray(base.excluded_phones) ? base.excluded_phones : [])
  };
  return merged;
}

/**
 * Obtém as configurações da automação (com proteção contra sobrescrita e fallback JSON no Supabase)
 */
export async function getAutomationSettings(): Promise<AutomationSettings> {
  // Se acabou de ser salvo há menos de 4 segundos nesta instância, retorna imediatamente a versão recém-salva
  if (gState.__settingsLastSavedAt && Date.now() - gState.__settingsLastSavedAt < 4000 && gState.__inMemorySettings) {
    return gState.__inMemorySettings;
  }

  if (supabase) {
    try {
      const [tableRes, backupRes] = await Promise.all([
        supabase
          .from('automation_settings')
          .select('*')
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('automation_logs')
          .select('details, created_at')
          .eq('lead_phone', '__settings_json__')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      let backupParsed: Partial<AutomationSettings> | null = null;
      if (!backupRes.error && backupRes.data?.details) {
        try {
          backupParsed = JSON.parse(backupRes.data.details);
        } catch {
          backupParsed = null;
        }
      }

      const tableData = (!tableRes.error && tableRes.data) ? tableRes.data : null;

      if (tableData || backupParsed) {
        // O snapshot JSON (__settings_json__) garante todos os campos mesmo que faltem colunas na tabela automation_settings
        const combined: Partial<AutomationSettings> = {
          ...(tableData || {}),
          ...(backupParsed || {}),
          id: tableData?.id || backupParsed?.id
        };

        if (Array.isArray(combined.excluded_phones)) {
          loadBlacklistedPhones(combined.excluded_phones);
        }

        inMemorySettings = sanitizeSettingsObject(combined);
        gState.__inMemorySettings = inMemorySettings;
        return inMemorySettings;
      }
    } catch (e) {
      console.warn('[Automation] Fallback para configurações em memória:', e);
    }
  }

  if (!inMemorySettings.ai_api_key && process.env.GEMINI_API_KEY) {
    inMemorySettings.ai_api_key = process.env.GEMINI_API_KEY;
  }
  gState.__inMemorySettings = inMemorySettings;
  return inMemorySettings;
}

/**
 * Salva as configurações da automação de forma 100% resiliente (tabela + snapshot JSON + sincronia com Go)
 */
export async function saveAutomationSettings(updates: Partial<AutomationSettings>): Promise<AutomationSettings> {
  inMemorySettings = sanitizeSettingsObject({
    ...inMemorySettings,
    ...updates
  });
  gState.__inMemorySettings = inMemorySettings;
  gState.__settingsLastSavedAt = Date.now();

  if (supabase) {
    try {
      // 1. Salva snapshot JSON completo em automation_logs (nunca falha por falta de coluna)
      await supabase.from('automation_logs').delete().eq('lead_phone', '__settings_json__');
      await supabase.from('automation_logs').insert([{
        event_type: 'system',
        details: JSON.stringify(inMemorySettings),
        lead_phone: '__settings_json__'
      }]);

      // 2. Atualiza ou insere na tabela automation_settings (com fallback automático se faltar alguma coluna)
      const { data: rows } = await supabase
        .from('automation_settings')
        .select('id')
        .order('id', { ascending: true });

      const existingId = rows && rows.length > 0 ? rows[0].id : null;

      // Remove linhas duplicadas antigas se existirem
      if (rows && rows.length > 1) {
        const extraIds = rows.slice(1).map(r => r.id);
        await supabase.from('automation_settings').delete().in('id', extraIds);
      }

      const fullPayload: Record<string, any> = {
        is_active: inMemorySettings.is_active,
        daily_limit: inMemorySettings.daily_limit,
        start_hour: inMemorySettings.start_hour,
        end_hour: inMemorySettings.end_hour,
        work_days_only: inMemorySettings.work_days_only,
        min_interval_mins: inMemorySettings.min_interval_mins,
        max_interval_mins: inMemorySettings.max_interval_mins,
        profile: inMemorySettings.profile,
        target_segments: inMemorySettings.target_segments,
        target_cities: inMemorySettings.target_cities,
        initial_message_template: inMemorySettings.initial_message_template,
        ai_provider: inMemorySettings.ai_provider,
        ai_api_key: inMemorySettings.ai_api_key,
        ai_model: inMemorySettings.ai_model,
        ai_prompt: inMemorySettings.ai_prompt,
        excluded_phones: inMemorySettings.excluded_phones,
        updated_at: new Date().toISOString()
      };

      const basePayload: Record<string, any> = {
        is_active: inMemorySettings.is_active,
        daily_limit: inMemorySettings.daily_limit,
        start_hour: inMemorySettings.start_hour,
        end_hour: inMemorySettings.end_hour,
        work_days_only: inMemorySettings.work_days_only,
        min_interval_mins: inMemorySettings.min_interval_mins,
        max_interval_mins: inMemorySettings.max_interval_mins,
        target_segments: inMemorySettings.target_segments,
        target_cities: inMemorySettings.target_cities,
        initial_message_template: inMemorySettings.initial_message_template,
        ai_provider: inMemorySettings.ai_provider,
        ai_api_key: inMemorySettings.ai_api_key,
        ai_model: inMemorySettings.ai_model,
        ai_prompt: inMemorySettings.ai_prompt
      };

      if (existingId) {
        inMemorySettings.id = existingId;
        const { error: updateErr } = await supabase
          .from('automation_settings')
          .update(fullPayload)
          .eq('id', existingId);

        if (updateErr) {
          console.warn('[Automation] Retentando update com colunas base:', updateErr.message);
          await supabase
            .from('automation_settings')
            .update(basePayload)
            .eq('id', existingId);
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('automation_settings')
          .insert([fullPayload])
          .select('id')
          .maybeSingle();

        if (insertErr) {
          console.warn('[Automation] Retentando insert com colunas base:', insertErr.message);
          const { data: insertedBase } = await supabase
            .from('automation_settings')
            .insert([basePayload])
            .select('id')
            .maybeSingle();
          if (insertedBase?.id) inMemorySettings.id = insertedBase.id;
        } else if (inserted?.id) {
          inMemorySettings.id = inserted.id;
        }
      }
    } catch (e) {
      console.warn('[Automation] Não foi possível salvar configurações no Supabase:', e);
    }
  }

  // 3. Sincroniza daily_limit imediatamente com o microserviço Go WhatsApp
  await updateWhatsAppConfig({ daily_limit: inMemorySettings.daily_limit }).catch(() => false);

  await addAutomationLog(
    'system',
    `⚙️ Configurações salvas! Robô ${inMemorySettings.is_active ? 'ATIVO' : 'PAUSADO'} • Meta: ${inMemorySettings.daily_limit}/dia • Horário: ${inMemorySettings.start_hour}-${inMemorySettings.end_hour} • Intervalo: ${inMemorySettings.min_interval_mins}-${inMemorySettings.max_interval_mins}min.`
  );

  ensureAutomationWorkerRunning();
  if (inMemorySettings.is_active) {
    setTimeout(() => {
      runAutomationCycle(false).catch(() => {});
    }, 500);
  }

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
        .limit(limit + 10);

      if (!error && data && data.length > 0) {
        return (data as AutomationLog[])
          .filter(l => !l.lead_phone?.startsWith('__'))
          .slice(0, limit);
      }
    } catch (e) {
      // Fallback
    }
  }
  return inMemoryLogs
    .filter(l => !l.lead_phone?.startsWith('__'))
    .slice(0, limit);
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
    removePhoneFromBlacklist(normPhone);
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

  // 1. Se estava simulando digitação para este contato, cancela imediatamente no painel
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
 * Verifica leads em espera de resposta (status 'sent' ou 'chatting') que estão inativos há mais de 24 horas
 * e os desqualifica automaticamente ("se parar de responder, desqualifica").
 */
export async function checkAndDisqualifyInactiveLeads(): Promise<number> {
  const leads = await getAutomationLeads();
  const now = Date.now();
  const INACTIVITY_MS = 24 * 60 * 60 * 1000; // 24 horas
  let disqualifiedCount = 0;

  for (const lead of leads) {
    // Apenas leads ativos em espera: 'sent' (aguardando 1ª resposta) ou 'chatting' (em conversa)
    if (lead.status !== 'sent' && lead.status !== 'chatting') continue;
    // Se o operador humano já assumiu, não desqualifica
    if (lead.human_takeover) continue;
    // Se já está com interesse alto, não desqualifica
    if (lead.interest_level === 'high') continue;

    // Determina o horário da última interação
    let lastInteractionTime = 0;
    if (lead.last_reply_at) {
      lastInteractionTime = new Date(lead.last_reply_at).getTime();
    } else if (lead.dispatched_at) {
      lastInteractionTime = new Date(lead.dispatched_at).getTime();
    }

    if (lastInteractionTime > 0 && (now - lastInteractionTime) >= INACTIVITY_MS) {
      const hoursInactive = Math.round((now - lastInteractionTime) / (1000 * 60 * 60));
      await updateAutomationLead(lead.phone, {
        status: 'disqualified',
        interest_level: 'none',
        qualification_notes: `Desqualificado automaticamente: parou de responder há ${hoursInactive}h.`
      });

      await addAutomationLog(
        'disqualified',
        `⏱️ Lead "${lead.company_name}" (${formatPhoneDisplay(lead.phone)}) desqualificado por inatividade (sem resposta há ${hoursInactive}h).`,
        lead.phone
      );
      disqualifiedCount++;
    }
  }

  return disqualifiedCount;
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

const BRAZIL_TZ = 'America/Sao_Paulo';

export function getBrazilDateParts(date: Date = new Date()): {
  dateStr: string;
  timeStr: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BRAZIL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const year = map.year || '2026';
  const month = map.month || '01';
  const day = map.day || '01';
  const rawHour = Number(map.hour || 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(map.minute || 0);
  const second = Number(map.second || 0);

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  const dayOfWeek = weekdayMap[map.weekday] ?? date.getDay();

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dayOfWeek,
    hour,
    minute,
    second
  };
}

export function isSameBrazilDay(isoString?: string, targetDateStr?: string): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return false;
  const refDateStr = targetDateStr || getBrazilDateParts().dateStr;
  return getBrazilDateParts(d).dateStr === refDateStr;
}

function getSecondsUntilNextBrazilHour(targetHourStr: string, forceNextDay = false): {
  diffSec: number;
  scheduledIso: string;
} {
  const now = new Date();
  const br = getBrazilDateParts(now);
  const [targetH, targetM] = (targetHourStr || '09:00').split(':').map(Number);
  const targetTotalSec = (targetH || 9) * 3600 + (targetM || 0) * 60;
  const currentTotalSec = br.hour * 3600 + br.minute * 60 + br.second;

  let diffSec = targetTotalSec - currentTotalSec;
  if (forceNextDay || diffSec <= 0) {
    diffSec += 24 * 3600;
  }
  const scheduledDate = new Date(now.getTime() + diffSec * 1000);
  return {
    diffSec: Math.max(0, diffSec),
    scheduledIso: scheduledDate.toISOString()
  };
}

/**
 * Calcula a programação exata do próximo disparo automático (sempre no fuso horário de Brasília)
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
  const brNow = getBrazilDateParts(now);
  const currentHour = brNow.timeStr;
  const currentDay = brNow.dayOfWeek; // 0 = Domingo, 6 = Sábado

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
    const { diffSec, scheduledIso } = getSecondsUntilNextBrazilHour(settings.start_hour, isAfterEnd);
    return {
      status: 'outside_hours',
      scheduled_at: scheduledIso,
      formatted_time: `${settings.start_hour}:00`,
      countdown_seconds: diffSec,
      reason: `Fora do expediente comercial (${settings.start_hour} às ${settings.end_hour}). Próximo início às ${settings.start_hour}.`,
      is_window_active: false,
      next_lead: nextLead,
      currently_typing: null
    };
  }

  // 4. Limite Diário Atingido
  const dailyTarget = settings.daily_limit || 10;
  if (metrics.dispatchedToday >= dailyTarget) {
    const { diffSec, scheduledIso } = getSecondsUntilNextBrazilHour(settings.start_hour, true);
    return {
      status: 'limit_reached',
      scheduled_at: scheduledIso,
      formatted_time: `Amanhã às ${settings.start_hour}`,
      countdown_seconds: diffSec,
      reason: `Meta diária de ${dailyTarget} mensagens atingida hoje. Próximo ciclo amanhã às ${settings.start_hour}.`,
      is_window_active: false,
      next_lead: nextLead,
      currently_typing: null
    };
  }

  // 5. Cálculo do intervalo anti-ban baseado no último disparo (verificado antes de fila vazia)
  const dispatchedLeads = leads
    .filter(l => Boolean(l.dispatched_at))
    .sort((a, b) => new Date(b.dispatched_at!).getTime() - new Date(a.dispatched_at!).getTime());

  const lastDispatched = dispatchedLeads[0];
  const minIntervalSec = Math.max(1, (settings.min_interval_mins || 15) * 60);
  const maxIntervalSec = Math.max(minIntervalSec, (settings.max_interval_mins || 35) * 60);
  const avgIntervalSec = Math.round((minIntervalSec + maxIntervalSec) / 2);

  if (lastDispatched && lastDispatched.dispatched_at) {
    const lastTime = new Date(lastDispatched.dispatched_at).getTime();
    const nextTimeMs = lastTime + (avgIntervalSec * 1000);
    const remainingSec = Math.round((nextTimeMs - now.getTime()) / 1000);

    if (remainingSec > 0) {
      const scheduledDate = new Date(nextTimeMs);
      const timeStr = scheduledDate.toLocaleTimeString('pt-BR', {
        timeZone: BRAZIL_TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
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

  // 6. Fila Vazia (intervalo já cumprido -> pronto para minerar os 10 leads do dia e disparar)
  if (pendingLeads.length === 0) {
    return {
      status: 'queue_empty',
      scheduled_at: now.toISOString(),
      formatted_time: 'Minerando leads...',
      countdown_seconds: 0,
      reason: `Fila de leads vazia. O robô minerará automaticamente até ${dailyTarget - metrics.dispatchedToday} leads no Google para disparar.`,
      is_window_active: true,
      next_lead: null,
      currently_typing: null
    };
  }

  // 7. Pronto para disparar imediatamente
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
 * Calcula as métricas consolidadas de hoje no fuso de Brasília (garantindo precisão em nuvem/Vercel e local)
 */
export async function getAutomationMetrics(): Promise<AutomationMetrics> {
  const leads = await getAutomationLeads();
  const todayStr = getBrazilDateParts().dateStr;

  const minedToday = leads.filter(l => isSameBrazilDay(l.created_at, todayStr)).length;
  const dispatchedToday = leads.filter(l => isSameBrazilDay(l.dispatched_at, todayStr)).length;
  // Considera resposta se tem data de resposta hoje OU se o status foi alterado para em conversa/qualificado
  const repliesToday = leads.filter(l => {
    const hasReplyDateToday = isSameBrazilDay(l.last_reply_at, todayStr);
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

const gAuto = globalThis as any;

/**
 * Executa um ciclo completo do robô autônomo:
 * 1. Sincroniza mensagens recebidas (inbound) para resposta automática da IA SDR 24/7.
 * 2. Verifica regras de horário comercial (fuso de Brasília) e meta diária (10 leads/dia).
 * 3. Se a fila estiver vazia (ou sem leads suficientes para os 10 do dia), minera automaticamente até 10 leads no Google.
 * 4. Quando o intervalo anti-ban zerar, despacha o próximo lead sem precisar abrir o app.
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
  if (gAuto.__isAutomationCycleRunning) {
    return { executed: false, message: 'Ciclo de automação já em andamento.' };
  }
  gAuto.__isAutomationCycleRunning = true;
  try {
    const result = await executeAutomationCycleInternal(options);
    return result;
  } finally {
    gAuto.__isAutomationCycleRunning = false;
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

  // 0. Sincroniza mensagens recebidas no WhatsApp e avalia inatividade de leads (> 24h)
  try {
    const { syncInboundWhatsAppMessages } = await import('./aiSdr');
    await syncInboundWhatsAppMessages();
    await checkAndDisqualifyInactiveLeads();
  } catch {
    // Continua
  }

  const settings = await getAutomationSettings();

  if (!settings.is_active && !force) {
    return { executed: false, message: 'Automação pausada pelo operador.' };
  }

  const brNow = getBrazilDateParts();
  const currentHour = brNow.timeStr;
  const currentDay = brNow.dayOfWeek; // 0 = Domingo, 6 = Sábado

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

  let metrics = await getAutomationMetrics();
  const dailyTarget = settings.daily_limit || 10;

  // 3. Verificação de cota diária (padrão: 10 disparos por dia)
  if (!force && metrics.dispatchedToday >= dailyTarget) {
    return { 
      executed: false, 
      message: `Limite diário atingido (${metrics.dispatchedToday}/${dailyTarget} disparos hoje). Próximos disparos amanhã.` 
    };
  }

  let leads = await getAutomationLeads();
  let pendingLeads = leads.filter(l => l.status === 'pending' && !isBlacklistedPhone(l.phone));
  let searchedCount = 0;

  // 4. Mineração automática para garantir os 10 leads do dia quando a fila estiver vazia
  const remainingQuotaToday = Math.max(0, dailyTarget - metrics.dispatchedToday);
  const lastEmptySearchAt = gAuto.__lastEmptySearchTimestamp || 0;
  const canSearchNow = force || (Date.now() - lastEmptySearchAt >= 60000);

  if (pendingLeads.length === 0 && !skipSearch && !targetLeadId && (remainingQuotaToday > 0 || force) && canSearchNow) {
    try {
      const targetBatchSize = force && remainingQuotaToday === 0 ? 10 : Math.min(10, Math.max(1, remainingQuotaToday));
      const segments = settings.target_segments.length > 0 
        ? settings.target_segments 
        : DEFAULT_AUTOMATION_SETTINGS.target_segments;
      const cities = settings.target_cities.length > 0 
        ? settings.target_cities 
        : DEFAULT_AUTOMATION_SETTINGS.target_cities;

      const existingPhones = new Set(leads.map(l => toDialablePhone(l.phone)));
      const freshLeadsToInsert: AutomationLead[] = [];
      const triedCombinations = new Set<string>();

      // Tenta até 3 combinações de segmento/cidade para atingir os 10 leads do dia
      for (let attempt = 0; attempt < 3 && freshLeadsToInsert.length < targetBatchSize; attempt++) {
        const chosenSegment = segments[Math.floor(Math.random() * segments.length)];
        const chosenCity = cities[Math.floor(Math.random() * cities.length)];
        const comboKey = `${chosenSegment}|${chosenCity}`;
        if (triedCombinations.has(comboKey) && segments.length * cities.length > 1) {
          continue;
        }
        triedCombinations.add(comboKey);

        await addAutomationLog('search', `🔍 Minerando leads no Google (${freshLeadsToInsert.length}/${targetBatchSize}): "${chosenSegment}" em "${chosenCity}"...`);

        const serpResult = await scrapeSerpAPI(chosenSegment, chosenCity, 'Brasil');
        const validLeads = await filterLeadsWithWhatsApp(serpResult.leads);

        for (const scraped of validLeads) {
          if (!scraped.whatsapp) continue;
          const norm = toDialablePhone(scraped.whatsapp);
          if (!norm || existingPhones.has(norm) || isBlacklistedPhone(norm) || isBlacklistedPhone(scraped.whatsapp) || isWhatsAppGroup(norm) || isWhatsAppGroup(scraped.whatsapp)) {
            continue;
          }

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
          if (freshLeadsToInsert.length >= targetBatchSize) break;
        }
      }

      if (freshLeadsToInsert.length > 0) {
        gAuto.__lastEmptySearchTimestamp = 0;
        searchedCount = freshLeadsToInsert.length;
        inMemoryLeads = [...freshLeadsToInsert, ...inMemoryLeads];
        await saveLeadsToSupabaseWithRetry(freshLeadsToInsert);

        await addAutomationLog('search', `✅ ${searchedCount} novos leads qualificados e enfileirados para a meta diária (${dailyTarget}/dia).`);
        leads = await getAutomationLeads();
        pendingLeads = leads.filter(l => l.status === 'pending' && !isBlacklistedPhone(l.phone));
        metrics = await getAutomationMetrics();
      } else {
        gAuto.__lastEmptySearchTimestamp = Date.now();
        await addAutomationLog('system', `Nenhum novo lead inédito encontrado nesta varredura. Tentará novamente em 1 minuto.`);
      }
    } catch (searchErr: any) {
      gAuto.__lastEmptySearchTimestamp = Date.now();
      console.error('[Automation] Erro na busca automática:', searchErr);
      await addAutomationLog('error', `Falha na busca do Google: ${searchErr.message || 'Erro desconhecido'}`);
    }
  }

  // 5. Se não houver lead para disparar agora
  if (pendingLeads.length === 0 && !targetLeadId) {
    return {
      executed: searchedCount > 0,
      actionTaken: searchedCount > 0 ? 'searched_only' : 'idle',
      message: searchedCount > 0 
        ? `Busca realizada com sucesso (${searchedCount} leads), mas nenhum pronto para disparo imediato.` 
        : 'Fila de leads pendentes vazia no momento.'
    };
  }

  // 6. Em execuções automáticas (!force), respeita estritamente o intervalo anti-ban entre disparos
  if (!force) {
    const lastFailedAt = gAuto.__lastFailedDispatchTimestamp || 0;
    if (Date.now() - lastFailedAt < 30000) {
      return {
        executed: searchedCount > 0,
        actionTaken: searchedCount > 0 ? 'searched_only' : 'idle',
        message: 'Aguardando 30s para retentar conexão com o microserviço WhatsApp.'
      };
    }

    const schedule = calculateNextDispatchSchedule(settings, leads, metrics);
    if (schedule.status === 'typing') {
      return {
        executed: false,
        actionTaken: 'idle',
        message: schedule.reason
      };
    }
    if (schedule.status === 'active' && schedule.countdown_seconds > 0) {
      return {
        executed: searchedCount > 0,
        actionTaken: searchedCount > 0 ? 'searched_only' : 'idle',
        message: searchedCount > 0
          ? `${searchedCount} leads minerados! Próximo disparo agendado para ${schedule.formatted_time} (${schedule.countdown_seconds}s).`
          : `Aguardando intervalo anti-ban (${schedule.countdown_seconds}s até ${schedule.formatted_time}).`
      };
    }
  }

  // 7. Realiza o disparo do próximo lead da fila ou do lead alvo solicitado
  const nextLead = targetLeadId 
    ? (leads.find(l => l.id === targetLeadId) || pendingLeads.find(l => l.id === targetLeadId) || pendingLeads[0])
    : pendingLeads[0];

  if (!nextLead) {
    return {
      executed: false,
      message: 'Nenhum lead disponível para disparo no momento.'
    };
  }

  if (targetLeadId && force) {
    // Forçar disparo de teste explicitamente solicitado pelo operador para este lead
    removePhoneFromBlacklist(nextLead.phone);
    await clearWhatsAppQueue(nextLead.phone).catch(() => {});
  } else if (nextLead.status !== 'pending' || nextLead.dispatched_at || isBlacklistedPhone(nextLead.phone)) {
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
    const sendResult = await sendWhatsAppHumanBubbles(
      {
        phone: nextLead.phone,
        message: messageToSend,
        is_reply: false
      },
      async (bubbleText, index, total) => {
        await addAutomationMessage(nextLead.phone, 'outbound', 'ai', bubbleText);
        await addAutomationLog('dispatch', `🚀 Disparo inicial [${index + 1}/${total}] enviado para ${nextLead.company_name}: "${bubbleText}"`, nextLead.phone);
      }
    );

    if (sendResult.success || sendResult.queued) {
      gAuto.__lastFailedDispatchTimestamp = 0;
      await addAutomationLog('dispatch', `✅ Disparo ${metrics.dispatchedToday + 1}/${dailyTarget} efetuado com sucesso para ${nextLead.company_name}.`, nextLead.phone);

      return {
        executed: true,
        actionTaken: searchedCount > 0 ? 'searched_and_dispatched' : 'dispatched_only',
        message: `Disparo ${metrics.dispatchedToday + 1}/${dailyTarget} efetuado com sucesso para ${nextLead.company_name}!`,
        leadDispatched: { ...nextLead, status: 'sent', dispatched_at: nowIso }
      };
    } else {
      gAuto.__lastFailedDispatchTimestamp = Date.now();
      nextLead.status = 'pending';
      nextLead.dispatched_at = undefined;
      await updateAutomationLead(nextLead.phone, {
        status: 'pending',
        dispatched_at: null as any
      });
      await addAutomationLog('error', `Falha ao disparar para ${nextLead.company_name}: ${sendResult.error || sendResult.message || 'Erro no WhatsApp Service'}`, nextLead.phone);
      return {
        executed: false,
        message: `Erro no serviço WhatsApp: ${sendResult.error || sendResult.message}`
      };
    }
  } catch (sendErr: any) {
    gAuto.__lastFailedDispatchTimestamp = Date.now();
    nextLead.status = 'pending';
    nextLead.dispatched_at = undefined;
    await updateAutomationLead(nextLead.phone, {
      status: 'pending',
      dispatched_at: null as any
    });
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
 * Monitora continuamente o agendamento e executa a mineração dos 10 leads diários
 * e o disparo pontualmente assim que o contador atinge zero, sem depender de abrir o app.
 */
export function ensureAutomationWorkerRunning() {
  if (gAuto.__automationWorkerTimer) return;

  console.log('[Automation Worker] 🚀 Inicializando motor autônomo 24/7 de mineração, disparos e escuta de IA...');
  gAuto.__automationWorkerTimer = setInterval(async () => {
    if (gAuto.__isAutomationWorkerExecuting) return;
    try {
      gAuto.__isAutomationWorkerExecuting = true;

      // 1. Sincroniza mensagens recebidas (inbound) do microserviço WhatsApp (mesmo com robô de prospecção pausado)
      try {
        const { syncInboundWhatsAppMessages } = await import('./aiSdr');
        await syncInboundWhatsAppMessages();
      } catch {
        // Ignora silenciosamente se microserviço estiver offline
      }

      // 2. Avalia próximo disparo ativo ou mineração de prospecção
      const settings = await getAutomationSettings();
      if (!settings.is_active) {
        return;
      }

      const leads = await getAutomationLeads();
      const metrics = await getAutomationMetrics();
      const schedule = calculateNextDispatchSchedule(settings, leads, metrics);
      
      // Se estiver pronto para disparar, fila vazia na janela ativa, ou o contador zerou
      if (
        schedule.status === 'ready_now' ||
        schedule.status === 'queue_empty' ||
        (schedule.status === 'active' && schedule.countdown_seconds <= 0)
      ) {
        const result = await runAutomationCycle(false);
        if (result.executed) {
          console.log(`[Automation Worker] ✅ Ação automática efetuada: ${result.message}`);
        }
      }
    } catch (err: any) {
      console.error('[Automation Worker] Erro no ciclo de disparo:', err?.message || err);
    } finally {
      gAuto.__isAutomationWorkerExecuting = false;
    }
  }, 4000);
}

// Inicializa automaticamente no carregamento do módulo no servidor
if (typeof window === 'undefined') {
  ensureAutomationWorkerRunning();
}


