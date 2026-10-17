-- ==============================================================================
-- SCHEMA SUPABASE: TABELA DE LOGS DO WHATSAPP (EXECUTE NO SQL EDITOR DO SUPABASE)
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

-- Habilitar RLS (Row Level Security) e permitir leitura/escrita
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública/anon para logs" ON public.whatsapp_logs;
CREATE POLICY "Permitir leitura pública/anon para logs" 
ON public.whatsapp_logs FOR SELECT 
TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir inserção pública/anon para logs" ON public.whatsapp_logs;
CREATE POLICY "Permitir inserção pública/anon para logs" 
ON public.whatsapp_logs FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de status pública/anon para logs" ON public.whatsapp_logs;
CREATE POLICY "Permitir atualização de status pública/anon para logs" 
ON public.whatsapp_logs FOR UPDATE 
TO anon, authenticated 
USING (true);

-- Índices para buscas ultrarrápidas
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_logs(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON public.whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);
