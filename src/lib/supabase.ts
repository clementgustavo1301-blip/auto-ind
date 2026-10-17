import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface WhatsAppLog {
  id?: string;
  created_at?: string;
  phone: string;
  lead_name?: string;
  company?: string;
  city?: string;
  category?: string;
  message: string;
  media_url?: string;
  status: 'queued' | 'typing' | 'sent' | 'failed' | 'limit_reached';
  queue_id?: string;
  error_message?: string;
  sent_at?: string;
}

/**
 * Salva um novo registro de log no Supabase
 */
export async function insertWhatsAppLog(log: WhatsAppLog): Promise<WhatsAppLog | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('whatsapp_logs')
      .insert([
        {
          phone: log.phone,
          lead_name: log.lead_name || null,
          company: log.company || null,
          city: log.city || null,
          category: log.category || null,
          message: log.message,
          media_url: log.media_url || null,
          status: log.status,
          queue_id: log.queue_id || null,
          error_message: log.error_message || null,
          sent_at: log.sent_at || (log.status === 'sent' ? new Date().toISOString() : null),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir log no Supabase:', error.message);
      return null;
    }
    return data as WhatsAppLog;
  } catch (err) {
    console.error('Falha de conexão com Supabase:', err);
    return null;
  }
}

/**
 * Atualiza o status de um log no Supabase pelo queue_id ou telefone
 */
export async function updateWhatsAppLogStatus(
  queueId: string,
  status: 'queued' | 'typing' | 'sent' | 'failed' | 'limit_reached',
  errorMessage?: string
): Promise<boolean> {
  if (!supabase || !queueId) return false;
  try {
    const updateData: any = {
      status,
      error_message: errorMessage || null,
    };
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('whatsapp_logs')
      .update(updateData)
      .eq('queue_id', queueId);

    if (error) {
      console.error('Erro ao atualizar status do log no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Falha ao atualizar log no Supabase:', err);
    return false;
  }
}

/**
 * Lista os logs gravados com filtros opcionais
 */
export async function getWhatsAppLogs(options?: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<WhatsAppLog[]> {
  if (!supabase) return [];
  try {
    let query = supabase
      .from('whatsapp_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50);

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      const s = `%${options.search}%`;
      query = query.or(`phone.ilike.${s},lead_name.ilike.${s},company.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao consultar logs no Supabase:', error.message);
      return [];
    }
    return (data || []) as WhatsAppLog[];
  } catch (err) {
    console.error('Falha ao consultar logs do Supabase:', err);
    return [];
  }
}
