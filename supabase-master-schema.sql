-- ==============================================================================
-- LEADCORE // SCRIPT SQL MESTRE COMPLETO E IDEMPOTENTE (SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/ajufeobrlxxtucoqnhym/sql/new
--
-- Contém:
-- 1. whatsapp_logs        -> Histórico de disparos de campanhas e status de entrega
-- 2. automation_settings  -> Configurações globais do robô (horários, IA, limites)
-- 3. automation_leads     -> Pipeline e status do Kanban (Pendente, Qualificado, etc.)
-- 4. automation_messages  -> Histórico de conversas do chat (IA SDR e Takeover Humano)
-- 5. automation_logs      -> Console de auditoria em tempo real da automação
-- 6. Migrações e Adição de Colunas Garantidas (caso tabelas já existam)
-- 7. Políticas de Segurança RLS (Leitura e Escrita Liberadas para a Aplicação)
-- 8. Ativação do Supabase Realtime (Atualização ao vivo sem refresh)
-- ==============================================================================

-- ==============================================================================
-- 1. TABELA DE LOGS DE DISPARO DO WHATSAPP (CAMPANHAS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    lead_name VARCHAR(255),
    company VARCHAR(255),
    city VARCHAR(100),
    category VARCHAR(100),
    message TEXT NOT NULL,
    media_url TEXT,
    status VARCHAR(30) DEFAULT 'queued' NOT NULL, -- 'queued', 'typing', 'sent', 'failed', 'limit_reached'
    queue_id VARCHAR(100),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_logs(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON public.whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);

-- ==============================================================================
-- 2. TABELA DE CONFIGURAÇÕES GLOBAIS DA AUTOMAÇÃO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN DEFAULT false,
    daily_limit INT DEFAULT 10,
    start_hour VARCHAR(5) DEFAULT '09:00',
    end_hour VARCHAR(5) DEFAULT '17:30',
    work_days_only BOOLEAN DEFAULT true,
    min_interval_mins INT DEFAULT 25,
    max_interval_mins INT DEFAULT 50,
    target_segments TEXT[] DEFAULT ARRAY['Tratamento de Água', 'Laticínios', 'Indústria Química', 'Curtume', 'Têxtil', 'Frigorífico'],
    target_cities TEXT[] DEFAULT ARRAY['São Paulo, SP', 'Campinas, SP', 'Sorocaba, SP', 'Ribeirão Preto, SP', 'São José dos Campos, SP'],
    initial_message_template TEXT DEFAULT 'Olá, tudo bem? Notei que a {empresa} atua no setor de {segmento} em {cidade}. Vocês utilizam sal industrial no processo produtivo ou tratamento?',
    ai_provider VARCHAR(50) DEFAULT 'gemini',
    ai_api_key TEXT DEFAULT '',
    ai_model VARCHAR(50) DEFAULT 'gemini-3.5-flash-lite',
    ai_prompt TEXT DEFAULT 'Você é o especialista comercial da LeadCore Sal Industrial. Seu objetivo é descobrir de forma amigável e profissional se a empresa utiliza sal industrial (grosso, moído, refinado ou micronizado), qual a estimativa de consumo mensal e se tem interesse em receber uma cotação direta da distribuidora. Seja conciso (máximo 2 a 3 frases por mensagem). Quando o cliente demonstrar interesse ou pedir preços, agradeça e avise que nosso consultor comercial entrará em contato com a tabela personalizada.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrações garantidas se a tabela já existia com schema antigo
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS work_days_only BOOLEAN DEFAULT true;
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS min_interval_mins INT DEFAULT 25;
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS max_interval_mins INT DEFAULT 50;
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50) DEFAULT 'gemini-3.5-flash-lite';
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'gemini';
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS ai_api_key TEXT DEFAULT '';
ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS ai_prompt TEXT DEFAULT 'Você é o especialista comercial da LeadCore Sal Industrial.';

