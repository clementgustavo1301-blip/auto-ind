# Sistema de Cadência Diária e Qualificação de Leads com IA (LeadCore SDR)

## 📌 Visão Geral da Funcionalidade
Automatizar o ciclo completo de prospecção outbound e qualificação comercial sem necessidade de intervenção manual:
1. **Lead Hunter 100% Automático:** Todo dia, no horário configurado, o sistema consulta a API do Google (SerpAPI / Google Maps) com base nos segmentos e localidades configurados, filtra números com WhatsApp ativo e abastece a fila.
2. **Cadência Ativa Paced (10 disparos/dia):** O robô distribui os 10 disparos ao longo do expediente comercial (09:00 às 17:30) com intervalos aleatórios anti-ban e simulação de digitação humana.
3. **Nova Aba "Automação & IA SDR":** Painel visual no LeadCore com switch master (Ligar/Desligar robô), personalização completa dos parâmetros (cidades, nichos, horários, cota diária), logs ao vivo de execução e Kanban de leads qualificados.
4. **SDR com IA Conversacional (Two-Way WhatsApp):** O microserviço em Go escuta quando o lead responde, notifica o webhook do Next.js e a IA (Gemini) dialoga contextualmente para qualificar se a empresa consome sal industrial, volume e interesse em cotação.
5. **Human Handoff & Alerta Comercial:** Notificação visual em tempo real no painel e no Kanban com tag `🔥 QUALIFICADO`, permitindo ao operador assumir a conversa no WhatsApp em 1 clique.

---

## 🏗️ Arquitetura do Sistema

```mermaid
graph TD
    subgraph "Nuvem / Servidor Next.js"
        A[Cron / Scheduler Autônomo] -->|Horário do Ciclo| B[Lead Hunter: API Google / SerpAPI]
        B -->|Filtra Celular & Deduplica| C[(Supabase: leads_cadence)]
        C -->|Pega próximo lead pendente| D[Fila de Disparo Paced]
    end

    subgraph "Celular / Microserviço Go (Termux ou PC)"
        D -->|HTTP POST /api/send| E[whatsapp-service Go]
        E -->|Digitação Humana + Anti-Ban| F[WhatsApp Lead]
        F -->|Lead Responde Mensagem| E
        E -->|Webhook POST *events.Message| G[/api/whatsapp/webhook Next.js]
    end

    subgraph "Inteligência & Painel do Usuário"
        G --> H[Agente IA SDR: Gemini]
        H -->|Gera Resposta & Classifica| I[(Supabase: Mensagens & Status)]
        I -->|Se Lead Interessado| J[Aba Automação: Alerta 🔥 & Kanban]
        I -->|Continua Diálogo| E
        J -->|Operador assume se desejar| K[Chat Manual / Handoff]
    end
```

---

## 🎛️ Especificação da Nova Aba: "Automação & IA SDR"

A nova aba será integrada ao menu superior do LeadCore (`Busca Local`, `Indústrias & Sal`, `Disparos WhatsApp`, `Automação & IA SDR`):

### 1. Header de Controle Master
- **Chave Liga/Desliga Geral:** Status visual `● ROBÔ ATIVO` (verde) ou `○ ROBÔ EM PAUSA` (cinza).
- **Indicador do Próximo Ciclo:** Ex: *"Próxima busca automática: Amanhã às 08:30"* | *"Próximo disparo: Hoje às 11:42 (4/10 realizados)"*.
- **Botão "Executar Ciclo Agora":** Para disparar o processo imediatamente caso o operador deseje testar sem esperar o horário.

### 2. Bloco de Configurações da Automação (Editáveis pelo Usuário)
- **Critérios da Busca Automática (Alimentação da Fila):**
  - **API do Google (SerpAPI):** Ativa com chave cadastrada no sistema.
  - **Segmentos/Categorias Alvo:** Ex: *Tratamento de Água, Laticínios, Indústria Têxtil, Frigoríficos, Curtumes, Indústria Química*.
  - **Regiões/Cidades Alvo:** Ex: *São Paulo (Grande SP), Campinas, Sorocaba, Vale do Paraíba*.
  - **Filtro Anti-Fixo:** Rejeita automaticamente números fixos e foca em telefones com WhatsApp validado.
  - **Deduplicação Automática:** Nunca busca nem dispara para um lead já contatado nos últimos 90 dias.
- **Regras de Disparo Diário:**
  - **Limite Diário:** Padrão `10 disparos/dia` (ajustável de 1 a 20).
  - **Janela de Horário:** Início (ex: `09:00`) e Fim (ex: `17:30`).
  - **Dias de Operação:** Apenas dias úteis (Segunda a Sexta) ou Todos os dias.
  - **Intervalo Médio entre Disparos:** 20 a 45 minutos (com variação randômica humana).
