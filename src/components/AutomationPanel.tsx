'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Settings as SettingsIcon, 
  Bot, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  UserCheck, 
  Clock, 
  Sparkles, 
  Terminal, 
  Sliders, 
  MessageSquare, 
  Building2, 
  MapPin, 
  ExternalLink, 
  X, 
  ChevronRight,
  Zap,
  Check,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Smartphone,
  ShieldAlert,
  Volume2,
  VolumeX
} from 'lucide-react';
import { 
  AutomationSettings, 
  AutomationLead, 
  AutomationLog, 
  AutomationMetrics, 
  AutomationMessage, 
  AutomationLeadStatus,
  Lead,
  IndustrialLead
} from '@/types';
import { formatPhoneDisplay, isSamePhone } from '@/lib/phone';
import { soundEngine } from '@/lib/sound-effects';
import { AUTOMATION_PROFILES } from '@/lib/automation';
export interface CopywritingPreset {
  id: string;
  category: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  template: string;
}

export const COPYWRITING_PRESETS: CopywritingPreset[] = [
  {
    id: 'curiosity_ia',
    category: 'Sites & Google/IAs',
    title: '🧠 Curiosidade Extrema (Oportunidade Google/IA)',
    badge: '94% RESPOSTAS',
    badgeColor: 'text-[#E5FF00] border-[#E5FF00] bg-[#E5FF00]/10',
    description: 'Ativa curiosidade máxima e aversão à perda ("reparei num detalhe que pode estar custando clientes").',
    template: 'Olá, tudo bem? Notei o trabalho da {empresa} no setor de {segmento} em {cidade}. Estava analisando a presença de vocês no Google e em buscas por IA (como ChatGPT) e reparei num detalhe bem pontual que pode estar custando clientes. É você quem cuida dessa parte digital por aí?'
  },
  {
    id: 'short_question',
    category: 'Quebra de Padrão',
    title: '⚡ Pergunta Curta & Inocente (Micro-Validação)',
    badge: '96% RESPOSTAS',
    badgeColor: 'text-emerald-400 border-emerald-400 bg-emerald-400/10',
    description: 'Parece um cliente real querendo contratar. O tomador de decisão responde de imediato sem desconfiar de vendas.',
    template: 'Oi, tudo bem? Vi o contato da {empresa} aqui em {cidade}. Vocês ainda estão atendendo novos clientes no segmento de {segmento} este mês?'
  },
  {
    id: 'competitor_alert',
    category: 'Competitividade & IAs',
    title: '🔍 Alerta Construtivo (Concorrência & IAs)',
    badge: '91% RESPOSTAS',
    badgeColor: 'text-amber-400 border-amber-400 bg-amber-400/10',
    description: 'Pede permissão para mandar um print de 1 minuto. Quase 100% dos empresários autorizam por receio de ficar atrás.',
    template: 'Olá! Dei uma olhada no posicionamento da {empresa} em {cidade}. Vi que alguns concorrentes de {segmento} começaram a se posicionar no topo das IAs e buscas locais recentemente. Posso te enviar um print rápido de 1 minuto do que identifiquei sobre vocês?'
  },
  {
    id: 'referral_partnership',
    category: 'Parceria & Indicação',
    title: '🤝 Indicação de Clientes & Parceria',
    badge: '89% RESPOSTAS',
    badgeColor: 'text-cyan-400 border-cyan-400 bg-cyan-400/10',
    description: 'Ativa reciprocidade porque todo empresário quer receber indicação de novos clientes.',
    template: 'Olá, equipe da {empresa}! Tudo bem? Frequentemente recebo demandas de clientes buscando serviços de {segmento} em {cidade}. Queria confirmar se vocês têm estrutura para receber novas indicações ou se o contato principal é outro?'
  },
  {
    id: 'mobile_conversion',
    category: 'Sites & Conversão',
    title: '📱 Modernização Mobile & WhatsApp',
    badge: '87% RESPOSTAS',
    badgeColor: 'text-emerald-300 border-emerald-300 bg-emerald-300/10',
    description: 'Elogia a autoridade da empresa e aponta um ponto cego no celular para converter direto no WhatsApp.',
    template: 'Olá! Estava navegando em busca de referências em {segmento} aqui em {cidade} e encontrei a {empresa}. Reparei que a experiência no celular poderia converter muito mais contatos direto no WhatsApp de vocês. Tem 2 minutinhos para eu te mostrar como?'
  },
  {
    id: 'industrial_quote',
    category: 'B2B Industrial (Sérgio)',
    title: '🏭 B2B Direto (Cotação Fabril & Insumos)',
    badge: '82% RESPOSTAS',
    badgeColor: 'text-amber-400 border-amber-400 bg-amber-400/10',
    description: 'Ideal para o perfil Sérgio ou compradores fabris. Foco direto em redução de custo por tonelada.',
    template: 'Olá, tudo bem? Notei que a {empresa} atua no setor de {segmento} em {cidade}. Vocês utilizam sal industrial ou insumos químicos no processo produtivo? Tenho uma cotação direta de fábrica para comparar custos.'
  }
];

interface AutomationPanelProps {
  initialLeads?: (Lead | IndustrialLead)[];
}

