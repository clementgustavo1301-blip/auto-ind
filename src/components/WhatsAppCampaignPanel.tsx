'use client';

import { useState, useEffect, useMemo } from 'react';
import { Lead, IndustrialLead } from '@/types';
import { toDialablePhone, formatPhoneDisplay } from '@/lib/phone';
import { 
  Send, 
  Phone, 
  Smartphone, 
  CheckCheck, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Image as ImageIcon, 
  ShieldAlert, 
  Sliders, 
  Search, 
  UserCheck, 
  RotateCcw, 
  ExternalLink,
  ChevronRight,
  Smile,
  Paperclip,
  Mic,
  Camera,
  MoreVertical,
  ArrowLeft,
  QrCode,
  LogOut,
  Zap,
  X
} from 'lucide-react';

interface WhatsAppCampaignPanelProps {
  initialLeads?: (Lead | IndustrialLead)[];
  onBackToSearch?: () => void;
}

type LeadStatus = 'idle' | 'queued' | 'typing' | 'sent' | 'failed' | 'limit_reached';

interface CampaignLeadItem {
  id: string;
  lead: Lead | IndustrialLead;
  phone: string;
  selected: boolean;
  status: LeadStatus;
  queueId?: string;
  error?: string;
}

export function WhatsAppCampaignPanel({ initialLeads = [], onBackToSearch }: WhatsAppCampaignPanelProps) {
  // 1. Estado da Lista de Leads
  const [leadItems, setLeadItems] = useState<CampaignLeadItem[]>(() => {
    return initialLeads
      .filter(l => Boolean(l.whatsapp && l.whatsapp.trim().length > 0))
      .map(l => ({
        id: l.id,
        lead: l,
        phone: toDialablePhone(l.whatsapp || ''),
        selected: true,
        status: 'idle',
      }));
  });

  const [selectedLeadId, setSelectedLeadId] = useState<string>(() => {
    return leadItems.length > 0 ? leadItems[0].id : '';
  });

  const [leadSearch, setLeadSearch] = useState('');
  const [mobileSection, setMobileSection] = useState<'queue' | 'compose' | 'preview'>('queue');

  // 2. Modelo de Mensagem e Variáveis (Gatilho da Curiosidade de Alta Resposta)
  const [messageTemplate, setMessageTemplate] = useState<string>(
    '{{saudacao}}, {{nome}}! Tudo bem?\n\nEstava dando uma olhada aqui na {{empresa}} em {{cidade}} e reparei em um detalhe bem específico sobre a presença e demanda de vocês em {{categoria}} que me chamou atenção.\n\nÉ você mesmo que cuida dessa parte ou quem seria a melhor pessoa para eu falar?'
  );

  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [showSimulatedTyping, setShowSimulatedTyping] = useState<boolean>(false);

  // 3. Status da Conexão com o Microserviço
  const [serviceStatus, setServiceStatus] = useState<{
    connected: boolean;
    logged_in: boolean;
    sent_today: number;
    daily_limit: number;
    limit_reached: boolean;
    queue_length: number;
    phone?: string;
    push_name?: string;
    jid?: string;
  }>({
    connected: false,
    logged_in: false,
    sent_today: 0,
    daily_limit: 15,
    limit_reached: false,
    queue_length: 0,
  });

  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState<{ total: number; sent: number; queued: number }>({
    total: 0,
    sent: 0,
    queued: 0,
  });

  // Atualizar lista se initialLeads mudar
  useEffect(() => {
    if (initialLeads.length > 0) {
      const filtered = initialLeads
        .filter(l => Boolean(l.whatsapp && l.whatsapp.trim().length > 0))
        .map(l => ({
          id: l.id,
          lead: l,
          phone: toDialablePhone(l.whatsapp || ''),
          selected: true,
          status: 'idle' as LeadStatus,
        }));
      setLeadItems(filtered);
      if (filtered.length > 0 && !selectedLeadId) {
        setSelectedLeadId(filtered[0].id);
      }
    }
  }, [initialLeads]);

  // Consulta periódica do status do WhatsApp
  const fetchStatus = async () => {
    try {
      setIsCheckingStatus(true);
      const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          setServiceStatus(data.status);
        }

        // Atualizar status dos itens da fila local se houver correspondência
        if (Array.isArray(data.queue)) {
          setLeadItems(prev => {
            if (prev.length === 0 && data.queue.length > 0) {
              return data.queue.map((q: any) => ({
                id: q.id,
                lead: {
                  id: q.id,
                  name: q.phone ? `Lead ${formatPhoneDisplay(q.phone)}` : 'Destinatário',
                  phone: q.phone || '',
                  whatsapp: q.phone || '',
                  city: 'Fila Whatsmeow',
                  category: 'Campanha',
                } as any,
                phone: toDialablePhone(q.phone || ''),
                selected: true,
                status: q.status as LeadStatus,
                queueId: q.id,
                error: q.error,
              }));
            }

            return prev.map(item => {
              const cleanPhone = item.phone.replace(/\D/g, '');
              const foundInQueue = data.queue.find((q: any) => {
                if (item.queueId && q.id === item.queueId) return true;
                const qPhone = (q.phone || '').replace(/\D/g, '');
                if (qPhone && (qPhone === cleanPhone || qPhone === '55' + cleanPhone || cleanPhone === '55' + qPhone)) {
                  return true;
                }
                return false;
              });

              if (foundInQueue) {
                return {
                  ...item,
                  status: foundInQueue.status as LeadStatus,
                  error: foundInQueue.error,
                  queueId: foundInQueue.id,
                };
              }
              return item;
            });
          });
        }
      } else {
        setServiceStatus(prev => ({ ...prev, connected: false, logged_in: false, phone: undefined, push_name: undefined, jid: undefined }));
      }
    } catch (e) {
      console.error('Falha ao checar status do WhatsApp:', e);
      setServiceStatus(prev => ({ ...prev, connected: false, logged_in: false, phone: undefined, push_name: undefined, jid: undefined }));
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Gerenciamento de Detalhes da Falha e Reenvio
  const [selectedErrorLead, setSelectedErrorLead] = useState<CampaignLeadItem | null>(null);
  const [editingPhone, setEditingPhone] = useState<string>('');

  const handleRetryLead = async (leadToRetry: CampaignLeadItem, customPhone?: string) => {
    const phoneToSend = toDialablePhone(customPhone || leadToRetry.phone);
    if (!phoneToSend) {
      alert('Número de telefone inválido.');
      return;
    }

    const l = leadToRetry.lead;
    const empresaNome = ('razaoSocial' in l && l.razaoSocial) ? l.razaoSocial : l.name;
    const primeiroNome = l.name.split(' ')[0] || l.name;

    const finalMsg = messageTemplate
      .replace(/{{nome}}/gi, primeiroNome)
      .replace(/{{empresa}}/gi, empresaNome)
      .replace(/{{cidade}}/gi, l.city || 'sua região')
      .replace(/{{categoria}}/gi, l.category || 'seu setor')
      .replace(/{{telefone}}/gi, phoneToSend)
      .replace(/{{saudacao}}/gi, currentGreeting);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneToSend,
          message: finalMsg,
          media_url: mediaUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.queued && data.queue_id) {
        setLeadItems(prev => prev.map(it => 
          it.id === leadToRetry.id 
            ? { ...it, status: 'queued', queueId: data.queue_id, error: undefined, phone: phoneToSend }
            : it
        ));
        setSelectedErrorLead(null);
        setEditingPhone('');
        fetchStatus();
      } else {
        alert('Erro ao reenviar: ' + (data.error || 'Falha no microserviço'));
      }
    } catch (e: any) {
      alert('Erro de comunicação: ' + e?.message);
    }
  };

  // 4. Configurações Dinâmicas Anti-Ban (Espaçamento, Digitação e Limite Diário)
  const [antiBanConfig, setAntiBanConfig] = useState<{
    daily_limit: number;
    min_delay_sec: number;
    max_delay_sec: number;
    typing_speed_ms: number;
    min_typing_sec: number;
    max_typing_sec: number;
    sent_today: number;
  }>({
    daily_limit: 15,
    min_delay_sec: 30,
    max_delay_sec: 70,
    typing_speed_ms: 150,
    min_typing_sec: 3,
    max_typing_sec: 15,
    sent_today: 0,
  });

  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string>('');
  const [simulatedCountdown, setSimulatedCountdown] = useState<number | null>(null);

  // Carregar configurações do microserviço
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/whatsapp/config', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAntiBanConfig(prev => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error('Falha ao carregar configurações anti-ban:', e);
    }
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingConfig(true);
    setConfigSuccessMsg('');

    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(antiBanConfig),
      });

      if (res.ok) {
        setConfigSuccessMsg('Configurações salvas e ativas com sucesso no microserviço!');
        fetchStatus();
        setTimeout(() => setConfigSuccessMsg(''), 4000);
      } else {
        alert('Erro ao salvar configurações no microserviço.');
      }
    } catch (err: any) {
      alert('Falha na comunicação: ' + err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleResetCounter = async () => {
    if (!confirm('Deseja zerar o contador de mensagens enviadas hoje para 0?')) return;
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent_today: 0 }),
      });
      if (res.ok) {
        setAntiBanConfig(prev => ({ ...prev, sent_today: 0 }));
        fetchStatus();
        setConfigSuccessMsg('Contador diário de disparos zerado!');
        setTimeout(() => setConfigSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      alert('Erro ao resetar contador: ' + err.message);
    }
  };

  const applyPreset = (preset: 'safe' | 'medium' | 'fast' | 'test') => {
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

  // 5. Gerenciamento do Modal de QR Code e Conexão WhatsApp
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [qrCodeData, setQRCodeData] = useState<{
    connected?: boolean;
    logged_in?: boolean;
    has_qr?: boolean;
    qr_base64?: string;
    qr_code?: string;
    status?: string;
  } | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const fetchQR = async () => {
    try {
      setIsLoadingQR(true);
      const res = await fetch('/api/whatsapp/qr', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setQRCodeData(data);
        setQrError(null);
        if (data.logged_in || data.connected) {
          fetchStatus();
        }
      } else {
        const errData = await res.json().catch(() => null);
        setQrError(errData?.error || 'Microserviço WhatsApp indisponível na porta 5001.');
      }
    } catch (e: any) {
      console.error('Falha ao buscar QR code:', e);
      setQrError('Falha ao conectar ao servidor local do WhatsApp.');
    } finally {
      setIsLoadingQR(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar a sessão atual do WhatsApp para escanear outro aparelho?')) return;
    try {
      setIsDisconnecting(true);
      setServiceStatus(prev => ({
        ...prev,
        connected: false,
        logged_in: false,
        phone: undefined,
        push_name: undefined,
        jid: undefined,
      }));
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setShowQRModal(true);
      await fetchQR();
      await fetchStatus();
    } catch (e: any) {
      alert('Falha na comunicação: ' + e?.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  useEffect(() => {
    if (!showQRModal) return;
    fetchQR();
    const interval = setInterval(fetchQR, 3000);
    return () => clearInterval(interval);
  }, [showQRModal]);

  // 6. Disparo de Teste Rápido (Campo de Teste)
  const [testPhone, setTestPhone] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>(
    'Olá! Esta é uma mensagem de teste enviada pela automação WhatsApp com digitação humanizada.'
  );
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testFeedback, setTestFeedback] = useState<{
    success: boolean;
    message: string;
    queue_id?: string;
    queue_position?: number;
    phone?: string;
    time?: string;
    error?: string;
  } | null>(null);

  const handleSendTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = toDialablePhone(testPhone);
    if (!clean) {
      alert('Por favor, informe o número de telefone de teste.');
      return;
    }

    if (!serviceStatus.logged_in) {
      setShowQRModal(true);
      alert('O WhatsApp ainda não está conectado! Conecte seu aparelho escaneando o QR Code.');
      return;
    }

    setIsSendingTest(true);
    setTestFeedback(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean,
          message: testMessage,
          media_url: mediaUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      const now = new Date().toLocaleTimeString('pt-BR');

      if (data.queued && data.queue_id) {
        setTestFeedback({
          success: true,
          message: `Mensagem de teste enfileirada com sucesso! O worker iniciará a digitação humanizada em instantes.`,
          queue_id: data.queue_id,
          queue_position: data.queue_position || 1,
          phone: clean,
          time: now,
        });

        // Adicionar também na lista de leads para monitorar visualmente na fila
        const testItem: CampaignLeadItem = {
          id: 'test_' + Date.now(),
          lead: {
            id: 'test_' + Date.now(),
            name: 'Contato de Teste (' + clean + ')',
            country: 'Brasil',
            whatsapp: clean,
            city: 'Teste',
            category: 'Validação',
          },
          phone: clean,
          selected: false,
          status: 'queued',
          queueId: data.queue_id,
        };

        setLeadItems(prev => [testItem, ...prev]);
        setSelectedLeadId(testItem.id);
        fetchStatus();
      } else {
        setTestFeedback({
          success: false,
          message: data.error || 'Erro ao enfileirar mensagem de teste.',
          error: data.error,
          phone: clean,
          time: now,
        });
      }
    } catch (err: any) {
      setTestFeedback({
        success: false,
        message: 'Falha na requisição: ' + (err?.message || 'Erro de rede'),
        error: err?.message,
        phone: clean,
        time: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const [displayedTypingText, setDisplayedTypingText] = useState<string>('');
  const [isTypewriting, setIsTypewriting] = useState<boolean>(false);

  // Monitora se há itens ativos na fila para acelerar a taxa de atualização
  const hasActiveQueue = useMemo(() => {
    return leadItems.some(it => it.status === 'queued' || it.status === 'typing');
  }, [leadItems]);

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    const interval = setInterval(fetchStatus, hasActiveQueue ? 1500 : 4000);
    return () => clearInterval(interval);
  }, [hasActiveQueue]);

  // Seguir automaticamente o contato que está sendo enviado/digitado na fila
  useEffect(() => {
    const typingLead = leadItems.find(item => item.status === 'typing');
    if (typingLead && typingLead.id !== selectedLeadId) {
      setSelectedLeadId(typingLead.id);
    }
  }, [leadItems, selectedLeadId]);

  // Selecionar lead ativo para o simulador
  const activeLead = useMemo(() => {
    return leadItems.find(item => item.id === selectedLeadId) || leadItems[0];
  }, [leadItems, selectedLeadId]);

  // Saudação automática baseada no horário atual
  const currentGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // Interpolação dinâmica da mensagem para o preview
  const interpolatedMessage = useMemo(() => {
    if (!activeLead) return messageTemplate;
    const l = activeLead.lead;
    const empresaNome = ('razaoSocial' in l && l.razaoSocial) ? l.razaoSocial : l.name;
    const primeiroNome = l.name.split(' ')[0] || l.name;

    return messageTemplate
      .replace(/{{nome}}/gi, primeiroNome)
      .replace(/{{empresa}}/gi, empresaNome)
      .replace(/{{cidade}}/gi, l.city || 'sua região')
      .replace(/{{categoria}}/gi, l.category || 'seu setor')
      .replace(/{{telefone}}/gi, activeLead.phone || '')
      .replace(/{{saudacao}}/gi, currentGreeting);
  }, [messageTemplate, activeLead, currentGreeting]);

  // Estimativa de tempo de digitação humanizada baseada nas configurações ativas
  const estimatedTypingSec = useMemo(() => {
    const chars = interpolatedMessage.length;
    const ms = chars * antiBanConfig.typing_speed_ms;
    const clampedSec = Math.min(
      Math.max(ms / 1000, antiBanConfig.min_typing_sec),
      antiBanConfig.max_typing_sec
    );
    return clampedSec.toFixed(1);
  }, [interpolatedMessage, antiBanConfig]);

  // Efeito Máquina de Escrever com Oscilações Orgânicas Humanas (Anti-Robô)
  useEffect(() => {
    const isTyping = activeLead?.status === 'typing' || showSimulatedTyping;
    if (!isTyping) {
      setDisplayedTypingText(interpolatedMessage);
      setIsTypewriting(false);
      return;
    }

    setIsTypewriting(true);
    setDisplayedTypingText('');

    let currentIdx = 0;
    const fullText = interpolatedMessage;
    const totalChars = fullText.length;
    if (totalChars === 0) {
      setIsTypewriting(false);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let isCorrecting = false;

    const typeNextChar = () => {
      if (currentIdx >= totalChars) {
        setIsTypewriting(false);
        return;
      }

      const targetChar = fullText[currentIdx];

      // 3% de chance de erro de digitação humano (apenas em letras normais, não em quebras/espaços)
      const canMakeTypo = !isCorrecting && currentIdx > 3 && /[a-zA-Záéíóúãõç]/i.test(targetChar) && Math.random() < 0.035;

      if (canMakeTypo) {
        // Digita uma tecla errada aleatória
        isCorrecting = true;
        const typoKeys = 'abcdefghijklmnopqrstuvwxyz';
        const randomTypo = typoKeys[Math.floor(Math.random() * typoKeys.length)];
        setDisplayedTypingText(fullText.slice(0, currentIdx) + randomTypo);

        // Percebe o erro após 160ms - 280ms, apaga (backspace) e corrige
        timeoutId = setTimeout(() => {
          setDisplayedTypingText(fullText.slice(0, currentIdx));
          // Leve pausa de 100-180ms e digita a tecla correta
          timeoutId = setTimeout(() => {
            currentIdx++;
            setDisplayedTypingText(fullText.slice(0, currentIdx));
            isCorrecting = false;
            timeoutId = setTimeout(typeNextChar, 80 + Math.random() * 60);
          }, 110 + Math.random() * 80);
        }, 180 + Math.random() * 120);
        return;
      }

      currentIdx++;
      setDisplayedTypingText(fullText.slice(0, currentIdx));

      // Cálculo de oscilação humana dinâmica para o próximo caractere
      let nextDelay: number;
      const baseMs = Math.max(30, Math.min(110, antiBanConfig.typing_speed_ms * 0.65));

      if (targetChar === '\n') {
        // Quebra de linha / parágrafo: pausa cognitiva para organizar o pensamento
        nextDelay = 550 + Math.random() * 450;
      } else if (targetChar === '.' || targetChar === '!' || targetChar === '?') {
        // Fim de oração: pausa reflexiva
        nextDelay = 400 + Math.random() * 350;
      } else if (targetChar === ',' || targetChar === ';' || targetChar === ':') {
        // Vírgula: pausa de pontuação
        nextDelay = 220 + Math.random() * 200;
      } else if (targetChar === ' ') {
        // Espaço entre palavras: cadência natural
        nextDelay = 70 + Math.random() * 90;
      } else {
        // Caractere normal com jitter dinâmico de ±40% (rajadas rápidas vs teclas lentas)
        const jitter = 0.60 + Math.random() * 0.80; // 0.6x a 1.4x
        nextDelay = Math.floor(baseMs * jitter);

        // 4% de chance de micro-hesitação (pessoa pensando na próxima palavra)
        if (Math.random() < 0.04) {
          nextDelay += 250 + Math.random() * 280;
        }
      }

      timeoutId = setTimeout(typeNextChar, nextDelay);
    };

    // Pequena hesitação inicial antes do primeiro toque (reação humana)
    timeoutId = setTimeout(typeNextChar, 350);

    return () => clearTimeout(timeoutId);
  }, [activeLead?.id, activeLead?.status, showSimulatedTyping, interpolatedMessage, antiBanConfig.typing_speed_ms]);

  // Simulação interativa com cronômetro do tempo de digitação no WhatsApp
  const runLiveTypingSimulation = () => {
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
      }
    }, 100);
  };

  // Filtragem da lista
  const filteredLeadItems = useMemo(() => {
    if (!leadSearch.trim()) return leadItems;
    const s = leadSearch.toLowerCase();
    return leadItems.filter(item => 
      item.lead.name.toLowerCase().includes(s) ||
      item.phone.includes(s) ||
      item.lead.city.toLowerCase().includes(s) ||
      item.lead.category.toLowerCase().includes(s)
    );
  }, [leadItems, leadSearch]);

  const selectedCount = useMemo(() => {
    return leadItems.filter(item => item.selected).length;
  }, [leadItems]);

  const handleToggleSelectAll = (check: boolean) => {
    setLeadItems(prev => prev.map(item => ({ ...item, selected: check })));
  };

  const handleToggleItem = (id: string) => {
    setLeadItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  const insertTag = (tag: string) => {
    setMessageTemplate(prev => prev + ` {{${tag}}}`);
  };

  // Disparo em lote para a fila
  const handleStartBatchDispatch = async () => {
    const toSend = leadItems.filter(item => item.selected && item.status !== 'sent');
    if (toSend.length === 0) {
      alert('Nenhum lead selecionado para envio.');
      return;
    }

    if (!serviceStatus.logged_in) {
      alert('O WhatsApp ainda não está autenticado! Abra o QR Code e escaneie com seu celular.');
      return;
    }

    setIsSending(true);
    setCampaignProgress({ total: toSend.length, sent: 0, queued: 0 });

    let queuedCount = 0;

    for (const item of toSend) {
      const l = item.lead;
      const empresaNome = ('razaoSocial' in l && l.razaoSocial) ? l.razaoSocial : l.name;
      const primeiroNome = l.name.split(' ')[0] || l.name;

      const finalMsg = messageTemplate
        .replace(/{{nome}}/gi, primeiroNome)
        .replace(/{{empresa}}/gi, empresaNome)
        .replace(/{{cidade}}/gi, l.city || 'sua região')
        .replace(/{{categoria}}/gi, l.category || 'seu setor')
        .replace(/{{telefone}}/gi, item.phone || '')
        .replace(/{{saudacao}}/gi, currentGreeting);

      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: item.phone,
            message: finalMsg,
            media_url: mediaUrl.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (data.queued && data.queue_id) {
          queuedCount++;
          setLeadItems(prev => prev.map(it => 
            it.id === item.id ? { ...it, status: 'queued', queueId: data.queue_id } : it
          ));
        } else {
          setLeadItems(prev => prev.map(it => 
            it.id === item.id ? { ...it, status: 'failed', error: data.error || 'Erro ao enfileirar' } : it
          ));
        }
      } catch (err: any) {
        setLeadItems(prev => prev.map(it => 
          it.id === item.id ? { ...it, status: 'failed', error: err?.message || 'Falha de rede' } : it
        ));
      }

      setCampaignProgress(prev => ({ ...prev, queued: queuedCount }));
    }

    setIsSending(false);
    fetchStatus();
  };

  return (
    <div className="w-full flex flex-col gap-5 sm:gap-8">
      {/* MODAL DE CONEXÃO DO WHATSAPP (QR CODE - BOTTOM SHEET NO MOBILE) */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white border-t-4 sm:border-4 border-zinc-950 p-5 sm:p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_-8px_0_0_#18181B] sm:shadow-[12px_12px_0_0_#18181B] flex flex-col gap-5 sm:gap-6 relative pb-safe">
            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 border-2 border-zinc-300"
              title="Fechar"
            >
              <X size={20} />
            </button>

            <div className="border-b-4 border-zinc-950 pb-3 pr-12">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#25D366] rounded-full animate-ping" />
                <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest font-black text-zinc-600">
                  Pareamento Seguro Whatsmeow
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black uppercase text-zinc-950 mt-1">
                Conectar WhatsApp
              </h3>
            </div>

            {serviceStatus.logged_in ? (
              <div className="flex flex-col items-center gap-4 py-4 sm:py-6 text-center">
                <div className="w-16 h-16 bg-[#25D366] text-zinc-950 rounded-full flex items-center justify-center border-4 border-zinc-950 shadow-[4px_4px_0_0_#18181B]">
                  <CheckCircle2 size={40} />
                </div>
                <h4 className="text-lg sm:text-xl font-black uppercase text-zinc-950">WhatsApp Conectado com Sucesso!</h4>
                <p className="text-xs font-mono text-zinc-600 max-w-sm">
                  {serviceStatus.push_name && <b>{serviceStatus.push_name} </b>}
                  {serviceStatus.phone && <span>(+{serviceStatus.phone}) </span>}
                  está autenticado e pronto para disparos com proteção anti-ban.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowQRModal(false)}
                    className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 bg-zinc-950 text-[#E5FF00] font-black uppercase text-xs border-2 border-zinc-950 hover:bg-zinc-800 transition-colors"
                  >
                    Concluir
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="w-full sm:w-auto min-h-[48px] px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-950 border-2 border-red-600 font-mono text-xs font-bold uppercase transition-colors"
                  >
                    {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </div>
              </div>
            ) : qrCodeData?.qr_base64 ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-xs font-mono text-zinc-600">
                  Escaneie o QR Code abaixo com o WhatsApp do seu celular:
                </p>

                {/* Imagem do QR Code */}
                <div className="p-3 sm:p-4 bg-white border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B]">
                  <img
                    src={`data:image/png;base64,${qrCodeData.qr_base64}`}
                    alt="WhatsApp QR Code"
                    className="w-52 h-52 sm:w-64 sm:h-64 object-contain"
                  />
                </div>

                {/* Instruções */}
                <div className="w-full bg-zinc-50 border-2 border-zinc-200 p-3.5 sm:p-4 text-left font-mono text-xs text-zinc-700 flex flex-col gap-1.5">
                  <span className="font-black uppercase text-zinc-950 mb-1">Como conectar:</span>
                  <div>1. Abra o WhatsApp no celular</div>
                  <div>2. Toque em <b>Mais opções</b> (Android) ou <b>Configurações</b> (iPhone)</div>
                  <div>3. Toque em <b>Aparelhos conectados</b> &gt; <b>Conectar um aparelho</b></div>
                  <div>4. Aponte a câmera para este código na tela</div>
                </div>

                <div className="flex items-center justify-between w-full pt-2 text-[11px] font-mono text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw size={12} className={isLoadingQR ? 'animate-spin' : ''} />
                    Atualizando automaticamente...
                  </span>
                  <button
                    type="button"
                    onClick={fetchQR}
                    className="font-bold underline text-zinc-800 hover:text-zinc-950 py-1 px-2"
                  >
                    Recarregar Agora
                  </button>
                </div>
              </div>
            ) : qrError ? (
              <div className="flex flex-col items-center gap-4 py-6 sm:py-8 text-center font-mono">
                <AlertCircle size={36} className="text-red-600" />
                <span className="font-bold text-sm text-red-600 uppercase">
                  Microserviço WhatsApp Offline
                </span>
                <p className="text-xs text-zinc-600 max-w-sm">
                  {qrError}
                </p>
                <div className="w-full bg-zinc-50 border-2 border-zinc-200 p-3 text-left font-mono text-[11px] text-zinc-700 flex flex-col gap-1.5">
                  <span className="font-black uppercase text-zinc-950">Como iniciar o microserviço:</span>
                  <div>1. Abra o terminal na pasta do projeto</div>
                  <div>2. Execute: <code className="bg-zinc-200 px-1 py-0.5 font-bold text-zinc-950 break-all">cd whatsapp-service && .\start.bat</code></div>
                  <div>3. Ou inicie o executável: <code className="bg-zinc-200 px-1 py-0.5 font-bold text-zinc-950">whatsapp-service.exe</code></div>
                </div>
                <button
                  type="button"
                  onClick={fetchQR}
                  className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-black uppercase transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 sm:py-12 text-center font-mono">
                <RefreshCw size={36} className="animate-spin text-zinc-800" />
                <span className="font-bold text-sm text-zinc-800 uppercase">
                  Gerando QR Code de Pareamento...
                </span>
                <p className="text-xs text-zinc-500 max-w-xs">
                  Aguarde um instante enquanto o microserviço Whatsmeow estabelece o canal de autenticação.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DA FALHA (BOTTOM SHEET NO MOBILE) */}
      {selectedErrorLead && (
        <div id="modal-error-details" className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white border-t-4 sm:border-4 border-zinc-950 p-5 sm:p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_-8px_0_0_#18181B] sm:shadow-[12px_12px_0_0_#18181B] flex flex-col gap-5 sm:gap-6 relative pb-safe">
            <button
              id="btn-close-error-modal"
              type="button"
              onClick={() => setSelectedErrorLead(null)}
              className="absolute top-4 right-4 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 border-2 border-zinc-300"
              title="Fechar"
            >
              <X size={20} />
            </button>

            <div className="border-b-4 border-zinc-950 pb-3 pr-12">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
                <span className="font-mono text-[11px] sm:text-xs uppercase tracking-widest font-black text-red-600">
                  Diagnóstico de Envio WhatsApp
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black uppercase text-zinc-950 mt-1 flex items-center gap-2">
                <AlertCircle size={24} className="text-red-600 shrink-0" /> Detalhes da Falha
              </h3>
            </div>

            {/* Informações do Contato */}
            <div className="bg-zinc-100 border-2 border-zinc-950 p-3.5 sm:p-4 font-mono text-xs flex flex-col gap-2">
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 font-bold uppercase shrink-0">Contato:</span>
                <span className="font-black text-zinc-950 uppercase text-right truncate">{selectedErrorLead.lead.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 font-bold uppercase shrink-0">Telefone:</span>
                <span className="font-bold text-zinc-950">{formatPhoneDisplay(selectedErrorLead.phone)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500 font-bold uppercase shrink-0">Localidade:</span>
                <span className="text-zinc-800 text-right">{selectedErrorLead.lead.city}</span>
              </div>
            </div>

            {/* Motivo do Erro Retornado */}
            <div className="bg-red-50 border-2 border-red-600 p-3.5 sm:p-4 font-mono text-xs flex flex-col gap-2">
              <span className="text-[10px] uppercase font-black text-red-700 tracking-wider">
                Motivo da Falha / Resposta do WhatsApp:
              </span>
              <p className="font-black text-red-950 text-xs sm:text-sm leading-snug break-words">
                {selectedErrorLead.error || 'Número não registrado no WhatsApp ou formato de telefone inválido'}
              </p>
              
              {/* Explicação e Diagnóstico */}
              <div className="mt-2 pt-2 border-t border-red-200 text-[11px] text-red-900 leading-relaxed">
                {/lid|não possui|not registered|não está registrado/i.test(selectedErrorLead.error || '') ? (
                  <span>
                    💡 <b>Diagnóstico:</b> O WhatsApp confirmou que não existe conta ativa neste número. Geralmente é um <b>telefone fixo</b> (ex.: França +33 1…, que são fixos; celulares franceses começam com +33 6 ou +33 7). Procure o celular/WhatsApp da empresa no site ou redes sociais e corrija abaixo.
                  </span>
                ) : (selectedErrorLead.error || '').toLowerCase().includes('limit') ? (
                  <span>
                    💡 <b>Diagnóstico:</b> O limite diário anti-ban configurado foi atingido para a conta hoje. Você pode aumentar o limite no painel ou zerar o contador diário.
                  </span>
                ) : (
                  <span>
                    💡 <b>Diagnóstico:</b> Falha na tentativa de envio. Verifique o número: para o exterior use <b>+DDI</b> (ex.: +33 6 12 34 56 78); para o Brasil, DDD + número.
                  </span>
                )}
              </div>
            </div>

            {/* Opção de Corrigir Número e Tentar Novamente */}
            <div className="border-t-2 border-zinc-200 pt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase font-bold text-zinc-800">
                  Corrigir Número do WhatsApp (DDD ou +DDI):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editingPhone}
                    onChange={(e) => setEditingPhone(e.target.value)}
                    placeholder="Ex: 11999998888 ou +33612345678"
                    className="flex-1 min-h-[48px] p-2.5 border-2 border-zinc-950 font-mono text-xs font-bold bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRetryLead(selectedErrorLead, editingPhone)}
                    className="min-h-[48px] px-4 py-2.5 bg-[#E5FF00] hover:bg-white text-zinc-950 font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[2px_2px_0_0_#000]"
                  >
                    Reenviar com Novo Número
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedErrorLead(null)}
                  className="flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-950 font-mono text-xs font-bold uppercase"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => handleRetryLead(selectedErrorLead)}
                  className="flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 bg-zinc-950 text-white hover:bg-zinc-800 border-2 border-zinc-950 font-mono text-xs font-black uppercase"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Header do Painel de Disparo */}
      <div className="bg-zinc-950 text-white p-4 sm:p-6 md:p-8 border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] sm:shadow-[10px_10px_0_0_#18181B] flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-[#25D366] rounded-full inline-block animate-pulse" />
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest font-black text-[#25D366]">
              Engine // Whatsmeow Anti-Ban Queue
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-tight text-white flex items-center gap-3">
            Campanha WhatsApp
          </h2>
          <p className="text-zinc-400 font-bold text-xs sm:text-sm max-w-xl">
            Disparo humanizado sequencial, simulação de digitação real e verificação de números de leads.
          </p>
        </div>

        {/* Status de Conexão e Contador */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-4 sm:flex-wrap w-full md:w-auto">
          <div className="bg-zinc-900 border-2 border-zinc-700 px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col gap-1 min-w-0 sm:min-w-[200px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold truncate">WhatsApp Core</span>
              {serviceStatus.logged_in && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="text-[10px] font-mono font-bold text-red-400 hover:text-red-300 underline flex items-center gap-1 shrink-0"
                  title="Desconectar sessão ativa"
                >
                  <LogOut size={10} /> Sair
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              {serviceStatus.logged_in ? (
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black uppercase text-[#25D366] flex items-center gap-1">
                      <CheckCircle2 size={14} className="shrink-0" /> Conectado
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQRModal(true)}
                      className="text-[10px] font-mono font-bold text-zinc-400 hover:text-white underline"
                    >
                      (Info)
                    </button>
                  </div>
                  {(serviceStatus.push_name || serviceStatus.phone) && (
                    <span className="text-[10px] sm:text-[11px] font-mono font-bold text-zinc-300 truncate max-w-full sm:max-w-[200px]">
                      {serviceStatus.push_name ? `${serviceStatus.push_name} ` : ''}
                      {serviceStatus.phone ? `(+${serviceStatus.phone})` : ''}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowQRModal(true)}
                  className="w-full sm:w-auto min-h-[36px] px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-[11px] sm:text-xs uppercase flex items-center justify-center gap-1.5 shadow-[2px_2px_0_0_#000] transition-colors"
                >
                  <QrCode size={14} className="shrink-0" /> Conectar
                </button>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border-2 border-zinc-700 px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col justify-between gap-1 min-w-0 sm:min-w-[160px]">
            <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold truncate">Limite Hoje</span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-base sm:text-lg font-black font-mono text-white">
                {serviceStatus.sent_today} / {serviceStatus.daily_limit}
              </span>
              {serviceStatus.limit_reached && (
                <span className="text-[9px] sm:text-[10px] bg-red-600 text-white font-black px-1.5 py-0.5 uppercase">
                  Esgotado
                </span>
              )}
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={() => setShowConfigPanel(prev => !prev)}
              className={`flex-1 sm:flex-initial min-h-[48px] px-4 py-3 border-2 font-black text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                showConfigPanel 
                  ? 'bg-[#E5FF00] text-zinc-950 border-zinc-950 shadow-[2px_2px_0_0_#fff]' 
                  : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:text-white'
              }`}
              title="Ajustar intervalos, digitação e limites anti-ban"
            >
              <Sliders size={18} />
              <span>{showConfigPanel ? 'Ocultar Regras' : 'Regras Anti-Ban'}</span>
            </button>

            <button
              onClick={fetchStatus}
              disabled={isCheckingStatus}
              className="min-h-[48px] min-w-[48px] p-3 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border-2 border-zinc-700 flex items-center justify-center transition-all shrink-0"
              title="Atualizar status"
            >
              <RefreshCw size={20} className={isCheckingStatus ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DE CONFIGURAÇÕES ANTI-BAN EXPANSÍVEL */}
      {showConfigPanel && (
        <div className="bg-white border-4 border-zinc-950 p-6 md:p-8 shadow-[10px_10px_0_0_#18181B] flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-zinc-950 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#E5FF00] border-2 border-zinc-950" />
                <span className="font-mono text-xs uppercase tracking-widest font-black text-zinc-600">
                  Painel de Controle Total Anti-Ban & Humanização
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
                className="px-3 py-1.5 bg-zinc-100 hover:bg-[#25D366] hover:text-white border-2 border-zinc-950 font-mono text-xs font-bold uppercase transition-all"
                title="15 msgs/dia, 40-80s delay, 180ms/char"
              >
                🛡️ Ultra Seguro
              </button>
              <button
                type="button"
                onClick={() => applyPreset('medium')}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-[#E5FF00] border-2 border-zinc-950 font-mono text-xs font-bold uppercase transition-all"
                title="30 msgs/dia, 25-50s delay, 140ms/char"
              >
                ⚖️ Equilibrado
              </button>
              <button
                type="button"
                onClick={() => applyPreset('fast')}
                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-950 hover:text-white border-2 border-zinc-950 font-mono text-xs font-bold uppercase transition-all"
                title="60 msgs/dia, 15-30s delay, 90ms/char"
              >
                ⚡ Acelerado
              </button>
              <button
                type="button"
                onClick={() => applyPreset('test')}
                className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 border-2 border-zinc-950 font-mono text-xs font-black uppercase transition-all"
                title="100 msgs/dia, 4-8s delay, 50ms/char (para testes rápidos)"
              >
                🧪 Teste Rápido
              </button>
            </div>
          </div>

          {/* Feedback de Sucesso */}
          {configSuccessMsg && (
            <div className="p-3 bg-emerald-100 border-2 border-emerald-600 text-emerald-900 font-mono text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-700" />
              {configSuccessMsg}
            </div>
          )}

          {/* Grid de Configurações */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Bloco 1: Espaçamento de Segurança */}
            <div className="bg-zinc-50 border-2 border-zinc-950 p-4 flex flex-col gap-4">
              <div className="border-b-2 border-zinc-200 pb-2">
                <span className="font-mono text-xs font-black uppercase text-zinc-900 flex items-center gap-1.5">
                  <Clock size={16} /> 1. Espaçamento Anti-Ban
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
                    Tempo para {selectedCount} leads: <b>~{selectedCount > 0 ? ((selectedCount * (antiBanConfig.min_delay_sec + antiBanConfig.max_delay_sec) / 2) / 60).toFixed(1) : 0} min</b>
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
                    className="w-full py-1.5 bg-zinc-950 text-[#E5FF00] font-black text-xs uppercase hover:bg-zinc-800 transition-colors"
                  >
                    ▶️ Testar Digitação ({estimatedTypingSec}s)
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
                    {/* Quick Pills */}
                    <div className="flex gap-1">
                      {[15, 30, 50, 100].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAntiBanConfig(prev => ({ ...prev, daily_limit: val }))}
                          className={`px-2 py-1 text-[10px] font-mono font-bold border border-zinc-950 transition-colors ${
                            antiBanConfig.daily_limit === val ? 'bg-[#E5FF00]' : 'bg-white hover:bg-zinc-100'
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
                      {serviceStatus.sent_today} / {antiBanConfig.daily_limit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetCounter}
                    className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-700 font-mono text-[10px] font-black uppercase"
                    title="Resetar contador de hoje para 0"
                  >
                    Zerar Hoje
                  </button>
                </div>

                <div className="p-2 bg-zinc-100 border border-zinc-300 text-[10px] font-mono text-zinc-600">
                  Reseta automaticamente à meia-noite. Bloqueia novos envios ao atingir a cota.
                </div>
              </div>
            </div>

          </div>

          {/* Botões do Rodapé de Configuração */}
          <div className="flex items-center justify-between border-t-2 border-zinc-200 pt-4 flex-wrap gap-4">
            <span className="text-xs font-mono text-zinc-500">
              * As regras são aplicadas imediatamente ao worker e salvas em <code className="bg-zinc-100 px-1 py-0.5">antiban_config.json</code>
            </span>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowConfigPanel(false)}
                className="min-h-[48px] px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-950 font-mono text-xs font-bold uppercase"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="min-h-[48px] px-6 py-2.5 bg-[#E5FF00] hover:bg-white text-zinc-950 border-4 border-zinc-950 font-mono text-xs font-black uppercase shadow-[4px_4px_0_0_#18181B] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isSavingConfig ? 'Salvando...' : 'Salvar Regras no Microserviço'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-NAVEGAÇÃO SEGMENTADA PARA MOBILE / TABLET (< 1024px) */}
      <div className="grid grid-cols-3 lg:hidden bg-zinc-950 p-1.5 border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] gap-1.5">
        <button
          type="button"
          onClick={() => setMobileSection('queue')}
          className={`min-h-[44px] px-2 py-2 font-mono text-[11px] sm:text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
            mobileSection === 'queue'
              ? 'bg-[#25D366] text-zinc-950 border-2 border-zinc-950'
              : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <UserCheck size={14} className="shrink-0" />
          <span className="truncate">Fila ({leadItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('compose')}
          className={`min-h-[44px] px-2 py-2 font-mono text-[11px] sm:text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
            mobileSection === 'compose'
              ? 'bg-[#E5FF00] text-zinc-950 border-2 border-zinc-950'
              : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <Sliders size={14} className="shrink-0" />
          <span className="truncate">Mensagem</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('preview')}
          className={`min-h-[44px] px-2 py-2 font-mono text-[11px] sm:text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
            mobileSection === 'preview'
              ? 'bg-white text-zinc-950 border-2 border-zinc-950'
              : 'bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <Smartphone size={14} className="shrink-0" />
          <span className="truncate">Preview</span>
        </button>
      </div>

      {/* 2. Grid Principal: Lado a Lado no Desktop / Segmentado no Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        
        {/* COLUNA ESQUERDA: Configuração da Campanha e Leads (7 Colunas) */}
        <div className={`lg:col-span-7 flex-col gap-6 sm:gap-8 ${mobileSection === 'preview' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Card de Disparo de Teste Rápido */}
          <div className={`bg-white border-4 border-zinc-950 p-4 sm:p-6 md:p-8 shadow-[6px_6px_0_0_#18181B] sm:shadow-[8px_8px_0_0_#18181B] flex-col gap-5 sm:gap-6 ${mobileSection === 'compose' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#E5FF00] border-2 border-zinc-950" />
                  <span className="font-mono text-xs uppercase tracking-widest font-black text-zinc-600">
                    Validação Imediata
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black uppercase text-zinc-950 flex items-center gap-2 mt-0.5">
                  <Zap size={20} className="text-amber-500 fill-amber-500 shrink-0" /> Disparo de Teste Rápido
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {serviceStatus.phone && (
                  <button
                    type="button"
                    onClick={() => setTestPhone(serviceStatus.phone || '')}
                    className="w-full sm:w-auto min-h-[40px] px-3 py-1.5 bg-zinc-100 hover:bg-[#E5FF00] border-2 border-zinc-950 font-mono text-[11px] font-bold uppercase transition-colors"
                    title="Preenche o campo com o seu próprio WhatsApp conectado"
                  >
                    Usar Meu WhatsApp
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs font-mono text-zinc-600 -mt-2">
              Envie uma mensagem de validação imediata para qualquer número para testar o recebimento no aparelho, o tempo de digitação e a entrega.
            </p>

            <form onSubmit={handleSendTest} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-zinc-800 flex items-center gap-1.5">
                    <Phone size={14} /> Número de Teste (com DDD ou DDI):
                  </label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ex: (11) 99999-8888 ou +351 912 345 678"
                    className="w-full min-h-[48px] p-3 border-2 border-zinc-950 font-mono text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#E5FF00] font-bold"
                  />
                  <span className="text-[10px] font-mono text-zinc-500">
                    Números do Brasil recebem +55 automaticamente. Para o exterior, use + e o código do país.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono uppercase font-bold text-zinc-800">
                    Mensagem de Teste:
                  </label>
                  <textarea
                    rows={2}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Texto da mensagem de teste..."
                    className="w-full p-2.5 border-2 border-zinc-950 font-mono text-xs bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#E5FF00]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-zinc-200">
                <span className="text-[11px] font-mono text-zinc-500">
                  {serviceStatus.logged_in ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 size={14} /> WhatsApp conectado e pronto para disparar.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowQRModal(true)}
                      className="text-amber-700 font-bold flex items-center gap-1 hover:underline text-left"
                    >
                      <AlertCircle size={14} className="shrink-0" /> WhatsApp desconectado. Toque para conectar.
                    </button>
                  )}
                </span>

                <button
                  type="submit"
                  disabled={isSendingTest || !testPhone.trim()}
                  className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-[#E5FF00] hover:bg-white text-zinc-950 font-mono text-xs font-black uppercase border-4 border-zinc-950 shadow-[4px_4px_0_0_#18181B] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                >
                  {isSendingTest ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Enfileirando Teste...
                    </>
                  ) : (
                    <>
                      <Send size={16} strokeWidth={2.5} /> Enviar Mensagem de Teste
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Feedback do Disparo de Teste */}
            {testFeedback && (
              <div className={`p-3.5 sm:p-4 border-2 font-mono text-xs flex flex-col gap-1.5 animate-in fade-in duration-200 ${
                testFeedback.success 
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950' 
                  : 'bg-red-50 border-red-600 text-red-950'
              }`}>
                <div className="flex items-center gap-2 font-black">
                  {testFeedback.success ? (
                    <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                  ) : (
                    <AlertCircle size={18} className="text-red-700 shrink-0" />
                  )}
                  <span>{testFeedback.success ? 'DISPARO DE TESTE ENFILEIRADO COM SUCESSO' : 'FALHA NO DISPARO DE TESTE'}</span>
                </div>
                <p>{testFeedback.message}</p>
                {testFeedback.queue_id && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] pt-1 text-zinc-700 border-t border-emerald-200">
                    <span>ID: <b>{testFeedback.queue_id}</b></span>
                    <span>•</span>
                    <span>Destino: <b>{formatPhoneDisplay(testFeedback.phone || '')}</b></span>
                    <span>•</span>
                    <span>Hora: <b>{testFeedback.time}</b></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card do Template de Mensagem */}
          <div className={`bg-white border-4 border-zinc-950 p-4 sm:p-6 md:p-8 shadow-[6px_6px_0_0_#18181B] sm:shadow-[8px_8px_0_0_#18181B] flex-col gap-5 sm:gap-6 ${mobileSection === 'compose' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-zinc-200 pb-4">
              <h3 className="text-lg sm:text-xl font-black uppercase flex items-center gap-2 text-zinc-950">
                <Sliders size={20} className="shrink-0" /> Mensagem & Variáveis
              </h3>
              <span className="text-xs font-mono text-zinc-500 font-bold">
                ~{estimatedTypingSec}s digitação humana
              </span>
            </div>

            {/* Modelos Prontos de Alta Conversão */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono uppercase font-bold text-zinc-600 flex items-center justify-between">
                <span>Modelos de Alta Resposta:</span>
                <span className="text-[10px] text-zinc-400 font-normal">Clique para aplicar</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMessageTemplate(
                    '{{saudacao}}, {{nome}}! Tudo bem?\n\nEstava dando uma olhada aqui na {{empresa}} em {{cidade}} e reparei em um detalhe bem específico sobre a presença e demanda de vocês em {{categoria}} que me chamou atenção.\n\nÉ você mesmo que cuida dessa parte ou quem seria a melhor pessoa para eu falar?'
                  )}
                  className="p-2.5 bg-zinc-50 hover:bg-[#E5FF00] border-2 border-zinc-950 text-left transition-all flex flex-col gap-1 active:translate-y-0.5"
                >
                  <span className="text-xs font-black uppercase text-zinc-900 flex items-center gap-1">
                    🔥 Curiosidade & Detalhe
                  </span>
                  <span className="text-[11px] text-zinc-600 line-clamp-2">
                    "Reparei em um detalhe específico que me chamou atenção..."
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(
                    '{{saudacao}}, {{nome}}, tudo bom?\n\nVi a {{empresa}} aqui em {{cidade}} e queria tirar uma dúvida rápida sobre {{categoria}} com você: vocês ainda têm capacidade para novos clientes este mês ou a agenda já está cheia?'
                  )}
                  className="p-2.5 bg-zinc-50 hover:bg-[#E5FF00] border-2 border-zinc-950 text-left transition-all flex flex-col gap-1 active:translate-y-0.5"
                >
                  <span className="text-xs font-black uppercase text-zinc-900 flex items-center gap-1">
                    🎯 Pergunta de Demanda
                  </span>
                  <span className="text-[11px] text-zinc-600 line-clamp-2">
                    "Ainda têm capacidade para novos clientes ou agenda cheia?"
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(
                    'Oi, {{nome}}! {{saudacao}}.\n\nEncontrei a {{empresa}} pesquisando referências em {{categoria}} na região de {{cidade}}.\n\nVocê teria 1 minutinho para me tirar uma dúvida rápida sobre como vocês atendem hoje?'
                  )}
                  className="p-2.5 bg-zinc-50 hover:bg-[#E5FF00] border-2 border-zinc-950 text-left transition-all flex flex-col gap-1 active:translate-y-0.5"
                >
                  <span className="text-xs font-black uppercase text-zinc-900 flex items-center gap-1">
                    ⚡ Dúvida Rápida (1 min)
                  </span>
                  <span className="text-[11px] text-zinc-600 line-clamp-2">
                    "Encontrei a empresa... teria 1 min para tirar uma dúvida rápida?"
                  </span>
                </button>
              </div>
            </div>

            {/* Tags para Inserção Rápida */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono uppercase font-bold text-zinc-600">
                Inserir Tags Dinâmicas:
              </span>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertTag('nome')}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-[#E5FF00] transition-colors"
                >
                  + {'{{nome}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('empresa')}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-[#E5FF00] transition-colors"
                >
                  + {'{{empresa}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('cidade')}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-[#E5FF00] transition-colors"
                >
                  + {'{{cidade}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('categoria')}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-[#E5FF00] transition-colors"
                >
                  + {'{{categoria}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('saudacao')}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-[#E5FF00] transition-colors"
                  title="Insere 'Bom dia', 'Boa tarde' ou 'Boa noite' automaticamente"
                >
                  + {'{{saudacao}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('telefone')}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-[#E5FF00] transition-colors"
                >
                  + {'{{telefone}}'}
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="flex flex-col gap-1.5">
              <textarea
                rows={6}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Escreva a mensagem aqui utilizando as tags dinâmicas..."
                className="w-full p-3.5 sm:p-4 border-4 border-zinc-950 font-mono text-xs sm:text-sm leading-relaxed text-zinc-900 focus:outline-none focus:ring-4 focus:ring-[#E5FF00] bg-zinc-50"
              />
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-[11px] sm:text-xs font-mono text-zinc-500 pt-1">
                <span>{messageTemplate.length} caracteres</span>
                <span>Intervalo: {antiBanConfig.min_delay_sec}s a {antiBanConfig.max_delay_sec}s entre envios</span>
              </div>
            </div>

            {/* Anexo de Mídia Opcional */}
            <div className="flex flex-col gap-2 pt-2 border-t-2 border-zinc-100">
              <label className="text-xs font-mono uppercase font-bold text-zinc-700 flex items-center gap-2">
                <ImageIcon size={16} className="shrink-0" /> URL de Imagem ou Documento (Opcional):
              </label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem-ou-catalogo.jpg"
                className="w-full min-h-[48px] p-3 border-2 border-zinc-950 font-mono text-xs bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#E5FF00]"
              />
              <p className="text-[11px] font-mono text-zinc-500">
                Se preenchido, o microserviço fará o upload e enviará como foto ou documento acompanhado do texto.
              </p>
            </div>
          </div>

          {/* Lista de Leads Selecionados */}
          <div className={`bg-white border-4 border-zinc-950 p-4 sm:p-6 md:p-8 shadow-[6px_6px_0_0_#18181B] sm:shadow-[8px_8px_0_0_#18181B] flex-col gap-5 sm:gap-6 ${mobileSection === 'queue' ? 'flex' : 'hidden lg:flex'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b-2 border-zinc-200 pb-4">
              <div>
                <h3 className="text-lg sm:text-xl font-black uppercase text-zinc-950 flex items-center gap-2">
                  <UserCheck size={20} className="shrink-0" /> Leads com WhatsApp ({leadItems.length})
                </h3>
                <span className="text-xs font-mono text-zinc-500 font-bold">
                  {selectedCount} selecionado(s) para disparo
                </span>
              </div>

              {/* Botões de Seleção e Busca */}
              <div className="grid grid-cols-2 sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-zinc-200"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(false)}
                  className="min-h-[40px] px-3 py-1.5 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold hover:bg-zinc-200"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Filtro de Busca na Lista */}
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-zinc-400" size={18} />
              <input
                type="text"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                placeholder="Filtrar leads por nome, cidade ou telefone..."
                className="w-full min-h-[48px] pl-10 pr-4 py-2.5 border-2 border-zinc-950 font-mono text-xs bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#E5FF00]"
              />
            </div>

            {/* Lista com Scroll */}
            <div className="max-h-[420px] sm:max-h-[380px] overflow-y-auto flex flex-col gap-2 pr-1 border-2 border-zinc-200 p-2 bg-zinc-50 custom-scrollbar">
              {filteredLeadItems.length === 0 ? (
                <div className="p-6 sm:p-8 text-center font-mono text-zinc-500 text-xs sm:text-sm">
                  {leadItems.length === 0 ? (
                    <div className="flex flex-col items-center gap-3">
                      <Phone size={32} className="text-zinc-400" />
                      <p>Nenhum lead com WhatsApp encontrado na pesquisa atual.</p>
                      {onBackToSearch && (
                        <button
                          type="button"
                          onClick={onBackToSearch}
                          className="min-h-[44px] px-4 py-2 bg-zinc-950 text-[#E5FF00] font-black uppercase text-xs border-2 border-zinc-950"
                        >
                          Voltar para Pesquisa
                        </button>
                      )}
                    </div>
                  ) : (
                    'Nenhum lead corresponde ao filtro de busca.'
                  )}
                </div>
              ) : (
                filteredLeadItems.map((item) => {
                  const isCurrentActive = item.id === selectedLeadId;
                  const l = item.lead;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedLeadId(item.id)}
                      className={`p-3 border-2 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${
                        isCurrentActive
                          ? 'border-zinc-950 bg-[#E5FF00]/20 shadow-[2px_2px_0_0_#18181B]'
                          : 'border-zinc-300 bg-white hover:border-zinc-950'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleItem(item.id);
                          }}
                          className="w-5 h-5 mt-0.5 sm:mt-0 accent-zinc-950 cursor-pointer shrink-0"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-black text-xs sm:text-sm text-zinc-950 uppercase break-words sm:truncate">
                            {l.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono text-zinc-600 mt-0.5">
                            <span className="text-[#25D366] font-bold">{formatPhoneDisplay(item.phone)}</span>
                            <span>•</span>
                            <span className="truncate">{l.city}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge + Botão Mobile Preview */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-8 sm:pl-0 border-t sm:border-t-0 border-zinc-100 pt-2 sm:pt-0">
                        {item.status === 'sent' && (
                          <span className="px-2.5 py-1 bg-green-100 text-green-900 text-[10px] font-mono font-black uppercase border border-green-600 flex items-center gap-1 shadow-sm">
                            <CheckCheck size={14} className="text-emerald-700" strokeWidth={2.5} /> Enviado
                          </span>
                        )}
                        {item.status === 'queued' && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-[10px] font-mono font-black uppercase border border-amber-600 flex items-center gap-1 shadow-sm">
                            <Clock size={12} className="animate-spin" /> Em Espera
                          </span>
                        )}
                        {item.status === 'typing' && (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 text-[10px] font-mono font-black uppercase border-2 border-emerald-600 flex items-center gap-1.5 animate-pulse shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping inline-block" />
                            ✍️ Digitando...
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <button
                            id={`btn-view-error-${item.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedErrorLead(item);
                              setEditingPhone(item.phone);
                            }}
                            className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-mono font-black uppercase border-2 border-zinc-950 shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Clique para ver o motivo detalhado da falha e opções de reenvio"
                          >
                            <AlertCircle size={12} /> Falha (Ver Motivo)
                          </button>
                        )}
                        {item.status === 'limit_reached' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedErrorLead({
                                ...item,
                                error: 'Limite diário de disparos atingido. Aumente o limite diário ou zere o contador para continuar.'
                              });
                            }}
                            className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 text-[10px] font-mono font-black uppercase border border-amber-600 cursor-pointer"
                          >
                            Limite Atingido
                          </button>
                        )}
                        {item.status === 'idle' && (
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">
                            Aguardando
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeadId(item.id);
                            setMobileSection('preview');
                          }}
                          className="lg:hidden px-2 py-1 bg-zinc-100 hover:bg-zinc-950 hover:text-white border border-zinc-950 text-[10px] font-mono font-bold uppercase flex items-center gap-1"
                        >
                          <Smartphone size={11} /> Preview
                        </button>
                        <ChevronRight size={16} className={`hidden sm:block ${isCurrentActive ? 'text-zinc-950' : 'text-zinc-300'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Ação de Disparo em Massa */}
            <div className="pt-4 border-t-2 border-zinc-200 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleStartBatchDispatch}
                disabled={isSending || selectedCount === 0 || serviceStatus.limit_reached}
                className="w-full min-h-[54px] py-3.5 sm:py-4 px-4 sm:px-6 bg-[#25D366] text-zinc-950 font-black uppercase tracking-wider text-sm sm:text-lg border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 sm:gap-3 text-center"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="animate-spin shrink-0" size={22} /> Enfileirando Mensagens...
                  </>
                ) : (
                  <>
                    <Send size={22} strokeWidth={3} className="shrink-0" /> Disparar para {selectedCount} Leads Selecionados
                  </>
                )}
              </button>

              {isSending && (
                <div className="w-full bg-zinc-200 h-2 border border-zinc-950 overflow-hidden">
                  <div 
                    className="bg-[#25D366] h-full transition-all duration-300"
                    style={{ width: `${(campaignProgress.queued / (campaignProgress.total || 1)) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Simulador de Tela de WhatsApp (5 Colunas) */}
        <div className={`lg:col-span-5 flex-col items-center ${mobileSection === 'preview' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="w-full max-w-[390px] lg:sticky lg:top-6">
            
            {/* Controles do Simulador */}
            <div className="flex items-center justify-between mb-3 px-1 sm:px-2 gap-2">
              <span className="font-mono text-xs uppercase font-black text-zinc-600 flex items-center gap-1.5">
                <Smartphone size={16} /> Live WhatsApp Preview
              </span>
              <button
                type="button"
                onClick={runLiveTypingSimulation}
                className={`min-h-[36px] text-[11px] font-mono font-bold px-2.5 py-1 border-2 border-zinc-950 transition-colors ${
                  showSimulatedTyping ? 'bg-[#25D366] text-zinc-950 animate-pulse' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {simulatedCountdown !== null ? `⏳ ${simulatedCountdown}s digitando` : 'Testar "Digitando..."'}
              </button>
            </div>

            {/* MOCKUP DO SMARTPHONE (DESIGN AUTÊNTICO WHATSAPP DARK MODE) */}
            <div className="w-full bg-[#111b21] rounded-[32px] sm:rounded-[44px] p-2 sm:p-3 shadow-[8px_8px_0_0_#18181B] sm:shadow-[16px_16px_0_0_#18181B] border-4 border-zinc-950 relative overflow-hidden">
              
              {/* Dynamic Island / Notch */}
              <div className="absolute top-4 sm:top-5 left-1/2 -translate-x-1/2 w-24 sm:w-28 h-3.5 sm:h-4 bg-zinc-950 rounded-full z-20" />

              {/* Corpo da Tela do Celular */}
              <div className="w-full bg-[#0b141a] rounded-[24px] sm:rounded-[36px] overflow-hidden flex flex-col h-[540px] sm:h-[680px] relative border border-[#222e35]">
                
                {/* 1. Status Bar do Smartphone */}
                <div className="h-9 bg-[#202c33] px-6 pt-2 flex items-center justify-between text-zinc-300 text-[11px] font-sans font-semibold select-none z-10">
                  <span>14:32</span>
                  <div className="flex items-center gap-1.5">
                    <span>5G</span>
                    <div className="w-4 h-2.5 border border-zinc-300 rounded-[2px] p-0.5 flex items-center">
                      <div className="w-full h-full bg-zinc-300 rounded-[1px]" />
                    </div>
                  </div>
                </div>

                {/* 2. WhatsApp Top App Bar */}
                <div className="bg-[#202c33] px-3 py-2.5 flex items-center justify-between border-b border-[#222e35] select-none z-10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ArrowLeft size={18} className="text-[#aebac1] cursor-pointer" />
                    
                    {/* Avatar do Contato */}
                    <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center font-bold text-white text-sm shrink-0 border border-[#005c4b]">
                      {activeLead?.lead.name ? activeLead.lead.name.charAt(0).toUpperCase() : 'W'}
                    </div>

                    {/* Nome e Status */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-xs font-semibold truncate leading-tight">
                        {activeLead?.lead.name || 'Destinatário'}
                      </span>
                      <span className="text-[10px] leading-tight truncate">
                        {simulatedCountdown !== null ? (
                          <span className="text-[#00a884] font-medium">digitando... ({simulatedCountdown}s)</span>
                        ) : (showSimulatedTyping || activeLead?.status === 'typing') ? (
                          <span className="text-[#00a884] font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-ping" />
                            digitando...
                          </span>
                        ) : activeLead?.status === 'queued' ? (
                          <span className="text-amber-400 font-medium flex items-center gap-1">
                            <Clock size={10} className="animate-spin" /> na fila de envio...
                          </span>
                        ) : activeLead?.status === 'failed' ? (
                          <span className="text-red-400 font-semibold flex items-center gap-1">
                            <AlertCircle size={10} /> falha no envio
                          </span>
                        ) : (
                          <span className="text-[#8696a0]">online</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[#aebac1]">
                    <MoreVertical size={18} />
                  </div>
                </div>

                {/* 3. Área de Conversa (Wallpaper WhatsApp com Doodle) */}
                <div 
                  className="flex-1 p-4 overflow-y-auto flex flex-col justify-end gap-3 relative"
                  style={{
                    backgroundColor: '#0b141a',
                    backgroundImage: `radial-gradient(#1f2c34 1px, transparent 1px)`,
                    backgroundSize: '16px 16px',
                  }}
                >
                  {/* Banner de Criptografia */}
                  <div className="self-center bg-[#182229] border border-[#222e35] text-[#ffd279] text-[10px] px-3 py-1.5 rounded-lg text-center max-w-[280px] shadow-sm">
                    🔒 As mensagens são protegidas com a criptografia de ponta a ponta.
                  </div>

                  {/* Se houver falha neste lead ativo, mostrar banner contextual na conversa */}
                  {activeLead?.status === 'failed' && (
                    <div className="self-center w-full max-w-[95%] bg-red-950/90 border-2 border-red-500 text-red-200 text-xs p-3 rounded-lg flex flex-col gap-1.5 shadow-lg animate-in fade-in">
                      <div className="flex items-center justify-between font-bold text-red-400 text-[11px] uppercase">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-red-400 animate-pulse" /> Falha no Envio
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeLead) {
                              setSelectedErrorLead(activeLead);
                              setEditingPhone(activeLead.phone);
                            }
                          }}
                          className="text-[10px] bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded font-black uppercase transition-colors"
                        >
                          Ver Motivo
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-300 font-mono line-clamp-2">
                        {activeLead.error || 'Número não cadastrado no WhatsApp ou formato incorreto'}
                      </p>
                    </div>
                  )}

                  {/* Badge de Data */}
                  <div className="self-center bg-[#182229] text-[#8696a0] text-[10px] font-medium px-2.5 py-0.5 rounded-md shadow-sm">
                    HOJE
                  </div>

                  {/* Balão de Mensagem de Envio */}
                  <div className={`self-end max-w-[85%] ${activeLead?.status === 'failed' ? 'bg-[#3b2326] border-red-800' : 'bg-[#005c4b] border-[#025143]'} text-[#e9edef] rounded-lg rounded-tr-none p-3 shadow-md relative border animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    
                    {/* Preview de Mídia se houver */}
                    {mediaUrl && (
                      <div className="mb-2 rounded-md overflow-hidden bg-black/30 border border-white/10 p-2 flex items-center gap-2">
                        <ImageIcon size={20} className="text-[#25D366] shrink-0" />
                        <span className="text-[10px] font-mono text-zinc-300 truncate">
                          {mediaUrl.split('/').pop() || 'Arquivo de Mídia'}
                        </span>
                      </div>
                    )}

                    {/* Texto com quebras de linha preservadas */}
                    <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans break-words select-text">
                      {(activeLead?.status === 'typing' || showSimulatedTyping) ? (
                        <>
                          <span>{displayedTypingText}</span>
                          <span className="inline-block w-1.5 h-3.5 bg-[#25D366] ml-0.5 animate-pulse align-middle" />
                        </>
                      ) : (
                        interpolatedMessage
                      )}
                    </div>

                    {/* Timestamp e Tiques / Status */}
                    <div className="flex items-center justify-end gap-1.5 mt-1 text-[9px] text-[#8696a0]">
                      <span>14:32</span>
                      {activeLead?.status === 'queued' ? (
                        <span className="flex items-center gap-1 text-amber-300 font-mono" title="Na fila aguardando intervalo">
                          <Clock size={11} className="animate-spin" />
                          <span>Na fila</span>
                        </span>
                      ) : (activeLead?.status === 'typing' || showSimulatedTyping) ? (
                        <span className="flex items-center gap-1 text-[#25D366] font-mono animate-pulse" title="Simulando presença e digitação">
                          <span>Digitando...</span>
                        </span>
                      ) : activeLead?.status === 'failed' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (activeLead) {
                              setSelectedErrorLead(activeLead);
                              setEditingPhone(activeLead.phone);
                            }
                          }}
                          className="flex items-center gap-1 text-red-400 hover:text-red-300 font-bold underline cursor-pointer bg-red-950/60 px-1 py-0.5 rounded border border-red-500/50"
                          title="Clique para ver o motivo detalhado da falha"
                        >
                          <AlertCircle size={11} className="text-red-400" />
                          <span>Não entregue (Ver Motivo)</span>
                        </button>
                      ) : (
                        <CheckCheck size={14} className="text-[#53bdeb]" />
                      )}
                    </div>
                  </div>

                  {/* Balão Animado de Digitação quando ativo */}
                  {(showSimulatedTyping || activeLead?.status === 'typing') && (
                    <div className="self-start bg-[#202c33] text-[#8696a0] rounded-lg rounded-tl-none px-3 py-2 text-xs flex items-center gap-1.5 shadow-sm border border-[#2a3942] animate-pulse">
                      <span>Digitando {simulatedCountdown !== null ? `(${simulatedCountdown}s restantes)` : ''}</span>
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce" />
                        <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1 h-1 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.4s]" />
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Bottom Input Bar Fake do WhatsApp */}
                <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2 border-t border-[#222e35] select-none">
                  <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-2 flex items-center gap-2 text-[#8696a0]">
                    <Smile size={18} />
                    <span className="text-xs flex-1 truncate font-sans">
                      {(activeLead?.status === 'typing' || showSimulatedTyping) ? (
                        <span className="text-[#25D366] font-medium animate-pulse flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-ping" />
                          Digitando para {activeLead?.lead.name || 'contato'}...
                        </span>
                      ) : (
                        <span className="text-zinc-500">Mensagem</span>
                      )}
                    </span>
                    <Paperclip size={16} />
                    <Camera size={16} />
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0 shadow-md">
                    {(activeLead?.status === 'typing' || showSimulatedTyping) ? (
                      <Send size={16} className="text-zinc-950 fill-zinc-950 animate-bounce" />
                    ) : (
                      <Mic size={18} />
                    )}
                  </div>
                </div>

                {/* Home Indicator */}
                <div className="h-3 bg-[#202c33] flex justify-center items-center pb-1">
                  <div className="w-28 h-1 bg-zinc-600 rounded-full" />
                </div>
              </div>
            </div>

            {/* Info Box abaixo do simulador */}
            <div className="mt-4 p-3 bg-zinc-100 border-2 border-zinc-950 text-zinc-800 text-xs font-mono flex flex-col gap-2 shadow-[4px_4px_0_0_#18181B]">
              <div className="flex items-center justify-between gap-2">
                <span>Lead Selecionado:</span>
                <span className="font-bold uppercase truncate max-w-[180px]">
                  {activeLead?.lead.name || 'Nenhum'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-300">
                <span>Status do Envio:</span>
                <div>
                  {activeLead?.status === 'sent' && (
                    <span className="font-black text-green-700 flex items-center gap-1">
                      <CheckCheck size={14} /> Enviado
                    </span>
                  )}
                  {activeLead?.status === 'queued' && (
                    <span className="font-black text-amber-700 flex items-center gap-1">
                      <Clock size={12} className="animate-spin" /> Em Espera na Fila
                    </span>
                  )}
                  {activeLead?.status === 'typing' && (
                    <span className="font-black text-emerald-700 flex items-center gap-1 animate-pulse">
                      ✍️ Digitando no WhatsApp...
                    </span>
                  )}
                  {activeLead?.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeLead) {
                          setSelectedErrorLead(activeLead);
                          setEditingPhone(activeLead.phone);
                        }
                      }}
                      className="font-black text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <AlertCircle size={12} /> Falha (Ver Motivo)
                    </button>
                  )}
                  {activeLead?.status === 'idle' && (
                    <span className="text-zinc-500 font-bold">Aguardando Disparo</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