-- Inserir registro inicial padrão se não existir nenhum
INSERT INTO public.automation_settings (is_active, daily_limit, start_hour, end_hour, ai_model)
SELECT false, 10, '09:00', '17:30', 'gemini-3.5-flash-lite'
WHERE NOT EXISTS (SELECT 1 FROM public.automation_settings);

-- ==============================================================================
-- 3. TABELA DO PIPELINE DE LEADS DA AUTOMAÇÃO (KANBAN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.automation_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL UNIQUE,
    city VARCHAR(100),
    state VARCHAR(50),
    segment VARCHAR(100),
    source VARCHAR(50) DEFAULT 'google_serpapi',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'chatting', 'qualified', 'disqualified', 'no_reply'
    interest_level VARCHAR(20) DEFAULT 'unknown', -- 'high', 'medium', 'none', 'unknown'
    qualification_notes TEXT,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    last_reply_at TIMESTAMP WITH TIME ZONE,
    human_takeover BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migrações garantidas se a tabela já existia
ALTER TABLE public.automation_leads ADD COLUMN IF NOT EXISTS human_takeover BOOLEAN DEFAULT false;
ALTER TABLE public.automation_leads ADD COLUMN IF NOT EXISTS interest_level VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE public.automation_leads ADD COLUMN IF NOT EXISTS qualification_notes TEXT;
ALTER TABLE public.automation_leads ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.automation_leads ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_automation_leads_phone ON public.automation_leads(phone);
CREATE INDEX IF NOT EXISTS idx_automation_leads_status ON public.automation_leads(status);
CREATE INDEX IF NOT EXISTS idx_automation_leads_created_at ON public.automation_leads(created_at DESC);

-- ==============================================================================
-- 4. TABELA DE HISTÓRICO DE MENSAGENS DO CHAT COM IA SDR
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.automation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_phone VARCHAR(30) NOT NULL,
    direction VARCHAR(20) NOT NULL, -- 'inbound' (recebida do lead), 'outbound' (enviada pelo sistema)
    sender VARCHAR(20) NOT NULL, -- 'lead', 'ai', 'human'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_messages_lead_phone ON public.automation_messages(lead_phone);
CREATE INDEX IF NOT EXISTS idx_automation_messages_created_at ON public.automation_messages(created_at ASC);

-- ==============================================================================
-- 5. TABELA DE LOGS DO ROBÔ DA AUTOMAÇÃO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- 'search', 'dispatch', 'reply', 'qualified', 'disqualified', 'system', 'error'
    details TEXT NOT NULL,
    lead_phone VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON public.automation_logs(created_at DESC);

-- ==============================================================================
-- 6. HABILITAÇÃO DE SEGURANÇA (RLS) E POLÍTICAS DE ACESSO
-- ==============================================================================
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para whatsapp_logs
DROP POLICY IF EXISTS "Permitir leitura pública/anon para logs" ON public.whatsapp_logs;
CREATE POLICY "Permitir leitura pública/anon para logs" ON public.whatsapp_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir inserção pública/anon para logs" ON public.whatsapp_logs;
CREATE POLICY "Permitir inserção pública/anon para logs" ON public.whatsapp_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização pública/anon para logs" ON public.whatsapp_logs;
CREATE POLICY "Permitir atualização pública/anon para logs" ON public.whatsapp_logs FOR UPDATE TO anon, authenticated USING (true);

-- Políticas para automação
DROP POLICY IF EXISTS "Acesso total settings" ON public.automation_settings;
CREATE POLICY "Acesso total settings" ON public.automation_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total leads" ON public.automation_leads;
CREATE POLICY "Acesso total leads" ON public.automation_leads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total messages" ON public.automation_messages;
CREATE POLICY "Acesso total messages" ON public.automation_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total logs" ON public.automation_logs;
CREATE POLICY "Acesso total logs" ON public.automation_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. HABILITAR SUPABASE REALTIME (ATUALIZAÇÃO AO VIVO SEM REFRESH)
-- ==============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_leads;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