export function AutomationPanel({ initialLeads = [] }: AutomationPanelProps) {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [leads, setLeads] = useState<AutomationLead[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isCycling, setIsCycling] = useState(false);
  const [cycleFeedback, setCycleFeedback] = useState<string | null>(null);

  // Importação e adição de leads
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [isManualLeadModalOpen, setIsManualLeadModalOpen] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState({
    company_name: '',
    phone: '',
    city: '',
    segment: ''
  });
  const [isSubmittingManualLead, setIsSubmittingManualLead] = useState(false);
  
  // Modais e gavetas
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAntiBanPanel, setShowAntiBanPanel] = useState(false);
  const [isSavingAntiBan, setIsSavingAntiBan] = useState(false);
  const [antiBanSuccessMsg, setAntiBanSuccessMsg] = useState('');
  const [simulatedCountdown, setSimulatedCountdown] = useState<number | null>(null);
  const [showSimulatedTyping, setShowSimulatedTyping] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(soundEngine.getMuted());

  // Programação do Próximo Disparo e Digitação em Tempo Real
  const [nextSchedule, setNextSchedule] = useState<{
    status: string;
    scheduled_at: string;
    formatted_time: string;
    countdown_seconds: number;
    reason: string;
    is_window_active: boolean;
    next_lead: AutomationLead | null;
  } | null>(null);
  const [liveCountdown, setLiveCountdown] = useState<number | null>(null);
  const [currentlyTyping, setCurrentlyTyping] = useState<{
    phone: string;
    company_name: string;
    started_at: string;
    estimated_duration_sec: number;
    message_preview?: string;
  } | null>(null);

  // Modal para registrar/simular resposta de lead recebida no WhatsApp
  const [isRecordReplyModalOpen, setIsRecordReplyModalOpen] = useState(false);
  const [recordReplyForm, setRecordReplyForm] = useState({
    phone: '',
    message: ''
  });
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState<string | null>(null);

  const [selectedLeadForChat, setSelectedLeadForChat] = useState<AutomationLead | null>(null);
  const [chatMessages, setChatMessages] = useState<AutomationMessage[]>([]);
  const [manualMessageText, setManualMessageText] = useState('');
  const [isSendingManual, setIsSendingManual] = useState(false);

  // Configurações Anti-Ban sincronizadas com o microserviço Go
  const [antiBanConfig, setAntiBanConfig] = useState({
    daily_limit: 10,
    min_delay_sec: 30,
    max_delay_sec: 70,
    typing_speed_ms: 150,
    min_typing_sec: 3,
    max_typing_sec: 15,
    sent_today: 0,
  });

  // Filtro de status do Kanban
  const [activeKanbanTab, setActiveKanbanTab] = useState<AutomationLeadStatus | 'all'>('all');

  // Rascunho das configurações gerais para edição
  const [editSettings, setEditSettings] = useState<AutomationSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newSegmentInput, setNewSegmentInput] = useState('');
  const [newCityInput, setNewCityInput] = useState('');

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Carrega status completo do backend
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setMetrics(data.metrics);
        setLeads(data.leads || []);
        setLogs(data.logs || []);
        if (data.next_schedule) {
          setNextSchedule(data.next_schedule);
          if (data.next_schedule.countdown_seconds !== undefined) {
            setLiveCountdown(data.next_schedule.countdown_seconds);
          }
        }
        setCurrentlyTyping(data.currently_typing || null);
        if (!isSettingsOpen && data.settings) {
          setEditSettings(data.settings);
        }
      }
    } catch (e) {
      console.error('[AutomationPanel] Erro ao carregar status:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isSettingsOpen]);

  // Carrega regras anti-ban diretamente do microserviço Go
  const fetchAntiBanConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/config', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAntiBanConfig(prev => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error('Falha ao carregar configurações anti-ban:', e);
    }
  }, []);

  // Polling automático
  useEffect(() => {
    fetchStatus();
    fetchAntiBanConfig();
    const interval = setInterval(() => {
      fetchStatus();
      fetchAntiBanConfig();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchAntiBanConfig]);

  // Carrega mensagens do lead selecionado para o chat
  const fetchLeadMessages = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`/api/automation/messages?phone=${encodeURIComponent(phone)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (e) {
      console.error('Erro ao carregar mensagens do chat:', e);
    }
  }, []);

  useEffect(() => {
    if (selectedLeadForChat) {
      fetchLeadMessages(selectedLeadForChat.phone);
      const interval = setInterval(() => {
        fetchLeadMessages(selectedLeadForChat.phone);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [selectedLeadForChat, fetchLeadMessages]);

  const isAutoDispatchingRef = useRef(false);

  // Execução do disparo automático no exato momento que a contagem regressiva atinge zero
  const triggerAutoCycleOnZero = useCallback(async () => {
    if (isAutoDispatchingRef.current || isCycling) return;
    isAutoDispatchingRef.current = true;
    try {
      soundEngine.playMechanicalClick('primary');
      setCycleFeedback('⏰ Horário programado atingido! Executando disparo automático...');
      const res = await fetch('/api/automation/run-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });
      const data = await res.json();
      if (data.executed) {
        soundEngine.playSentNotification();
        setCycleFeedback(`✅ ${data.message}`);
      } else {
        setCycleFeedback(`ℹ️ ${data.message}`);
      }
      await fetchStatus();
    } catch (e: any) {
      console.error('[AutomationPanel] Erro ao disparar automaticamente:', e);
      setCycleFeedback(`Falha no disparo automático: ${e.message}`);
    } finally {
      setTimeout(() => {
        isAutoDispatchingRef.current = false;
        setCycleFeedback(null);
      }, 5000);
    }
  }, [isCycling, fetchStatus]);

  // Quando o contador atinge zero, apenas atualiza o status do backend (o servidor já executa o disparo automaticamente)
  useEffect(() => {
    if (liveCountdown === null || liveCountdown <= 0) return;
    const timer = setInterval(() => {
      setLiveCountdown(prev => {
        if (prev === null || prev <= 1) {
          fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [liveCountdown, fetchStatus]);

  const formattedCountdown = useMemo(() => {
    if (liveCountdown === null || liveCountdown <= 0) return '00m 00s';
    const m = Math.floor(liveCountdown / 60);
    const s = liveCountdown % 60;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }, [liveCountdown]);

  // Registrar resposta recebida de lead (manualmente ou via webhook de teste)
  const handleRecordReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordReplyForm.phone.trim() || !recordReplyForm.message.trim()) {
      alert('Informe o telefone e a mensagem recebida.');
      return;
    }
    soundEngine.playMechanicalClick('primary');
    setIsSubmittingReply(true);
    setReplyFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: recordReplyForm.phone.trim(),
          message: recordReplyForm.message.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        soundEngine.playSentNotification();
        setReplyFeedback(`✅ Resposta registrada! Lead atualizado para [${data.qualification?.qualificationStatus?.toUpperCase() || 'EM CONVERSA'}].`);
        await fetchStatus();
        setTimeout(() => {
          setIsRecordReplyModalOpen(false);
          setRecordReplyForm({ phone: '', message: '' });
          setReplyFeedback(null);
        }, 1800);
      } else {
        alert('Erro ao registrar resposta: ' + (data.error || 'Falha no webhook'));
      }
    } catch (err: any) {
      alert('Falha: ' + err.message);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Alterna chave Mestra (Ligar/Pausar Robô)
  const toggleMasterSwitch = async () => {
    if (!settings) return;
    soundEngine.playMechanicalClick('primary');
    const nextState = !settings.is_active;
    try {
      const res = await fetch('/api/automation/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextState })
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setEditSettings(updated);
        fetchStatus();
      }
    } catch (e) {
      console.error('Erro ao alterar status do robô:', e);
    }
  };

  const [dispatchingLeadId, setDispatchingLeadId] = useState<string | null>(null);

  // Forçar execução imediata de um ciclo (por padrão não mina o Google se já houver leads na fila)
  const handleRunCycleNow = async (skipSearchParam?: boolean | React.MouseEvent) => {
    const skipSearch = typeof skipSearchParam === 'boolean' ? skipSearchParam : true;
    soundEngine.playMechanicalClick('primary');
    setIsCycling(true);
    setCycleFeedback(null);
    try {
      const res = await fetch('/api/automation/run-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, skipSearch })
      });
      const data = await res.json();
      setCycleFeedback(data.message || (data.executed ? 'Ciclo executado!' : 'Nenhuma ação executada'));
      await fetchStatus();
    } catch (e: any) {
      setCycleFeedback(`Erro: ${e.message}`);
    } finally {
      setIsCycling(false);
      setTimeout(() => setCycleFeedback(null), 5000);
    }
  };

  // Disparar teste exclusivamente para um lead pendente selecionado (sem minerar Google)
  const handleDispatchSingleLead = async (lead: AutomationLead) => {
    soundEngine.playMechanicalClick('primary');
    setDispatchingLeadId(lead.id);
    setCycleFeedback(`⚡ Disparando teste para ${lead.company_name}...`);
    try {
      const res = await fetch('/api/automation/run-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, skipSearch: true, targetLeadId: lead.id })
      });
      const data = await res.json();
      if (data.executed) {
        soundEngine.playSentNotification();
        setCycleFeedback(`✅ Mensagem de teste enviada com sucesso para ${lead.company_name}!`);
      } else {
        setCycleFeedback(`Aviso: ${data.message || data.error || 'Não foi possível disparar'}`);
      }
      await fetchStatus();
    } catch (err: any) {
      setCycleFeedback(`Erro no disparo: ${err.message}`);
    } finally {
      setDispatchingLeadId(null);
      setTimeout(() => setCycleFeedback(null), 5000);
    }
  };

  // Excluir lead individual
  const handleDeleteLead = async (lead: AutomationLead) => {
    if (!confirm(`Deseja realmente excluir o lead "${lead.company_name}" (${formatPhoneDisplay(lead.phone)}) e todo o histórico desta conversa?`)) {
      return;
    }
    soundEngine.playMechanicalClick('secondary');
    try {
      const res = await fetch(`/api/automation/leads?id=${lead.id}&phone=${encodeURIComponent(lead.phone)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        soundEngine.playSentNotification();
        setLeads(prev => prev.filter(l => l.id !== lead.id && l.phone !== lead.phone));
        if (selectedLeadForChat?.id === lead.id || selectedLeadForChat?.phone === lead.phone) {
          setSelectedLeadForChat(null);
        }
        setCycleFeedback(`🗑️ Lead "${lead.company_name}" excluído com sucesso.`);
        await fetchStatus();
      } else {
        alert('Erro ao excluir lead.');
      }
    } catch {
      alert('Erro de conexão ao excluir lead.');
    }
  };

  // Excluir todos os leads desqualificados
  const handleDeleteDisqualified = async () => {
    const disqualifiedCount = leads.filter(l => l.status === 'disqualified' || l.interest_level === 'none').length;
    if (disqualifiedCount === 0) return;
    if (!confirm(`Deseja realmente excluir todos os ${disqualifiedCount} leads desqualificados do pipeline?`)) {
      return;
    }
    soundEngine.playMechanicalClick('secondary');
    try {
      const res = await fetch('/api/automation/leads?disqualified=true', {
        method: 'DELETE'
      });
      if (res.ok) {
        soundEngine.playSentNotification();
        setCycleFeedback(`🗑️ ${disqualifiedCount} leads desqualificados removidos.`);
        await fetchStatus();
      }
    } catch {
      alert('Erro ao excluir leads desqualificados.');
    }
  };

  // Importar leads disponíveis da busca para a automação
  const handleImportInitialLeads = async () => {
    if (!initialLeads || initialLeads.length === 0) return;
    soundEngine.playMechanicalClick('primary');
    setIsImporting(true);
    setImportFeedback(null);

    try {
      const formatted = initialLeads.map(l => ({
        company_name: l.name,
        phone: l.whatsapp || (l as any).phone || '',
        city: l.city,
        state: (l as any).state || 'SP',
        segment: l.category || (l as any).mainActivity || 'Indústria',
        source: (l as any).cnpj ? 'industries_search' : 'local_search'
      })).filter(l => Boolean(l.phone));

      if (formatted.length === 0) {
        alert('Nenhum lead com WhatsApp/telefone válido para importar.');
        return;
      }

      const res = await fetch('/api/automation/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: formatted })
      });

      if (res.ok) {
        const data = await res.json();
        soundEngine.playSentNotification();
        setImportFeedback(`✅ ${data.added} leads adicionados à fila de automação (${data.duplicates} duplicados ignorados)!`);
        await fetchStatus();
        setTimeout(() => setImportFeedback(null), 5000);
      } else {
        const err = await res.json();
        alert('Erro ao importar leads: ' + (err.error || 'Erro desconhecido'));
      }
    } catch (err: any) {
      alert('Erro ao importar leads: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Inserir lead avulso manualmente (com opção de disparar teste na hora)
  const handleAddManualLead = async (e?: React.FormEvent, dispatchNow: boolean = false) => {
    if (e) e.preventDefault();
    if (!manualLeadForm.company_name.trim() || !manualLeadForm.phone.trim()) {
      alert('Preencha ao menos o nome da empresa e o telefone.');
      return;
    }
    soundEngine.playMechanicalClick('primary');
    setIsSubmittingManualLead(true);
    try {
      const res = await fetch('/api/automation/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispatchImmediately: dispatchNow,
          leads: [{
            company_name: manualLeadForm.company_name.trim(),
            phone: manualLeadForm.phone.trim(),
            city: manualLeadForm.city.trim() || 'São Paulo',
            segment: manualLeadForm.segment.trim() || 'Indústria',
            source: 'manual_entry'
          }]
        })
      });
      const data = await res.json();
      if (res.ok) {
        soundEngine.playSentNotification();
        setIsManualLeadModalOpen(false);
        setManualLeadForm({ company_name: '', phone: '', city: '', segment: '' });
        setImportFeedback(dispatchNow
          ? '⚡ Lead salvo e disparo de teste enviado imediatamente com sucesso!'
          : '✅ Lead adicionado à fila da automação com sucesso (sem minerar Google)!');
        await fetchStatus();
        setTimeout(() => setImportFeedback(null), 5000);
      } else {
        alert('Erro ao adicionar lead: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err: any) {
      alert('Erro ao adicionar: ' + err.message);
    } finally {
      setIsSubmittingManualLead(false);
    }
  };

  // Salvar regras anti-ban e digitação no microserviço Go
  const handleSaveAntiBanConfig = async () => {
    soundEngine.playMechanicalClick('primary');
    setIsSavingAntiBan(true);
    setAntiBanSuccessMsg('');

    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(antiBanConfig),
      });

      if (res.ok) {
        soundEngine.playSentNotification();
        setAntiBanSuccessMsg('Regras de Anti-Ban e Digitação ativas no microserviço!');
        
        // Mantém também daily_limit sincronizado na automação
        await fetch('/api/automation/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daily_limit: antiBanConfig.daily_limit })
        });

        fetchStatus();
        fetchAntiBanConfig();
        setTimeout(() => setAntiBanSuccessMsg(''), 4000);
      } else {
        alert('Erro ao salvar configurações no microserviço WhatsApp.');
      }
    } catch (err: any) {
      alert('Falha na comunicação com o microserviço: ' + err.message);
    } finally {
      setIsSavingAntiBan(false);
    }
  };

  // Resetar contador diário de disparos
  const handleResetCounter = async () => {
    if (!confirm('Deseja zerar o contador de mensagens enviadas hoje para 0?')) return;
    soundEngine.playMechanicalClick('secondary');
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent_today: 0 }),
      });
      if (res.ok) {
        setAntiBanConfig(prev => ({ ...prev, sent_today: 0 }));
        setAntiBanSuccessMsg('Contador diário de disparos zerado!');
        fetchStatus();
        fetchAntiBanConfig();
        setTimeout(() => setAntiBanSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      alert('Erro ao resetar contador: ' + err.message);
    }
  };

  // Presets de Anti-Ban
  const applyPreset = (preset: 'safe' | 'medium' | 'fast' | 'test') => {
    soundEngine.playMechanicalClick('secondary');
    if (preset === 'safe') {
      setAntiBanConfig(prev => ({
        ...prev,
        daily_limit: 15,
        min_delay_sec: 40,
        max_delay_sec: 80,
        typing_speed_ms: 180,
        min_typing_sec: 4,
        max_typing_sec: 20,
      }));
    } else if (preset === 'medium') {
      setAntiBanConfig(prev => ({
        ...prev,
        daily_limit: 30,
        min_delay_sec: 25,
        max_delay_sec: 50,
        typing_speed_ms: 140,
        min_typing_sec: 3,
        max_typing_sec: 15,
      }));
    } else if (preset === 'fast') {
      setAntiBanConfig(prev => ({
        ...prev,
        daily_limit: 60,
        min_delay_sec: 15,
        max_delay_sec: 30,
        typing_speed_ms: 90,
        min_typing_sec: 2,
        max_typing_sec: 8,
      }));
    } else if (preset === 'test') {
      setAntiBanConfig(prev => ({
        ...prev,
        daily_limit: 100,
        min_delay_sec: 4,
        max_delay_sec: 8,
        typing_speed_ms: 50,
        min_typing_sec: 2,
        max_typing_sec: 5,
      }));
    }
  };

  // Estimativa de tempo de digitação da mensagem inicial da automação
  const estimatedTypingSec = useMemo(() => {
    const chars = (settings?.initial_message_template || 'Olá, tudo bem?').length;
    const ms = chars * antiBanConfig.typing_speed_ms;
    const clampedSec = Math.min(
      Math.max(ms / 1000, antiBanConfig.min_typing_sec),
      antiBanConfig.max_typing_sec
    );
    return clampedSec.toFixed(1);
  }, [settings?.initial_message_template, antiBanConfig]);

  // Testar digitação humanizada ao vivo com cronômetro
  const runLiveTypingSimulation = () => {
    soundEngine.playMechanicalClick('secondary');
    const totalSec = parseFloat(estimatedTypingSec);
    setShowSimulatedTyping(true);
    setSimulatedCountdown(totalSec);

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, totalSec - elapsed);
      setSimulatedCountdown(parseFloat(remaining.toFixed(1)));
      if (remaining <= 0) {
        clearInterval(timer);
        setShowSimulatedTyping(false);
        setSimulatedCountdown(null);
        soundEngine.playSentNotification();
      }
    }, 100);
  };

  // Salvar configurações gerais
  const handleSaveSettings = async () => {
    if (!editSettings) return;
    soundEngine.playMechanicalClick('primary');
    setIsSavingSettings(true);
    try {
      const finalSegments = newSegmentInput.trim() && !editSettings.target_segments.includes(newSegmentInput.trim())
        ? [...editSettings.target_segments, newSegmentInput.trim()]
        : editSettings.target_segments;
      const finalCities = newCityInput.trim() && !editSettings.target_cities.includes(newCityInput.trim())
        ? [...editSettings.target_cities, newCityInput.trim()]
        : editSettings.target_cities;

      const payloadToSave: AutomationSettings = {
        ...editSettings,
        is_active: settings?.is_active ?? editSettings.is_active,
        target_segments: finalSegments,
        target_cities: finalCities
      };

      const res = await fetch('/api/automation/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSave)
      });
      if (res.ok) {
        const data = await res.json();
        soundEngine.playSentNotification();
        setSettings(data);
        setEditSettings(data);
        setNewSegmentInput('');
        setNewCityInput('');
        setAntiBanConfig(prev => ({ ...prev, daily_limit: data.daily_limit }));
        setIsSettingsOpen(false);
        setCycleFeedback(`✅ Configurações salvas e ativas! Meta: ${data.daily_limit}/dia • Horário: ${data.start_hour} às ${data.end_hour} • Intervalo: ${data.min_interval_mins}-${data.max_interval_mins} min.`);
        await fetchStatus();
        setTimeout(() => setCycleFeedback(null), 5000);
      } else {
        alert('Erro ao salvar configurações da automação.');
      }
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
      alert('Falha de conexão ao salvar configurações.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);

  // Alterna entre os perfis pré-definidos (Gustavo vs Sérgio)
  const handleSwitchProfile = async (profileId: 'gustavo' | 'sergio') => {
    soundEngine.playMechanicalClick('primary');
    setIsSwitchingProfile(true);
    try {
      const res = await fetch('/api/automation/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        soundEngine.playTemplateFlash();
        setSettings(data.settings);
        setEditSettings(data.settings);
        setCycleFeedback(`🔄 Perfil alternado para [${data.profile_details.name}]! Template e IA SDR atualizados.`);
        await fetchStatus();
      } else {
        alert('Erro ao alternar perfil: ' + (data.error || 'Falha na requisição'));
      }
    } catch (err: any) {
      alert('Falha: ' + err.message);
    } finally {
      setIsSwitchingProfile(false);
      setTimeout(() => setCycleFeedback(null), 5000);
    }
  };

  const handleApplyProfilePresetToForm = (profileId: 'gustavo' | 'sergio') => {
    soundEngine.playTemplateFlash();
    const preset = AUTOMATION_PROFILES[profileId];
    if (!preset) return;
    setEditSettings(prev => prev ? ({
      ...prev,
      profile: profileId,
      initial_message_template: preset.initial_message_template,
      ai_prompt: preset.ai_prompt,
      target_segments: [...preset.target_segments],
      target_cities: [...preset.target_cities],
    }) : null);
  };

  // Assumir conversa ou devolver para IA
  const handleToggleTakeover = async (lead: AutomationLead) => {
    const nextTakeover = !lead.human_takeover;
    soundEngine.playMechanicalClick('secondary');
    try {
      const res = await fetch('/api/automation/takeover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: lead.phone, takeover: nextTakeover })
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.phone === lead.phone ? { ...l, human_takeover: nextTakeover } : l));
        if (selectedLeadForChat?.phone === lead.phone) {
          setSelectedLeadForChat({ ...selectedLeadForChat, human_takeover: nextTakeover });
        }
      }
    } catch (e) {
      console.error('Erro ao assumir controle:', e);
    }
  };

  // Enviar mensagem manual no chat
  const handleSendManualMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForChat || !manualMessageText.trim() || isSendingManual) return;

    soundEngine.playMechanicalClick('primary');
    setIsSendingManual(true);
    try {
      const res = await fetch('/api/automation/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedLeadForChat.phone,
          content: manualMessageText.trim()
        })
      });
      if (res.ok) {
        soundEngine.playSentNotification();
        setManualMessageText('');
        await fetchLeadMessages(selectedLeadForChat.phone);
      }
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
    } finally {
      setIsSendingManual(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (activeKanbanTab === 'all') return true;
    return lead.status === activeKanbanTab;
  });

  return (
    <div className="space-y-6">
      {/* 1. BARRA SUPERIOR MASTER DE CONTROLE */}
      <div className="bg-zinc-950 border-4 border-zinc-950 p-4 sm:p-6 shadow-[6px_6px_0_0_#18181B] sm:shadow-[10px_10px_0_0_#18181B] text-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleMasterSwitch}
            disabled={isLoading}
            className={`px-5 py-3.5 font-mono font-black text-sm uppercase tracking-wider flex items-center gap-3 transition-all duration-150 border-2 border-zinc-950 shadow-[4px_4px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer ${
              settings?.is_active
                ? 'bg-[#E5FF00] text-zinc-950 hover:bg-[#d8f000]'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {settings?.is_active ? (
              <>
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span>ROBÔ ATIVO</span>
                <Play className="w-4 h-4 fill-current" />
              </>
            ) : (
              <>
                <span className="w-3 h-3 rounded-full bg-zinc-500" />
                <span>ROBÔ PAUSADO</span>
                <Pause className="w-4 h-4 fill-current" />
              </>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Bot className="w-4 h-4 text-[#E5FF00]" />
              <span className="font-mono text-xs font-black uppercase tracking-wider text-zinc-300">
                Cadência Diária & IA SDR
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
                settings?.profile === 'sergio'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/40'
                  : 'bg-[#E5FF00]/10 text-[#E5FF00] border-[#E5FF00]/40'
              }`}>
                {settings?.profile === 'sergio' ? '🏭 Sérgio // Sal Industrial' : '💻 Gustavo // Sites & SEO'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Horário: <span className="text-zinc-200 font-mono font-bold">{settings?.start_hour || '09:00'} às {settings?.end_hour || '17:30'}</span> • Cota: <span className="text-[#E5FF00] font-mono font-bold">{settings?.daily_limit ?? antiBanConfig.daily_limit} disparos/dia</span> • Hoje: <span className="text-emerald-400 font-mono font-bold">{metrics?.dispatchedToday ?? antiBanConfig.sent_today} enviados</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botão Regras Anti-Ban (Idêntico ao painel do WhatsApp) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playMechanicalClick('secondary');
              setShowAntiBanPanel(prev => !prev);
            }}
            className={`btn-tactile-4 px-4 py-2.5 border-2 font-mono text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              showAntiBanPanel
                ? 'bg-[#E5FF00] text-zinc-950 border-zinc-950 shadow-[2px_2px_0_0_#fff]'
                : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-white'
            }`}
            title="Ajustar intervalos, digitação e limites anti-ban"
          >
            <Sliders className="w-4 h-4" />
            <span>{showAntiBanPanel ? 'Ocultar Anti-Ban' : 'Regras Anti-Ban'}</span>
          </button>

          <button
            onClick={handleRunCycleNow}
            disabled={isCycling}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-2 border-zinc-800 font-mono text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Executa a busca de leads e disparo imediatamente sem esperar o cron"
          >
            <Zap className={`w-3.5 h-3.5 text-[#E5FF00] ${isCycling ? 'animate-spin' : ''}`} />
            <span>{isCycling ? 'Executando...' : 'Rodar Ciclo Agora'}</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playMechanicalClick('secondary');
              if (settings) {
                setEditSettings({ ...settings });
              }
              setIsSettingsOpen(true);
            }}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-2 border-zinc-800 font-mono text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors active:scale-95 cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>Configurações</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = soundEngine.toggleMute();
              setIsSoundMuted(next);
            }}
            className={`p-2.5 border-2 flex items-center justify-center transition-all cursor-pointer ${
              isSoundMuted
                ? 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white'
                : 'bg-[#25D366] text-zinc-950 border-zinc-950 shadow-[2px_2px_0_0_#E5FF00]'
            }`}
            title={isSoundMuted ? 'Ativar Sound Design' : 'Silenciar Sound Design'}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              soundEngine.playMechanicalClick('secondary');
              fetchStatus();
              fetchAntiBanConfig();
            }}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-2 border-zinc-800 transition-colors cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FEEDBACK DE EXECUÇÃO DO CICLO */}
      <AnimatePresence>
        {cycleFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 bg-[#E5FF00]/10 border-2 border-[#E5FF00] text-[#E5FF00] font-mono text-xs flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{cycleFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1.1 BANNER DE DIGITAÇÃO AO VIVO EM TEMPO REAL (ANTI-BAN) */}
      <AnimatePresence>
        {currentlyTyping && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-[#E5FF00] border-4 border-zinc-950 p-4 sm:p-5 shadow-[8px_8px_0_0_#18181B] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-zinc-950"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative flex items-center justify-center shrink-0">
                <span className="w-5 h-5 rounded-full bg-[#25D366] border-2 border-zinc-950 animate-ping absolute" />
                <span className="w-4 h-4 rounded-full bg-[#25D366] border-2 border-zinc-950 relative" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-zinc-950 text-[#E5FF00] font-black text-xs uppercase px-2.5 py-0.5 tracking-wider border border-zinc-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                    ✍️ DIGITANDO EM TEMPO REAL PARA O LEAD
                  </span>
                  <span className="text-[11px] font-bold text-zinc-900 bg-white/70 px-2 py-0.5 border border-zinc-950">
                    Simulação Humana Anti-Ban Ativa
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-zinc-950 mt-1">
                  {currentlyTyping.company_name} • <span className="underline">{formatPhoneDisplay(currentlyTyping.phone)}</span>
                </div>
                {currentlyTyping.message_preview && (
                  <div className="text-xs text-zinc-800 font-bold mt-1 line-clamp-1 italic">
                    "{currentlyTyping.message_preview}..."
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto bg-zinc-950 text-white px-4 py-2.5 border-2 border-zinc-950 text-xs font-bold shrink-0 shadow-[3px_3px_0_0_#000]">
              <span className="inline-block animate-bounce text-[#25D366]">●</span>
              <span className="inline-block animate-bounce delay-100 text-[#25D366]">●</span>
              <span className="inline-block animate-bounce delay-200 text-[#25D366]">●</span>
              <span className="ml-1 text-white font-mono">Digitando mensagem humanizada...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1.2 CARD DE PRÓXIMO DISPARO PROGRAMADO & CONTAGEM REGRESSIVA */}
      <div className="bg-zinc-950 border-4 border-zinc-950 p-4 sm:p-5 shadow-[8px_8px_0_0_#18181B] flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-mono">
        {/* Lado Esquerdo: Horário e Contagem Regressiva */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center text-[#E5FF00] shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  ⏰ PROGRAMAÇÃO DO PRÓXIMO DISPARO
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                  nextSchedule?.is_window_active 
                    ? 'bg-[#25D366]/20 border-[#25D366] text-[#25D366]' 
                    : 'bg-amber-500/20 border-amber-500 text-amber-300'
                }`}>
                  {nextSchedule?.is_window_active ? '🟢 EXPEDIENTE ATIVO' : '🟡 JANELA PAUSADA'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black text-[#E5FF00]">
                  {nextSchedule?.formatted_time || '09:00:00'}
                </span>
                {liveCountdown !== null && liveCountdown > 0 && (
                  <span className="text-sm font-bold text-zinc-300 bg-zinc-900 px-2 py-0.5 border border-zinc-800">
                    (em {formattedCountdown})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-md">
                {nextSchedule?.reason || 'Intervalo inteligente anti-ban entre disparos.'}
              </p>
            </div>
          </div>
        </div>

        {/* Lado Direito: Próximo Lead na Fila e Ação Imediata */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-3 lg:pt-0 lg:pl-6">
          {nextSchedule?.next_lead ? (
            <div className="text-xs">
              <span className="text-[10px] uppercase text-zinc-500 font-bold block">Próximo Contato na Fila:</span>
              <div className="font-bold text-zinc-100 line-clamp-1 mt-0.5">
                {nextSchedule.next_lead.company_name}
              </div>
              <div className="text-zinc-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                <span>{formatPhoneDisplay(nextSchedule.next_lead.phone)}</span>
                <span>•</span>
                <span className="text-[#E5FF00]">{nextSchedule.next_lead.city || 'SP'}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">
              Nenhum lead pendente na fila. O robô minerará automaticamente novos contatos.
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
            <button
              type="button"
              onClick={handleRunCycleNow}
              disabled={isCycling}
              className="px-4 py-2.5 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono font-black text-xs uppercase border-2 border-zinc-950 shadow-[3px_3px_0_0_#fff] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-transform active:scale-95 shrink-0"
              title="Disparar imediatamente para o próximo lead sem aguardar a contagem regressiva"
            >
              <Zap className="w-3.5 h-3.5 text-zinc-950 fill-zinc-950" />
              <span>{isCycling ? 'Disparando...' : 'Pular Espera & Disparar Agora'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playMechanicalClick('secondary');
                setIsRecordReplyModalOpen(true);
              }}
              className="px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border-2 border-zinc-800 hover:border-emerald-600 font-mono text-xs font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              title="Registrar resposta recebida de um lead"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>+ Resposta</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PAINEL COMPLETO DE CONFIGURAÇÕES ANTI-BAN E DIGITAÇÃO (IDÊNTICO AO WHATSAPP PANEL) */}
      <AnimatePresence>
        {showAntiBanPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-4 border-zinc-950 p-6 md:p-8 shadow-[10px_10px_0_0_#18181B] flex flex-col gap-6 overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-zinc-950 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-[#E5FF00] border-2 border-zinc-950" />
                  <span className="font-mono text-xs uppercase tracking-widest font-black text-zinc-600">
                    Painel de Controle Total Anti-Ban & Humanização // Automação
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-black uppercase text-zinc-950 mt-1">
                  Configurações de Espaçamento & Digitação
                </h3>
              </div>

              {/* Presets Rápidos */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase text-zinc-500">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset('safe')}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-[#25D366] hover:text-zinc-950 border-2 border-zinc-950 font-mono text-xs font-bold uppercase transition-all cursor-pointer"
                  title="15 msgs/dia, 40-80s delay, 180ms/char"
                >
                  🛡️ Ultra Seguro
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('medium')}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-[#E5FF00] border-2 border-zinc-950 font-mono text-xs font-bold uppercase transition-all cursor-pointer"
                  title="30 msgs/dia, 25-50s delay, 140ms/char"
                >
                  ⚖️ Equilibrado
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('fast')}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-950 hover:text-white border-2 border-zinc-950 font-mono text-xs font-bold uppercase transition-all cursor-pointer"
                  title="60 msgs/dia, 15-30s delay, 90ms/char"
                >
                  ⚡ Acelerado
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('test')}
                  className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 border-2 border-zinc-950 font-mono text-xs font-black uppercase transition-all cursor-pointer"
                  title="100 msgs/dia, 4-8s delay, 50ms/char (para testes rápidos)"
                >
                  🧪 Teste Rápido
                </button>
              </div>
            </div>

            {/* Feedback de Sucesso */}
            {antiBanSuccessMsg && (
              <div className="p-3 bg-emerald-100 border-2 border-emerald-600 text-emerald-900 font-mono text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                {antiBanSuccessMsg}
              </div>
            )}

            {/* Grid dos 3 Blocos de Configuração */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Bloco 1: Espaçamento de Segurança */}
              <div className="bg-zinc-50 border-2 border-zinc-950 p-4 flex flex-col gap-4">
                <div className="border-b-2 border-zinc-200 pb-2">
                  <span className="font-mono text-xs font-black uppercase text-zinc-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-zinc-950" /> 1. Espaçamento Anti-Ban
                  </span>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">
                    Intervalo aleatório entre cada envio da fila.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Delay Mínimo */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs font-mono font-bold text-zinc-800">
                      <span>Delay Mínimo:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={antiBanConfig.min_delay_sec}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            setAntiBanConfig(prev => ({
                              ...prev,
                              min_delay_sec: val,
                              max_delay_sec: Math.max(val, prev.max_delay_sec)
                            }));
                          }}
                          className="w-16 p-1 border border-zinc-950 text-right font-mono font-black text-xs bg-white"
                        />
                        <span className="text-zinc-600">s</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={120}
                      value={antiBanConfig.min_delay_sec}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAntiBanConfig(prev => ({
                          ...prev,
                          min_delay_sec: val,
                          max_delay_sec: Math.max(val, prev.max_delay_sec)
                        }));
                      }}
                      className="w-full accent-zinc-950 cursor-pointer"
                    />
                  </div>

                  {/* Delay Máximo */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs font-mono font-bold text-zinc-800">
                      <span>Delay Máximo:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={antiBanConfig.min_delay_sec}
                          max={300}
                          value={antiBanConfig.max_delay_sec}
                          onChange={(e) => {
                            const val = Math.max(antiBanConfig.min_delay_sec, Number(e.target.value));
                            setAntiBanConfig(prev => ({ ...prev, max_delay_sec: val }));
                          }}
                          className="w-16 p-1 border border-zinc-950 text-right font-mono font-black text-xs bg-white"
                        />
                        <span className="text-zinc-600">s</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={antiBanConfig.min_delay_sec}
                      max={240}
                      value={antiBanConfig.max_delay_sec}
                      onChange={(e) => setAntiBanConfig(prev => ({
                        ...prev,
                        max_delay_sec: Number(e.target.value)
                      }))}
                      className="w-full accent-zinc-950 cursor-pointer"
                    />
                  </div>

                  <div className="p-2.5 bg-zinc-100 border border-zinc-300 text-[11px] font-mono text-zinc-700 flex flex-col gap-1">
                    <div>
                      Média de espera: <b>{Math.round((antiBanConfig.min_delay_sec + antiBanConfig.max_delay_sec) / 2)}s</b> por envio.
                    </div>
                    <div className="text-zinc-500 text-[10px]">
                      Variação dinâmica anti-padrão orgânica ativada.
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloco 2: Digitação Humanizada */}
              <div className="bg-zinc-50 border-2 border-zinc-950 p-4 flex flex-col gap-4">
                <div className="border-b-2 border-zinc-200 pb-2">
                  <span className="font-mono text-xs font-black uppercase text-zinc-900 flex items-center gap-1.5">
                    ✍️ 2. Digitação Humanizada
                  </span>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">
                    Tempo que o contato vê "Digitando..." no WhatsApp.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Velocidade por caractere */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs font-mono font-bold text-zinc-800">
                      <span>Velocidade por Caractere:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={30}
                          max={500}
                          step={10}
                          value={antiBanConfig.typing_speed_ms}
                          onChange={(e) => {
                            const val = Math.max(20, Number(e.target.value));
                            setAntiBanConfig(prev => ({ ...prev, typing_speed_ms: val }));
                          }}
                          className="w-16 p-1 border border-zinc-950 text-right font-mono font-black text-xs bg-white"
                        />
                        <span className="text-zinc-600">ms</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={300}
                      step={10}
                      value={antiBanConfig.typing_speed_ms}
                      onChange={(e) => setAntiBanConfig(prev => ({
                        ...prev,
                        typing_speed_ms: Number(e.target.value)
                      }))}
                      className="w-full accent-zinc-950 cursor-pointer"
                    />
                  </div>

                  {/* Min e Max segundos */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono font-bold text-zinc-700">Duração Mín (s):</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={antiBanConfig.min_typing_sec}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          setAntiBanConfig(prev => ({
                            ...prev,
                            min_typing_sec: val,
                            max_typing_sec: Math.max(val, prev.max_typing_sec)
                          }));
                        }}
                        className="p-1.5 border border-zinc-950 font-mono text-xs bg-white font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono font-bold text-zinc-700">Duração Máx (s):</span>
                      <input
                        type="number"
                        min={antiBanConfig.min_typing_sec}
                        max={60}
                        value={antiBanConfig.max_typing_sec}
                        onChange={(e) => setAntiBanConfig(prev => ({
                          ...prev,
                          max_typing_sec: Math.max(prev.min_typing_sec, Number(e.target.value))
                        }))}
                        className="p-1.5 border border-zinc-950 font-mono text-xs bg-white font-bold"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-100 border border-zinc-300 text-[11px] font-mono text-zinc-700 flex flex-col gap-2">
                    <div>
                      Nesta mensagem: simulará <b>{estimatedTypingSec}s</b> digitando.
                    </div>
                    <button
                      type="button"
                      onClick={runLiveTypingSimulation}
                      className={`w-full py-1.5 font-mono font-black text-xs uppercase border border-zinc-950 transition-colors cursor-pointer ${
                        showSimulatedTyping
                          ? 'bg-[#E5FF00] text-zinc-950 animate-pulse'
                          : 'bg-zinc-950 text-[#E5FF00] hover:bg-zinc-800'
                      }`}
                    >
                      {simulatedCountdown !== null ? `⏳ ${simulatedCountdown}s digitando...` : `▶️ Testar Digitação (${estimatedTypingSec}s)`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bloco 3: Limites Diários & Reset */}
              <div className="bg-zinc-50 border-2 border-zinc-950 p-4 flex flex-col gap-4">
                <div className="border-b-2 border-zinc-200 pb-2">
                  <span className="font-mono text-xs font-black uppercase text-zinc-900 flex items-center gap-1.5">
                    🛑 3. Limite Diário & Reset
                  </span>
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">
                    Proteção máxima contra bloqueios do número.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-mono font-bold text-zinc-800">Limite Diário (mensagens/dia):</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={antiBanConfig.daily_limit}
                        onChange={(e) => setAntiBanConfig(prev => ({
                          ...prev,
                          daily_limit: Math.max(1, Number(e.target.value))
                        }))}
                        className="w-24 p-2 border-2 border-zinc-950 font-mono text-sm bg-white font-bold"
                      />
                      <div className="flex gap-1">
                        {[10, 15, 30, 50].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAntiBanConfig(prev => ({ ...prev, daily_limit: val }))}
                            className={`px-2 py-1 text-[10px] font-mono font-bold border border-zinc-950 transition-colors cursor-pointer ${
                              antiBanConfig.daily_limit === val ? 'bg-[#E5FF00] text-zinc-950' : 'bg-white hover:bg-zinc-100'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-zinc-300 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Enviadas Hoje:</span>
                      <span className="font-mono text-base font-black text-zinc-950">
                        {antiBanConfig.sent_today} / {antiBanConfig.daily_limit}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetCounter}
                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-700 font-mono text-[10px] font-black uppercase cursor-pointer"
                      title="Resetar contador de hoje para 0"
                    >
                      Zerar Hoje
                    </button>
                  </div>

                  <div className="p-2 bg-zinc-100 border border-zinc-300 text-[10px] font-mono text-zinc-600">
                    Reseta automaticamente à meia-noite. O robô pausa novos disparos ao atingir a cota.
                  </div>
                </div>
              </div>

            </div>

            {/* Rodapé do Painel Anti-Ban */}
            <div className="flex items-center justify-between border-t-2 border-zinc-200 pt-4 flex-wrap gap-4">
              <span className="text-xs font-mono text-zinc-500">
                * As regras são aplicadas imediatamente ao worker Go e sincronizadas com <code className="bg-zinc-100 px-1 py-0.5">antiban_config.json</code>
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAntiBanPanel(false)}
                  className="px-4 py-2 border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 font-mono text-xs font-bold uppercase cursor-pointer"
                >
                  Fechar Painel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAntiBanConfig}
                  disabled={isSavingAntiBan}
                  className="px-6 py-2.5 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono font-black text-xs uppercase border-2 border-zinc-950 shadow-[3px_3px_0_0_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{isSavingAntiBan ? 'Salvando...' : 'Salvar Regras no Microserviço'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. CARDS DE MÉTRICAS DO DIA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border-4 border-zinc-950 p-4 shadow-[4px_4px_0_0_#18181B]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold">Minerados Hoje</span>
            <Building2 className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-mono font-black text-zinc-100">
            {metrics?.minedToday || 0}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Google Maps / SerpAPI</div>
        </div>

        <div className="bg-zinc-950 border-4 border-zinc-950 p-4 shadow-[4px_4px_0_0_#18181B]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold">Disparados Hoje</span>
            <Send className="w-4 h-4 text-[#E5FF00]" />
          </div>
          <div className="text-2xl font-mono font-black text-[#E5FF00]">
            {antiBanConfig.sent_today} <span className="text-xs text-zinc-500 font-normal">/ {antiBanConfig.daily_limit}</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Limite diário anti-ban ativo</div>
        </div>

        <div className="bg-zinc-950 border-4 border-zinc-950 p-4 shadow-[4px_4px_0_0_#18181B]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold">Respostas</span>
            <MessageSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-black text-emerald-400">
            {metrics?.repliesToday || 0}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Interações no WhatsApp</div>
        </div>

        <div className="bg-zinc-950 border-4 border-zinc-950 p-4 shadow-[4px_4px_0_0_#18181B]">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider font-bold">Qualificados 🔥</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-black text-amber-400">
            {metrics?.qualifiedToday || 0}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Oportunidades com demanda</div>
        </div>
      </div>

      {/* BANNER DE IMPORTAÇÃO DE LEADS DA BUSCA */}
      {initialLeads && initialLeads.length > 0 && (
        <div className="bg-[#E5FF00] border-4 border-zinc-950 p-4 shadow-[6px_6px_0_0_#18181B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-zinc-950 animate-pulse" />
              <span className="font-mono text-xs uppercase font-black text-zinc-950 tracking-wider">
                📥 {initialLeads.length} LEADS DISPONÍVEIS DA BUSCA
              </span>
            </div>
            <p className="text-xs text-zinc-900 font-mono mt-0.5 font-bold">
              Importe esses contatos para a fila da automação para que o robô IA SDR faça a abordagem e qualificação comercial.
            </p>
          </div>
          <button
            onClick={handleImportInitialLeads}
            disabled={isImporting}
            className="px-5 py-3 bg-zinc-950 hover:bg-zinc-900 text-[#E5FF00] font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[3px_3px_0_0_#fff] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isImporting ? 'Importando...' : `Importar ${initialLeads.length} Leads para a Fila`}</span>
          </button>
        </div>
      )}

      {/* FEEDBACK DE IMPORTAÇÃO */}
      <AnimatePresence>
        {importFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3 bg-emerald-950/60 border-2 border-emerald-500 text-emerald-300 font-mono text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{importFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. KANBAN / PIPELINE DE LEADS */}
      <div className="bg-zinc-950 border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] sm:shadow-[10px_10px_0_0_#18181B]">
        <div className="p-4 border-b-2 border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#E5FF00]" />
              <h3 className="font-mono text-sm font-black uppercase tracking-wider text-zinc-100">
                Pipeline de Leads da Automação ({leads.length})
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundEngine.playMechanicalClick('secondary');
                  setIsManualLeadModalOpen(true);
                }}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 font-mono text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
                title="Cadastrar lead manualmente"
              >
                <Plus className="w-3 h-3 text-[#E5FF00]" />
                <span>+ Lead</span>
              </button>
              <button
                onClick={() => {
                  soundEngine.playMechanicalClick('secondary');
                  setRecordReplyForm({ phone: '', message: '' });
                  setIsRecordReplyModalOpen(true);
                }}
                className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/80 font-mono text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
                title="Registrar resposta de contato no WhatsApp"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>+ Registrar Resposta</span>
              </button>
              {initialLeads && initialLeads.length > 0 && (
                <button
                  onClick={handleImportInitialLeads}
                  disabled={isImporting}
                  className="px-2.5 py-1 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 border border-zinc-950 font-mono text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer transition-colors"
                  title="Importar leads encontrados na pesquisa"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Importar Busca ({initialLeads.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Abas de filtro do pipeline */}
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
            {[
              { id: 'all', label: 'Todos', count: leads.length },
              { id: 'pending', label: 'Na Fila', count: leads.filter(l => l.status === 'pending').length },
              { id: 'sent', label: 'Disparados', count: leads.filter(l => l.status === 'sent').length },
              { id: 'chatting', label: '💬 Em Conversa', count: leads.filter(l => l.status === 'chatting' || !!l.last_reply_at).length },
              { id: 'qualified', label: '🔥 Qualificados', count: leads.filter(l => l.status === 'qualified' || l.interest_level === 'high').length },
              { id: 'disqualified', label: 'Sem Interesse', count: leads.filter(l => l.status === 'disqualified').length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  soundEngine.playMechanicalClick('secondary');
                  setActiveKanbanTab(tab.id as any);
                }}
                className={`px-3 py-1.5 border-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeKanbanTab === tab.id
                    ? 'bg-[#E5FF00] text-zinc-950 border-[#E5FF00] font-black'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  activeKanbanTab === tab.id
                    ? 'bg-zinc-950 text-[#E5FF00]'
                    : tab.id === 'chatting' && tab.count > 0
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}

            {leads.some(l => l.status === 'disqualified' || l.interest_level === 'none') && (
              <button
                type="button"
                onClick={handleDeleteDisqualified}
                className="ml-auto px-2.5 py-1.5 bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800/80 transition-colors cursor-pointer flex items-center gap-1 font-mono text-[11px]"
                title="Excluir todos os leads desqualificados de uma vez"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Desqualificados ({leads.filter(l => l.status === 'disqualified' || l.interest_level === 'none').length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de Leads */}
        <div className="p-4">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-zinc-800 bg-zinc-900/30 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-zinc-400">
                <Layers className="w-5 h-5 text-[#E5FF00]" />
              </div>
              <div>
                <h4 className="font-mono font-bold text-xs uppercase text-zinc-200">
                  {leads.length === 0 ? 'Nenhum lead na esteira da automação ainda' : 'Nenhum lead neste estágio'}
                </h4>
                <p className="text-[11px] font-mono text-zinc-500 mt-1 max-w-md mx-auto">
                  {leads.length === 0
                    ? 'Execute um ciclo para minerar leads no Google ou importe os contatos das buscas.'
                    : 'Filtre por outro estágio do pipeline ou adicione novos leads.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {initialLeads.length > 0 && (
                  <button
                    onClick={handleImportInitialLeads}
                    disabled={isImporting}
                    className="px-3.5 py-2 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Importar {initialLeads.length} Leads da Busca</span>
                  </button>
                )}
                <button
                  onClick={() => handleRunCycleNow(false)}
                  disabled={isCycling}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-zinc-950" />
                  <span>{isCycling ? 'Minerando...' : '⚡ Minerar Leads Agora'}</span>
                </button>
                <button
                  onClick={() => setIsManualLeadModalOpen(true)}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs font-bold uppercase border-2 border-zinc-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Lead Manual</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLeads.map(lead => {
                const isQualified = lead.status === 'qualified' || lead.interest_level === 'high';
                const isBeingTyped = currentlyTyping && isSamePhone(currentlyTyping.phone, lead.phone);
                const hasReplied = lead.status === 'chatting' || !!lead.last_reply_at;

                return (
                  <div
                    key={lead.id}
                    className={`p-3.5 border-2 transition-all relative ${
                      isBeingTyped
                        ? 'bg-emerald-950/30 border-emerald-400 shadow-[4px_4px_0_0_#22c55e] ring-2 ring-emerald-400/50'
                        : isQualified
                        ? 'bg-amber-950/20 border-amber-500/80 shadow-[3px_3px_0_0_#d97706]'
                        : hasReplied
                        ? 'bg-emerald-950/20 border-emerald-500/80 shadow-[3px_3px_0_0_#10b981]'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-mono font-bold text-xs text-zinc-100 line-clamp-1">
                          {lead.company_name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-zinc-500" />
                          <span>{lead.city || 'São Paulo'}</span>
                          <span>•</span>
                          <span className="text-zinc-300">{lead.segment || 'Indústria'}</span>
                        </div>
                      </div>

                      {/* Badge de Status */}
                      <span className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                        isBeingTyped
                          ? 'bg-emerald-400 border-emerald-300 text-zinc-950 animate-pulse font-black'
                          : isQualified
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : hasReplied
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : lead.status === 'sent'
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}>
                        {isBeingTyped ? '✍️ Digitando' : isQualified ? '🔥 Qualificado' : hasReplied ? '💬 Respondeu' : lead.status}
                      </span>
                    </div>

                    {/* Indicador de Digitação em Tempo Real */}
                    {isBeingTyped && (
                      <div className="mt-2.5 px-2.5 py-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-between animate-pulse">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>✍️ ROBÔ DIGITANDO AGORA...</span>
                        </span>
                        <span className="text-[9px] text-emerald-400">ao vivo</span>
                      </div>
                    )}

                    {/* Indicador de Resposta Recebida */}
                    {hasReplied && (
                      <div className="mt-2 px-2.5 py-1 bg-emerald-950/70 border border-emerald-600/80 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>RESPONDEU NO WHATSAPP</span>
                        </span>
                        {lead.last_reply_at && (
                          <span className="text-[9px] text-emerald-400/90 font-normal">
                            às {new Date(lead.last_reply_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-300 hover:text-[#E5FF00] flex items-center gap-1 transition-colors"
                      >
                        <span>{formatPhoneDisplay(lead.phone)}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>

                      {lead.human_takeover && (
                        <span className="text-[10px] bg-red-950/60 text-red-300 border border-red-800/60 px-1.5 py-0.5">
                          Operador no Controle
                        </span>
                      )}
                    </div>

                    {lead.qualification_notes && (
                      <p className="mt-2 text-[11px] text-zinc-400 italic bg-zinc-950 p-2 border border-zinc-800 line-clamp-2">
                        "{lead.qualification_notes}"
                      </p>
                    )}

                    {/* Ações do Card */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {lead.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleDispatchSingleLead(lead)}
                          disabled={dispatchingLeadId === lead.id}
                          className="px-2.5 py-1.5 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono text-[10px] font-black uppercase flex items-center gap-1 border border-zinc-950 shadow-[2px_2px_0_0_#fff] cursor-pointer disabled:opacity-50"
                          title="Disparar teste exclusivamente para este lead (sem minerar Google)"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>{dispatchingLeadId === lead.id ? 'Enviando...' : '⚡ Disparar Teste'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          soundEngine.playMechanicalClick('secondary');
                          setSelectedLeadForChat(lead);
                        }}
                        className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-mono text-[11px] font-bold uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3 text-[#E5FF00]" />
                        <span>Abrir Chat</span>
                      </button>

                      <button
                        onClick={() => {
                          soundEngine.playMechanicalClick('secondary');
                          setRecordReplyForm({ phone: lead.phone, message: '' });
                          setIsRecordReplyModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 font-mono text-[10px] font-bold uppercase transition-colors cursor-pointer"
                        title="Simular ou registrar resposta recebida deste contato"
                      >
                        + Resposta
                      </button>

                      <button
                        onClick={() => handleToggleTakeover(lead)}
                        className={`px-2.5 py-1.5 border font-mono text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                          lead.human_takeover
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                            : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-700/60'
                        }`}
                        title={lead.human_takeover ? 'Devolver conversa para a IA' : 'Assumir conversa (pausar IA)'}
                      >
                        <UserCheck className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteLead(lead)}
                        className="p-1.5 bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-800/80 transition-colors cursor-pointer shrink-0"
                        title="Excluir este lead e todo o histórico de mensagens"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. CONSOLE DE LOGS EM TEMPO REAL */}
      <div className="bg-zinc-950 border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] sm:shadow-[10px_10px_0_0_#18181B]">
        <div className="p-3.5 border-b-2 border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#E5FF00]" />
            <h3 className="font-mono text-xs font-black uppercase tracking-wider text-zinc-100">
              Console de Auditoria & Execução do Robô (Tempo Real)
            </h3>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">Auto-atualização ativa</span>
        </div>

        <div className="p-4 bg-zinc-950 font-mono text-xs space-y-1.5 max-h-56 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-zinc-600">Aguardando eventos do robô...</div>
          ) : (
            logs.map(log => {
              const time = new Date(log.created_at).toLocaleTimeString('pt-BR');
              const isError = log.event_type === 'error';
              const isQual = log.event_type === 'qualified';
              const isDispatch = log.event_type === 'dispatch';

              return (
                <div key={log.id} className="flex items-start gap-2 text-[11px] leading-relaxed">
                  <span className="text-zinc-600 shrink-0">[{time}]</span>
                  <span className={`shrink-0 uppercase font-bold ${
                    isError ? 'text-red-400' : isQual ? 'text-amber-400' : isDispatch ? 'text-[#E5FF00]' : 'text-zinc-400'
                  }`}>
                    {log.event_type}:
                  </span>
                  <span className={isError ? 'text-red-300' : isQual ? 'text-amber-200 font-bold' : 'text-zinc-300'}>
                    {log.details}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. GAVETA / MODAL DE CHAT COM O LEAD */}
      <AnimatePresence>
        {selectedLeadForChat && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border-4 border-zinc-950 w-full max-w-2xl h-[600px] flex flex-col shadow-[12px_12px_0_0_#000]"
            >
              {/* Header do Chat */}
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#E5FF00]/10 border border-[#E5FF00]/40 flex items-center justify-center font-mono font-black text-xs text-[#E5FF00]">
                    {selectedLeadForChat.company_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-mono font-bold text-sm text-zinc-100">
                      {selectedLeadForChat.company_name}
                    </h4>
                    <p className="font-mono text-xs text-zinc-400">
                      {formatPhoneDisplay(selectedLeadForChat.phone)} • {selectedLeadForChat.city}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleTakeover(selectedLeadForChat)}
                    className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border transition-colors cursor-pointer ${
                      selectedLeadForChat.human_takeover
                        ? 'bg-red-950/60 text-red-300 border-red-700'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {selectedLeadForChat.human_takeover ? 'Devolver para IA' : 'Assumir Conversa'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLead(selectedLeadForChat)}
                    className="px-2.5 py-1.5 bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-700 font-mono text-xs font-bold uppercase transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Excluir este lead e todo o histórico"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                  <button
                    onClick={() => setSelectedLeadForChat(null)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-zinc-950/80">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 font-mono text-xs">
                    Nenhuma mensagem registrada ainda para este lead.
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isLead = msg.sender === 'lead';
                    const isHuman = msg.sender === 'human';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isLead ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 border font-mono text-xs ${
                            isLead
                              ? 'bg-zinc-900 text-zinc-100 border-zinc-800'
                              : isHuman
                              ? 'bg-amber-950/40 text-amber-100 border-amber-700'
                              : 'bg-[#E5FF00]/10 text-zinc-100 border-[#E5FF00]/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1 text-[10px] text-zinc-400">
                            <span className="font-bold uppercase">
                              {isLead ? 'Lead' : isHuman ? 'Operador (Você)' : 'IA SDR'}
                            </span>
                            <span>•</span>
                            <span>{new Date(msg.created_at).toLocaleTimeString('pt-BR')}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input de Envio Manual */}
              <form onSubmit={handleSendManualMessage} className="p-3 border-t border-zinc-900 bg-zinc-900/60 flex gap-2">
                <input
                  type="text"
                  value={manualMessageText}
                  onChange={e => setManualMessageText(e.target.value)}
                  placeholder="Digite sua resposta manual..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 p-2.5 font-mono text-xs text-zinc-100 focus:outline-none focus:border-[#E5FF00]"
                />
                <button
                  type="submit"
                  disabled={isSendingManual || !manualMessageText.trim()}
                  className="px-4 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono font-bold text-xs uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL DE CONFIGURAÇÕES AVANÇADAS DA AUTOMAÇÃO */}
      <AnimatePresence>
        {isSettingsOpen && editSettings && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border-4 border-zinc-950 w-full max-w-3xl max-h-[88vh] flex flex-col shadow-[12px_12px_0_0_#000]"
            >
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#E5FF00]" />
                  <h3 className="font-mono text-sm font-black uppercase tracking-wider text-zinc-100">
                    Configurações Gerais da Automação
                  </h3>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-5 font-mono text-xs">
                {/* Seleção de Perfil Operacional Pré-definido */}
                <div className="p-4 bg-zinc-900 border-2 border-zinc-800">
                  <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                    <div>
                      <span className="text-[11px] text-zinc-200 font-black uppercase tracking-wider block">
                        🎯 Perfil Operacional da Automação
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        Define os nichos minerados, abordagem de vendas e instruções da IA SDR
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Ativo no Robô: <strong className="text-[#E5FF00] uppercase font-bold">{settings?.profile === 'sergio' ? '🏭 Sérgio (Sal)' : '💻 Gustavo (Sites)'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* CARD GUSTAVO */}
                    <div
                      className={`p-3.5 border-2 text-left transition-all flex flex-col justify-between ${
                        editSettings.profile !== 'sergio'
                          ? 'bg-[#E5FF00]/10 border-[#E5FF00] text-white shadow-[3px_3px_0_0_#000]'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-[#E5FF00]">💻 Perfil Gustavo</span>
                          {editSettings.profile !== 'sergio' && (
                            <span className="text-[9px] bg-[#E5FF00] text-zinc-950 font-black px-1.5 py-0.5">SELECIONADO</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-200 font-bold mt-1">
                          Sites de Alta Conversão, SEO para IAs (GEO) & Sistemas
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1 font-sans">
                          Focado em prestadores de serviços, clínicas, advogados e comércios locais para modernização digital.
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyProfilePresetToForm('gustavo')}
                          className="text-[10px] text-zinc-300 hover:text-[#E5FF00] underline font-mono cursor-pointer"
                        >
                          Carregar dados no form
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleSwitchProfile('gustavo');
                            setIsSettingsOpen(false);
                          }}
                          disabled={isSwitchingProfile}
                          className="px-2.5 py-1 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-zinc-950"
                        >
                          ⚡ Ativar Agora
                        </button>
                      </div>
                    </div>

                    {/* CARD SÉRGIO */}
                    <div
                      className={`p-3.5 border-2 text-left transition-all flex flex-col justify-between ${
                        editSettings.profile === 'sergio'
                          ? 'bg-amber-500/10 border-amber-500 text-white shadow-[3px_3px_0_0_#000]'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-amber-400">🏭 Perfil Sérgio</span>
                          {editSettings.profile === 'sergio' && (
                            <span className="text-[9px] bg-amber-400 text-zinc-950 font-black px-1.5 py-0.5">SELECIONADO</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-200 font-bold mt-1">
                          LeadCore Sal Industrial • Venda de Sal Fabril B2B
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1 font-sans">
                          Focado em indústrias químicas, laticínios, curtumes, frigoríficos e tratamento de água por tonelada.
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyProfilePresetToForm('sergio')}
                          className="text-[10px] text-zinc-300 hover:text-amber-400 underline font-mono cursor-pointer"
                        >
                          Carregar dados no form
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleSwitchProfile('sergio');
                            setIsSettingsOpen(false);
                          }}
                          disabled={isSwitchingProfile}
                          className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-mono text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border border-zinc-950"
                        >
                          ⚡ Ativar Agora
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Horários, Cota e Intervalos entre Disparos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold uppercase">
                      Limite de Disparos/Dia
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={editSettings.daily_limit}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 10;
                        setEditSettings({ ...editSettings, daily_limit: val });
                        setAntiBanConfig(prev => ({ ...prev, daily_limit: val }));
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 font-mono font-bold focus:border-[#E5FF00] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold uppercase">
                      Início do Horário
                    </label>
                    <input
                      type="text"
                      value={editSettings.start_hour}
                      onChange={e => setEditSettings({ ...editSettings, start_hour: e.target.value })}
                      placeholder="09:00"
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 font-mono focus:border-[#E5FF00] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold uppercase">
                      Término do Horário
                    </label>
                    <input
                      type="text"
                      value={editSettings.end_hour}
                      onChange={e => setEditSettings({ ...editSettings, end_hour: e.target.value })}
                      placeholder="17:30"
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 font-mono focus:border-[#E5FF00] outline-none"
                    />
                  </div>
                </div>

                {/* Intervalo em Minutos da Esteira de Prospecção */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold uppercase">
                      Intervalo Mínimo entre Leads (min)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={editSettings.min_interval_mins}
                      onChange={e => {
                        const val = Math.max(1, parseInt(e.target.value) || 15);
                        setEditSettings({
                          ...editSettings,
                          min_interval_mins: val,
                          max_interval_mins: Math.max(val, editSettings.max_interval_mins || 35)
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 font-mono font-bold focus:border-[#E5FF00] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1.5 font-bold uppercase">
                      Intervalo Máximo entre Leads (min)
                    </label>
                    <input
                      type="number"
                      min={editSettings.min_interval_mins || 1}
                      max={240}
                      value={editSettings.max_interval_mins}
                      onChange={e => {
                        const val = Math.max(editSettings.min_interval_mins || 1, parseInt(e.target.value) || 35);
                        setEditSettings({ ...editSettings, max_interval_mins: val });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 font-mono font-bold focus:border-[#E5FF00] outline-none"
                    />
                  </div>
                </div>

                {/* Dias de funcionamento */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="workDaysOnly"
                    checked={editSettings.work_days_only}
                    onChange={e => setEditSettings({ ...editSettings, work_days_only: e.target.checked })}
                    className="accent-[#E5FF00] w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="workDaysOnly" className="text-zinc-300 font-bold cursor-pointer">
                    Operar apenas em dias úteis (Segunda a Sexta)
                  </label>
                </div>

                {/* Segmentos Alvo */}
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-bold uppercase">
                    Segmentos Alvo (API Google SerpAPI)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editSettings.target_segments.map(seg => (
                      <span key={seg} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center gap-1.5">
                        <span>{seg}</span>
                        <button
                          type="button"
                          onClick={() => setEditSettings({
                            ...editSettings,
                            target_segments: editSettings.target_segments.filter(s => s !== seg)
                          })}
                          className="text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSegmentInput}
                      onChange={e => setNewSegmentInput(e.target.value)}
                      placeholder="Adicionar novo segmento..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 outline-none focus:border-[#E5FF00]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newSegmentInput.trim()) {
                          setEditSettings({
                            ...editSettings,
                            target_segments: [...editSettings.target_segments, newSegmentInput.trim()]
                          });
                          setNewSegmentInput('');
                        }
                      }}
                      className="px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Cidades Alvo */}
                <div>
                  <label className="block text-zinc-400 mb-1.5 font-bold uppercase">
                    Cidades / Regiões Alvo
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editSettings.target_cities.map(cit => (
                      <span key={cit} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center gap-1.5">
                        <span>{cit}</span>
                        <button
                          type="button"
                          onClick={() => setEditSettings({
                            ...editSettings,
                            target_cities: editSettings.target_cities.filter(c => c !== cit)
                          })}
                          className="text-zinc-500 hover:text-red-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCityInput}
                      onChange={e => setNewCityInput(e.target.value)}
                      placeholder="Adicionar cidade (ex: Campinas, SP)..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 p-2 text-zinc-100 outline-none focus:border-[#E5FF00]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCityInput.trim()) {
                          setEditSettings({
                            ...editSettings,
                            target_cities: [...editSettings.target_cities, newCityInput.trim()]
                          });
                          setNewCityInput('');
                        }
                      }}
                      className="px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 🎯 SELEÇÃO DE ESTRATÉGIAS DE COPYWRITING & GATILHOS DE CURIOSIDADE */}
                <div className="p-4 bg-zinc-900 border-2 border-zinc-800 space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#E5FF00]" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-100">
                        Modelos de Mensagem com Gatilho de Curiosidade
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#E5FF00] font-bold">
                      Gera até 3x mais respostas no WhatsApp
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                    Mensagens frias tradicionais com pitch de vendas são ignoradas. Escolha um dos modelos abaixo baseados em <strong>quebra de padrão</strong>, <strong>curiosidade irresistível</strong> e <strong>micro-perguntas</strong> que fazem o tomador de decisão responder imediatamente:
                  </p>

                  {/* GRADE DE MODELOS ESTRATÉGICOS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {COPYWRITING_PRESETS.map(preset => {
                      const isCurrent = editSettings.initial_message_template?.trim() === preset.template.trim();
                      return (
                        <div
                          key={preset.id}
                          onClick={() => {
                            soundEngine.playTemplateFlash();
                            setEditSettings(prev => prev ? ({ ...prev, initial_message_template: preset.template }) : null);
                          }}
                          className={`p-3 border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                            isCurrent
                              ? 'bg-[#E5FF00]/15 border-[#E5FF00] shadow-[3px_3px_0_0_#000]'
                              : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-950/80'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[9px] font-mono uppercase font-bold text-zinc-400">
                                {preset.category}
                              </span>
                              <span className={`text-[9px] font-black font-mono px-1.5 py-0.5 border ${preset.badgeColor}`}>
                                {preset.badge}
                              </span>
                            </div>
                            <h4 className="font-black text-xs text-zinc-100 line-clamp-1">
                              {preset.title}
                            </h4>
                            <p className="text-[10px] text-zinc-400 mt-1 font-sans line-clamp-2">
                              {preset.description}
                            </p>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-center justify-between">
                            <span className="text-[10px] text-[#E5FF00] font-mono uppercase font-black flex items-center gap-1">
                              {isCurrent ? '✓ Modelo Ativo' : '👉 Usar Este'}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono">
                              {preset.template.length} caracteres
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* CAMPO DO TEMPLATE EDITÁVEL */}
                  <div className="pt-2 border-t border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-zinc-200 font-bold uppercase text-[11px] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[#E5FF00]" />
                        <span>Texto da Mensagem Inicial (Disparo Outbound)</span>
                      </label>
                      
                      {/* BOTÕES DE INSERÇÃO DE TAGS */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Inserir tag:</span>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playMechanicalClick('secondary');
                            setEditSettings(prev => prev ? ({
                              ...prev,
                              initial_message_template: (prev.initial_message_template ? prev.initial_message_template.trim() + ' ' : '') + '{empresa}'
                            }) : null);
                          }}
                          className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-[#E5FF00] border border-zinc-700 font-mono text-[10px] font-bold cursor-pointer transition-colors"
                          title="Inserir nome da empresa minerada"
                        >
                          +{'{empresa}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playMechanicalClick('secondary');
                            setEditSettings(prev => prev ? ({
                              ...prev,
                              initial_message_template: (prev.initial_message_template ? prev.initial_message_template.trim() + ' ' : '') + '{cidade}'
                            }) : null);
                          }}
                          className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-[#E5FF00] border border-zinc-700 font-mono text-[10px] font-bold cursor-pointer transition-colors"
                          title="Inserir cidade do lead"
                        >
                          +{'{cidade}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playMechanicalClick('secondary');
                            setEditSettings(prev => prev ? ({
                              ...prev,
                              initial_message_template: (prev.initial_message_template ? prev.initial_message_template.trim() + ' ' : '') + '{segmento}'
                            }) : null);
                          }}
                          className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-[#E5FF00] border border-zinc-700 font-mono text-[10px] font-bold cursor-pointer transition-colors"
                          title="Inserir segmento/nicho da empresa"
                        >
                          +{'{segmento}'}
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={editSettings.initial_message_template}
                      onChange={e => setEditSettings({ ...editSettings, initial_message_template: e.target.value })}
                      placeholder="Escreva ou escolha um modelo acima..."
                      className="w-full bg-zinc-950 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-[#E5FF00] text-xs font-mono leading-relaxed"
                    />

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>
                        Tamanho: <strong className="text-zinc-200">{(editSettings.initial_message_template || '').length}</strong> caracteres
                      </span>
                      <span>
                        Tempo de digitação humanizada: <strong className="text-[#E5FF00]">{((editSettings.initial_message_template || '').length * 0.14).toFixed(1)}s</strong>
                      </span>
                    </div>

                    {/* PRÉ-VISUALIZAÇÃO EM TEMPO REAL ESTILO WHATSAPP */}
                    <div className="p-3 bg-zinc-950 border border-zinc-800/80 mt-2">
                      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                        <span className="text-[10px] text-zinc-400 font-mono uppercase font-bold flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-[#25D366]" />
                          <span>Pré-visualização no WhatsApp do Lead:</span>
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono">Exemplo: Clínica Sorriso • Sorocaba, SP</span>
                      </div>

                      <div className="bg-[#0b141a] p-3 border border-zinc-900 rounded max-w-xl">
                        <div className="bg-[#005c4b] text-zinc-100 p-3 rounded-lg rounded-tr-none text-xs leading-relaxed shadow-sm font-sans">
                          <p className="whitespace-pre-wrap">
                            {(editSettings.initial_message_template || '')
                              .replace(/\{empresa\}/g, 'Clínica Sorriso')
                              .replace(/\{cidade\}/g, 'Sorocaba, SP')
                              .replace(/\{segmento\}/g, 'Clínica Médica')}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1.5 text-[9px] text-zinc-300 font-mono">
                            <span>09:15</span>
                            <span className="text-[#53bdeb] font-black">✓✓</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instruções da IA SDR (Prompt do Robô) */}
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-zinc-300 font-bold uppercase flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-[#E5FF00]" />
                      <span>Instruções da IA SDR (Regras de Resposta & Qualificação)</span>
                    </label>
                    <span className="text-[10px] text-[#E5FF00] font-mono">Mossoró - RN (só se perguntarem) • Sem invenções</span>
                  </div>
                  <textarea
                    rows={5}
                    value={editSettings.ai_prompt || ''}
                    onChange={e => setEditSettings({ ...editSettings, ai_prompt: e.target.value })}
                    placeholder="Instruções para o atendimento da IA SDR..."
                    className="w-full bg-zinc-950 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-[#E5FF00] text-xs font-mono leading-relaxed"
                  />
                </div>

                {/* Provedor & Chave de IA */}
                <div className="p-3 bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-300 font-bold uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#E5FF00]" />
                      <span>Chave de API de IA (Google Gemini / OpenAI)</span>
                    </label>
                    <span className="text-[10px] text-zinc-500 font-mono">Opcional</span>
                  </div>
                  <input
                    type="password"
                    value={editSettings.ai_api_key || ''}
                    onChange={e => setEditSettings({ ...editSettings, ai_api_key: e.target.value })}
                    placeholder="Cole sua API Key aqui (ex: AIzaSy... ou sk-...)"
                    className="w-full bg-zinc-950 border border-zinc-800 p-2 text-zinc-100 outline-none focus:border-[#E5FF00]"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Se deixado em branco, o sistema utilizará o motor heurístico inteligente de qualificação em tempo real.
                  </p>
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="p-4 border-t border-zinc-900 bg-zinc-900/40 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-mono text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-5 py-2 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono font-bold text-xs uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. MODAL PARA ADICIONAR LEAD MANUALMENTE */}
      <AnimatePresence>
        {isManualLeadModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border-4 border-zinc-950 w-full max-w-md flex flex-col shadow-[12px_12px_0_0_#000]"
            >
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#E5FF00]" />
                  <h3 className="font-mono text-sm font-black uppercase tracking-wider text-zinc-100">
                    Cadastrar Lead na Automação
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualLeadModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => handleAddManualLead(e, false)} className="p-5 space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1 font-bold uppercase">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualLeadForm.company_name}
                    onChange={e => setManualLeadForm({ ...manualLeadForm, company_name: e.target.value })}
                    placeholder="Ex: Laticínio Bela Vista"
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-[#E5FF00]"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-bold uppercase">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualLeadForm.phone}
                    onChange={e => setManualLeadForm({ ...manualLeadForm, phone: e.target.value })}
                    placeholder="Ex: (15) 99876-5432 ou 5515998765432"
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-[#E5FF00]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold uppercase">
                      Cidade / UF
                    </label>
                    <input
                      type="text"
                      value={manualLeadForm.city}
                      onChange={e => setManualLeadForm({ ...manualLeadForm, city: e.target.value })}
                      placeholder="Ex: Sorocaba, SP"
                      className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-[#E5FF00]"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold uppercase">
                      Segmento
                    </label>
                    <input
                      type="text"
                      value={manualLeadForm.segment}
                      onChange={e => setManualLeadForm({ ...manualLeadForm, segment: e.target.value })}
                      placeholder="Ex: Laticínios"
                      className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-[#E5FF00]"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    * Não mina o Google. Apenas este número.
                  </span>

                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsManualLeadModalOpen(false)}
                      className="px-3.5 py-2 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-mono text-xs uppercase cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingManualLead}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-mono font-bold text-xs uppercase cursor-pointer disabled:opacity-50"
                    >
                      Salvar na Fila
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleAddManualLead(e, true)}
                      disabled={isSubmittingManualLead}
                      className="px-4 py-2 bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-mono font-black text-xs uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-[2px_2px_0_0_#fff]"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>{isSubmittingManualLead ? 'Disparando...' : '⚡ Salvar & Disparar Teste'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. MODAL PARA REGISTRAR RESPOSTA RECEBIDA NO WHATSAPP */}
      <AnimatePresence>
        {isRecordReplyModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border-4 border-zinc-950 w-full max-w-lg flex flex-col shadow-[12px_12px_0_0_#000]"
            >
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-mono text-sm font-black uppercase tracking-wider text-zinc-100">
                    Registrar Resposta Recebida no WhatsApp
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecordReplyModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRecordReplySubmit} className="p-5 space-y-4 font-mono text-xs">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Quando um lead responde no seu WhatsApp (ou para simular/testar a qualificação imediata da IA SDR),
                  informe os dados abaixo. O robô atualizará o status do lead para <strong className="text-emerald-400">Em Conversa</strong>,
                  incrementará o contador de respostas e gerará a réplica automaticamente se o piloto automático estiver ligado.
                </p>

                {replyFeedback && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-500/80 text-emerald-300 font-bold text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{replyFeedback}</span>
                  </div>
                )}

                <div>
                  <label className="block text-zinc-300 mb-1 font-bold uppercase">
                    Telefone / WhatsApp do Lead *
                  </label>
                  <input
                    type="text"
                    required
                    value={recordReplyForm.phone}
                    onChange={e => setRecordReplyForm({ ...recordReplyForm, phone: e.target.value })}
                    placeholder="Ex: 5516991440456 ou (16) 99144-0456"
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-emerald-400"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Pode ser apenas os números ou com formatação nacional/internacional.
                  </p>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1 font-bold uppercase">
                    Mensagem Recebida do Contato *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={recordReplyForm.message}
                    onChange={e => setRecordReplyForm({ ...recordReplyForm, message: e.target.value })}
                    placeholder="Ex: Olá, tenho interesse sim! Como funciona a contratação e qual o valor?"
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 text-zinc-100 outline-none focus:border-emerald-400 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-zinc-900">
                  <button
                    type="button"
                    onClick={() => setIsRecordReplyModalOpen(false)}
                    className="px-4 py-2 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-mono text-xs uppercase cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReply}
                    className="px-5 py-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-mono font-bold text-xs uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-zinc-950" />
                    <span>{isSubmittingReply ? 'Registrando...' : 'Confirmar e Notificar IA'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