- **Comportamento da IA SDR:**
  - **Mensagem Inicial:** Template com substituição dinâmica (`{empresa}`, `{cidade}`, `{aplicacao}`).
  - **Objetivo da IA:** Qualificar se consomem sal grosso, moído ou refinado; volume mensal estimado; transferir para operador.

### 3. Métricas e Kanban de Qualificação em Tempo Real
- **Contadores do Dia:**
  - `Leads Minerados Hoje` (ex: 10)
  - `Disparos Efetuados` (ex: 6/10)
  - `Respostas Recebidas` (ex: 3)
  - `Qualificados com Interesse 🔥` (ex: 2)
  - `Sem Interesse / Incompatíveis ❌` (ex: 1)
- **Kanban Interativo dos Leads do Mês:**
  - Coluna 1: `Na Fila do Robô`
  - Coluna 2: `Disparado (Aguardando Lead)`
  - Coluna 3: `Em Atendimento IA`
  - Coluna 4: `🔥 Qualificado (Interesse)`
  - Coluna 5: `❌ Sem Interesse`
  - *Ao clicar em qualquer lead, abre o chat completo com histórico e botão "Assumir Conversa".*

### 4. Console de Logs do Robô
- Linha do tempo com carimbo de data e hora:
  - `09:00:12` - 🤖 *Robô acordou: Buscou 10 leads industriais em Campinas/SP via Google API.*
  - `09:00:25` - 📋 *10 leads deduplicados e enfileirados.*
  - `09:35:10` - ✉️ *Disparo 1/10 enviado para Indústria Láctea XYZ (WhatsApp).*
  - `10:12:04` - 💬 *Resposta recebida de Indústria Láctea XYZ: "Bom dia, qual o preço do saco de 25kg?"*
  - `10:12:15` - 🤖 *IA SDR respondeu e qualificou lead como: INTERESSE ALTO.*

---

## 🗄️ Estrutura de Banco de Dados (Supabase)

### 1. Tabela `automation_settings` (Configuração Global do Robô)
```sql
CREATE TABLE IF NOT EXISTS public.automation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN DEFAULT false,
    daily_limit INT DEFAULT 10,
    start_hour VARCHAR(5) DEFAULT '09:00',
    end_hour VARCHAR(5) DEFAULT '17:30',
    work_days_only BOOLEAN DEFAULT true,
    target_segments TEXT[] DEFAULT ARRAY['Tratamento de Água', 'Laticínios', 'Química'],
    target_cities TEXT[] DEFAULT ARRAY['São Paulo, SP', 'Campinas, SP'],
    initial_message_template TEXT DEFAULT 'Olá, tudo bem? Notei que a {empresa} atua no segmento de {segmento} em {cidade}. Vocês utilizam sal industrial no processo produtivo?',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 2. Tabela `automation_leads` (Pipeline de Leads da Automação)
```sql
CREATE TABLE IF NOT EXISTS public.automation_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL UNIQUE,
    city VARCHAR(100),
    state VARCHAR(50),
    segment VARCHAR(100),
    source VARCHAR(50) DEFAULT 'google_serpapi',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'chatting', 'qualified', 'disqualified', 'no_reply'
    interest_level VARCHAR(20) DEFAULT 'unknown', -- 'high', 'medium', 'none'
    dispatched_at TIMESTAMP WITH TIME ZONE,
    last_reply_at TIMESTAMP WITH TIME ZONE,
    human_takeover BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3. Tabela `automation_logs` (Histórico de Auditoria do Robô)
```sql
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- 'search_completed', 'message_sent', 'reply_received', 'lead_qualified', 'error'
    details TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

---

## 🔧 Plano de Implementação em 4 Fases

- **Fase 1: Engine de Escuta & Webhook no `whatsapp-service` (Go)**
  - Adicionar interceptação de `*events.Message` no `whatsapp-service/main.go`.
  - Disparar requisição HTTP POST para o webhook Next.js com telefone, texto e timestamp.
- **Fase 2: Motor de Qualificação IA & Webhook no Next.js**
  - Rota `/api/whatsapp/webhook`: recebe a mensagem, registra no Supabase, consulta a API Gemini com o histórico e diretrizes do SDR e responde automaticamente via `/api/send`.
- **Fase 3: Scheduler Autônomo & Lead Hunter**
  - Rota `/api/automation/scheduler`: executa a busca automática diária via Google API (SerpAPI), deduplica números e dispara em cadência controlada.
- **Fase 4: Nova Aba "Automação & IA SDR" no Frontend**
  - Desenvolver o componente `AutomationDashboard.tsx` integrado em `src/app/page.tsx` no padrão Neo-Brutalista do LeadCore.
  - Switches de configuração, console de logs, métricas do dia e Kanban de leads qualificados.

