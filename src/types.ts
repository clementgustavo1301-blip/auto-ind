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

export type AutomationLeadStatus = 'pending' | 'sent' | 'chatting' | 'qualified' | 'disqualified' | 'no_reply';
export type InterestLevel = 'high' | 'medium' | 'none' | 'unknown';

export interface AutomationSettings {
  id?: string;
  is_active: boolean;
  daily_limit: number;
  start_hour: string;
  end_hour: string;
  work_days_only: boolean;
  min_interval_mins: number;
  max_interval_mins: number;
  target_segments: string[];
  target_cities: string[];
  initial_message_template: string;
  ai_provider: 'gemini' | 'openai' | 'groq' | 'heuristic';
  ai_api_key?: string;
  ai_model?: string;
  ai_prompt?: string;
  profile?: 'gustavo' | 'sergio' | 'custom';
}

export interface AutomationLead {
  id: string;
  company_name: string;
  phone: string;
  city?: string;
  state?: string;
  segment?: string;
  source?: string;
  status: AutomationLeadStatus;
  interest_level: InterestLevel;
  qualification_notes?: string;
  dispatched_at?: string;
  last_reply_at?: string;
  human_takeover: boolean;
  created_at: string;
}

export interface AutomationMessage {
  id: string;
  lead_phone: string;
  direction: 'inbound' | 'outbound';
  sender: 'lead' | 'ai' | 'human';
  content: string;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  event_type: 'search' | 'dispatch' | 'reply' | 'qualified' | 'disqualified' | 'system' | 'error';
  details: string;
  lead_phone?: string;
  created_at: string;
}

export interface AutomationMetrics {
  minedToday: number;
  dispatchedToday: number;
  repliesToday: number;
  qualifiedToday: number;
  disqualifiedToday: number;
  pendingInQueue: number;
  totalInPipeline: number;
}
