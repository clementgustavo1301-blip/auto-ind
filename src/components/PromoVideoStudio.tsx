'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Send,
  CheckCheck,
  Clock,
  Sliders,
  Smartphone,
  Globe,
  Building2,
  MessageSquare,
  Sparkles,
  Film,
  Search,
} from 'lucide-react';
import { soundEngine } from '@/lib/sound-effects';

const CHAPECO_LEADS = [
  { id: '1', name: 'CLÍNICA VIRTUOSA - CHAPECÓ PASSO DOS FORTES', phone: '+55 (49) 99912-3401', city: 'Chapecó - SC', status: 'queued' },
  { id: '2', name: 'INSTITUTO ODONTO EXCELLENCE CHAPECÓ', phone: '+55 (49) 99845-1120', city: 'Chapecó - SC', status: 'queued' },
  { id: '3', name: 'CLÍNICA DERMATOLÓGICA SANTA MARIA', phone: '+55 (49) 99104-8892', city: 'Chapecó - SC', status: 'queued' },
  { id: '4', name: 'CENTRO MÉDICO INTEGRADO OESTE', phone: '+55 (49) 99977-6543', city: 'Chapecó - SC', status: 'queued' },
  { id: '5', name: 'ESTÉTICA AVANÇADA LUMINA CHAPECÓ', phone: '+55 (49) 98821-4090', city: 'Chapecó - SC', status: 'queued' },
  { id: '6', name: 'CLÍNICA FISIOTERAPIA & REABILITAÇÃO VIDA', phone: '+55 (49) 99133-7001', city: 'Chapecó - SC', status: 'queued' },
  { id: '7', name: 'ESPAÇO SAÚDE & BEM-ESTAR BELA VISTA', phone: '+55 (49) 99988-2211', city: 'Chapecó - SC', status: 'queued' },
];

const DYNAMIC_TAGS = [
  { tag: '{{saudacao}}', color: '#E5FF00', x: -110, y: -60 },
  { tag: '{{nome}}', color: '#25D366', x: 95, y: -55 },
  { tag: '{{empresa}}', color: '#E5FF00', x: -130, y: 40 },
  { tag: '{{cidade}}', color: '#25D366', x: 120, y: 45 },
  { tag: '{{categoria}}', color: '#ffffff', x: 0, y: -80 },
];

const SCENE_3_RAW_TEXT =
  'Boa tarde, Virtuosa! Estava dando uma olhada aqui na {{empresa}} em {{cidade}} e reparei em um detalhe bem específico sobre a presença de vocês em estética que me chamou atenção.';

const SCENE_3_RESOLVED_TEXT =
  'Boa tarde, Virtuosa! Estava dando uma olhada aqui na Clínica Virtuosa - Chapecó Passo dos Fortes em Chapecó e reparei em um detalhe bem específico sobre a presença de vocês em estética que me chamou atenção.';

export function PromoVideoStudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // 0.0 to 30.0s
  const [isMuted, setIsMuted] = useState(() => soundEngine.getMuted());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggeredEventsRef = useRef<Set<string>>(new Set());

  // Determinar cena ativa com base no segundo atual
  const currentScene =
    currentTime < 7
      ? 1
      : currentTime < 15
      ? 2
      : currentTime < 24
      ? 3
      : 4;

  // Loop de reprodução de 30 segundos (atualiza a cada 50ms para precisão de cascata)
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = Number((prev + 0.05).toFixed(2));
        if (next >= 30) {
          setIsPlaying(false);
          return 30;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Gatilhos de Sound Design sincronizados com o Storyboard
  useEffect(() => {
    if (!isPlaying) return;
    const t = currentTime;
    const fired = triggeredEventsRef.current;

    const triggerOnce = (key: string, fn: () => void) => {
      if (!fired.has(key)) {
        fired.add(key);
        fn();
      }
    };

    // Cena 1: Batida percussiva em cascata para as caixas de seleção (0.5s a 1.8s)
    CHAPECO_LEADS.forEach((_, idx) => {
      const checkTime = 0.6 + idx * 0.15;
      if (t >= checkTime && t < checkTime + 0.15) {
        triggerOnce(`c1_check_${idx}`, () => soundEngine.playMechanicalClick('checkbox'));
      }
    });

    // Cena 1: Clique tátil no botão verde + Onda de Choque (4.4s)
    if (t >= 4.4 && t < 4.6) {
      triggerOnce('c1_shockwave', () => soundEngine.playShockwave());
    }

    // Cena 2: Corte seco (7.0s)
    if (t >= 7.0 && t < 7.2) {
      triggerOnce('c2_cut', () => soundEngine.playTemplateFlash());
    }

    // Cena 2: Encaixe das 5 etiquetas dinâmicas (9.0s a 11.5s)
    DYNAMIC_TAGS.forEach((_, idx) => {
      const snapTime = 8.8 + idx * 0.45;
      if (t >= snapTime && t < snapTime + 0.15) {
        triggerOnce(`c2_tag_${idx}`, () => soundEngine.playVariableSnap());
      }
    });

    // Cena 2: Clique tátil em «SALVAR REGRAS NO MICROSERVIÇO» (12.6s)
    if (t >= 12.6 && t < 12.8) {
      triggerOnce('c2_save_rules', () => soundEngine.playMechanicalClick('primary'));
    }

    // Cena 3: Teclas humanas suaves durante a construção da mensagem (16.0s a 22.8s)
    if (t >= 16.0 && t <= 22.8) {
      const step = Math.floor(t * 8);
      triggerOnce(`c3_key_${step}`, () => {
        if (Math.random() > 0.25) {
          soundEngine.playKeystroke(step % 6 === 0);
        }
      });
    }

    // Cena 3: Glitch de interpolação das variáveis {{empresa}} e {{cidade}} (20.2s)
    if (t >= 20.2 && t < 20.4) {
      triggerOnce('c3_glitch', () => soundEngine.playVariableSnap());
    }

    // Cena 4: Mensagem enviada «✓ Enviado» (24.2s) e avanço na fila (26.0s)
    if (t >= 24.2 && t < 24.4) {
      triggerOnce('c4_sent_1', () => soundEngine.playSentNotification());
    }
    if (t >= 26.2 && t < 26.4) {
      triggerOnce('c4_sent_bounce', () => soundEngine.playMechanicalClick('primary'));
    }
  }, [currentTime, isPlaying]);

  const handleTogglePlay = () => {
    if (currentTime >= 30) {
      triggeredEventsRef.current.clear();
      setCurrentTime(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(prev => !prev);
    }
    soundEngine.playMechanicalClick('secondary');
  };

  const handleRestart = () => {
    triggeredEventsRef.current.clear();
    setCurrentTime(0);
    setIsPlaying(true);
    soundEngine.playMechanicalClick('primary');
  };

  const handleJumpToScene = (startTime: number) => {
    triggeredEventsRef.current.clear();
    setCurrentTime(startTime);
    setIsPlaying(true);
    soundEngine.playMechanicalClick('secondary');
  };

  const handleToggleMute = () => {
    const nextMuted = soundEngine.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTimecode = (sec: number) => {
    const whole = Math.floor(sec);
    const ms = Math.floor((sec - whole) * 10);
    return `00:${String(whole).padStart(2, '0')}.${ms}`;
  };

  // Cálculos auxiliares por cena
  const scene1Progress = Math.max(0, Math.min(1, currentTime / 7));
  const isButtonPressedScene1 = currentTime >= 4.4 && currentTime <= 5.2;
  const showShockwaveScene1 = currentTime >= 4.45 && currentTime <= 6.2;

  const scene3LocalTime = Math.max(0, currentTime - 15);
  const isGlitchedResolved = currentTime >= 20.2;
  const isGlitchingNow = currentTime >= 19.9 && currentTime < 20.45;
  const sourceTextScene3 = isGlitchedResolved ? SCENE_3_RESOLVED_TEXT : SCENE_3_RAW_TEXT;
  const typedCharsCountScene3 = Math.min(
    sourceTextScene3.length,
    Math.floor((scene3LocalTime / 6.8) * sourceTextScene3.length)
  );
  const displayedScene3Text = sourceTextScene3.slice(0, typedCharsCountScene3);

  const scene4LocalTime = Math.max(0, currentTime - 24);
  const showFinalCTA = scene4LocalTime >= 3.4;

  return (
    <div
      ref={containerRef}
      className={`bg-zinc-950 border-4 border-zinc-950 shadow-[8px_8px_0_0_#18181B] sm:shadow-[12px_12px_0_0_#18181B] flex flex-col overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'w-full'
      }`}
    >
      {/* BARRA DE TOPO DO STUDIO MOTION */}
      <div className="bg-zinc-900 border-b-4 border-zinc-950 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="px-2.5 py-1 bg-[#E5FF00] text-zinc-950 font-mono font-black text-xs uppercase border-2 border-zinc-950 flex items-center gap-1.5 shadow-[2px_2px_0_0_#000]">
            <Film size={14} strokeWidth={2.75} />
            <span>Motion Studio // 30s Promo</span>
          </div>
          <span className="hidden md:inline-block font-mono text-xs text-zinc-400 font-bold uppercase">
            Curva: cubic-bezier(0.22, 1, 0.36, 1) • 60 FPS Neo-Brutalist Engine
          </span>
        </div>

        {/* Seletor Rápido das 4 Cenas */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { scene: 1, label: 'Cena 1 (00-07s)', start: 0 },
            { scene: 2, label: 'Cena 2 (07-15s)', start: 7 },
            { scene: 3, label: 'Cena 3 (15-24s)', start: 15 },
            { scene: 4, label: 'Cena 4 (24-30s)', start: 24 },
          ].map(s => (
            <button
              key={s.scene}
              type="button"
              onClick={() => handleJumpToScene(s.start)}
              className={`px-2.5 py-1 font-mono text-[11px] font-black uppercase border-2 transition-all cursor-pointer ${
                currentScene === s.scene
                  ? 'bg-[#25D366] text-zinc-950 border-zinc-950 shadow-[2px_2px_0_0_#000]'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* VIEWPORT CINEMATOGRÁFICO 16:9 */}
      <div
        className={`relative w-full overflow-hidden select-none flex items-center justify-center ${
          isFullscreen ? 'flex-1' : 'h-[480px] sm:h-[560px] md:h-[620px]'
        }`}
        style={{
          backgroundColor: '#09090b',
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          perspective: '1200px',
        }}
      >
        {/* Indicador de Timecode & Cena no Canto Superior */}
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          <div className="bg-zinc-950/90 border-2 border-[#E5FF00] px-3 py-1 font-mono text-xs font-black text-[#E5FF00] flex items-center gap-2 shadow-[3px_3px_0_0_#000]">
            <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-ping' : 'bg-zinc-500'}`} />
            <span>REC {formatTimecode(currentTime)} / 00:30.0</span>
          </div>
          <div className="hidden sm:block bg-white text-zinc-950 border-2 border-zinc-950 px-2.5 py-1 font-mono text-[11px] font-black uppercase shadow-[3px_3px_0_0_#000]">
            {currentScene === 1 && 'Cena 1: O Problema vs. A Seleção Rápida'}
            {currentScene === 2 && 'Cena 2: Personalização & Regras Anti-Ban'}
            {currentScene === 3 && 'Cena 3: A Magia da Simulação Humana'}
            {currentScene === 4 && 'Cena 4: Entrega Confirmada & CTA'}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* =================================================================
              CENA 1 (00:00 – 00:07): CÂMARA ISOMÉTRICA 3D + CASCATA 50ms + ONDA DE CHOQUE
              ================================================================= */}
          {currentScene === 1 && (
            <motion.div
              key="scene-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full flex items-center justify-center relative p-4 sm:p-8"
            >
              {/* Onda de Choque Verde (Shockwave) */}
              <AnimatePresence>
                {showShockwaveScene1 && (
                  <motion.div
                    initial={{ scale: 0.1, opacity: 0.95 }}
                    animate={{ scale: 4.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute z-20 w-64 h-64 rounded-full border-[16px] border-[#25D366] bg-[#25D366]/30 pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* Câmara Isométrica 3D com Zoom Rápido no Botão aos 3.8s */}
              <motion.div
                animate={{
                  rotateX: currentTime >= 3.8 ? 8 : 18,
                  rotateY: currentTime >= 3.8 ? -6 : -16,
                  rotateZ: currentTime >= 3.8 ? 1 : 4,
                  scale: currentTime >= 3.8 ? 1.14 : 0.94,
                  y: currentTime >= 3.8 ? -75 : 0,
                }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformStyle: 'preserve-3d' }}
                className="w-full max-w-2xl bg-white border-4 border-zinc-950 p-4 sm:p-6 shadow-[16px_16px_0_0_#25D366] flex flex-col gap-3"
              >
                <div className="flex items-center justify-between border-b-4 border-zinc-950 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#25D366] text-zinc-950 font-mono font-black text-xs border-2 border-zinc-950">
                      CHAPECÓ - SC
                    </span>
                    <h4 className="font-black text-sm sm:text-lg uppercase text-zinc-950">
                      LEADS COM WHATSAPP (21)
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-black bg-zinc-950 text-[#E5FF00] px-2.5 py-1">
                    21 SELECIONADOS
                  </span>
                </div>

                {/* Lista em Cascata (Staggered 50ms por cartão) */}
                <div className="flex flex-col gap-1.5 max-h-[230px] overflow-hidden">
                  {CHAPECO_LEADS.map((lead, idx) => {
                    const isChecked = currentTime >= 0.45 + idx * 0.15;
                    return (
                      <motion.div
                        key={lead.id}
                        initial={{ opacity: 0, x: -40, rotateX: -15 }}
                        animate={{ opacity: 1, x: 0, rotateX: 0 }}
                        transition={{
                          delay: idx * 0.05, // Cascata exata de 50ms por cartão
                          duration: 0.2,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className={`p-2.5 border-2 border-zinc-950 flex items-center justify-between gap-3 transition-colors duration-150 ${
                          idx === 0 ? 'bg-[#E5FF00]/30 shadow-[3px_3px_0_0_#18181B]' : 'bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <motion.div
                            animate={{
                              scale: isChecked ? [1, 1.28, 1] : 1,
                              backgroundColor: isChecked ? '#25D366' : '#ffffff',
                            }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            className="w-5 h-5 border-2 border-zinc-950 flex items-center justify-center font-black text-xs text-zinc-950 shrink-0"
                          >
                            {isChecked ? '✓' : ''}
                          </motion.div>
                          <span className="font-black text-xs text-zinc-950 truncate uppercase">
                            {lead.name}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-emerald-700 shrink-0">
                          {lead.phone}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Botão Principal com Efeito de Clique Tátil (translate(4px, 4px) + sombra zero) */}
                <motion.div
                  animate={
                    isButtonPressedScene1
                      ? { x: 4, y: 4, boxShadow: '0px 0px 0px 0px #18181B' }
                      : { x: 0, y: 0, boxShadow: '6px 6px 0px 0px #18181B' }
                  }
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-1 w-full py-3.5 px-5 bg-[#25D366] text-zinc-950 font-black uppercase text-xs sm:text-base border-4 border-zinc-950 flex items-center justify-center gap-2.5"
                >
                  <Send size={20} strokeWidth={3} />
                  <span>DISPARAR PARA 21 LEADS SELECIONADOS</span>
                </motion.div>
              </motion.div>

              {/* Legenda Brutalista da Cena 1 */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-5 left-4 right-4 sm:left-8 sm:right-8 z-30 flex justify-center pointer-events-none"
              >
                <div className="bg-[#E5FF00] text-zinc-950 border-4 border-zinc-950 px-4 sm:px-6 py-2.5 shadow-[6px_6px_0_0_#000] font-black uppercase text-sm sm:text-xl md:text-2xl tracking-tight text-center">
                  &ldquo;Prospeção em massa sem parecer um robô.&rdquo;
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* =================================================================
              CENA 2 (00:07 – 00:15): CORTE SECO PARA MENSAGEM + CAMADAS 3D + ANTI-BAN
              ================================================================= */}
          {currentScene === 2 && (
            <motion.div
              key="scene-2"
              initial={{ opacity: 1 }} // Corte seco (Hard cut)
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center relative p-4 sm:p-8 gap-4"
            >
              <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Painel Superior/Lateral Anti-Ban Config */}
                <motion.div
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="md:col-span-5 bg-white border-4 border-zinc-950 p-4 shadow-[8px_8px_0_0_#E5FF00] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-2">
                    <span className="font-mono text-[11px] font-black uppercase bg-zinc-950 text-[#E5FF00] px-2 py-0.5">
                      antiban_config.json
                    </span>
                    <Clock size={16} className="text-zinc-950" />
                  </div>
                  <div className="bg-zinc-100 border-2 border-zinc-950 p-3 font-mono text-xs font-black text-zinc-950">
                    Intervalo: <span className="bg-[#25D366] px-1.5 py-0.5">81s a 203s</span> entre envios
                  </div>
                  <div className="text-[11px] font-mono text-zinc-600 font-bold">
                    ✓ Velocidade variável humana ativa (150ms/char)
                  </div>

                  {/* Botão Amarelo «SALVAR REGRAS NO MICROSERVIÇO» a brilhar e pressionar */}
                  <motion.div
                    animate={
                      currentTime >= 12.6 && currentTime <= 13.3
                        ? { x: 4, y: 4, boxShadow: '0px 0px 0px 0px #18181B', backgroundColor: '#ffffff' }
                        : {
                            x: 0,
                            y: 0,
                            boxShadow: '4px 4px 0px 0px #18181B',
                            backgroundColor: '#E5FF00',
                          }
                    }
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full py-2.5 px-3 border-3 border-zinc-950 font-mono text-xs font-black uppercase text-zinc-950 text-center relative overflow-hidden"
                  >
                    <span>
                      {currentTime >= 12.8 ? '✓ REGRAS SALVAS NO MICROSERVIÇO!' : 'SALVAR REGRAS NO MICROSERVIÇO'}
                    </span>
                  </motion.div>
                </motion.div>

                {/* Separador MENSAGEM & VARIÁVEIS com Camadas 3D */}
                <motion.div
                  initial={{ rotateY: 16, scale: 0.92 }}
                  animate={{ rotateY: -6, scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="md:col-span-7 bg-white border-4 border-zinc-950 p-4 shadow-[10px_10px_0_0_#25D366] flex flex-col gap-3 relative"
                >
                  <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-2">
                    <span className="font-black text-xs sm:text-sm uppercase text-zinc-950 flex items-center gap-1.5">
                      <Sliders size={15} /> MENSAGEM & VARIÁVEIS
                    </span>
                    <span className="font-mono text-[10px] font-black bg-[#E5FF00] px-2 py-0.5 border border-zinc-950">
                      MODELOS DE ALTA RESPOSTA
                    </span>
                  </div>

                  {/* 3 Cartões de Modelos de Alta Resposta destacados em camadas 3D */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { title: '🔥 CURIOSIDADE & DETALHE', active: true },
                      { title: '🎯 PERGUNTA DE DEMANDA', active: false },
                      { title: '⚡ DÚVIDA RÁPIDA (1 MIN)', active: false },
                    ].map((tpl, i) => (
                      <motion.div
                        key={tpl.title}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{
                          y: tpl.active ? -6 : 0,
                          scale: tpl.active ? 1.04 : 0.98,
                          opacity: 1,
                        }}
                        transition={{ delay: i * 0.08, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className={`p-2 border-2 border-zinc-950 font-mono text-[10px] font-black uppercase ${
                          tpl.active
                            ? 'bg-[#E5FF00] text-zinc-950 shadow-[4px_4px_0_0_#18181B]'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {tpl.title}
                      </motion.div>
                    ))}
                  </div>

                  {/* Etiquetas Dinâmicas Flutuando e Encaixando no Editor */}
                  <div className="flex flex-wrap gap-1.5 py-1">
                    {DYNAMIC_TAGS.map((item, idx) => {
                      const snapped = currentTime >= 8.8 + idx * 0.45;
                      return (
                        <motion.span
                          key={item.tag}
                          initial={{ x: item.x, y: item.y, scale: 1.35, rotate: -8 }}
                          animate={
                            snapped
                              ? { x: 0, y: 0, scale: 1, rotate: 0 }
                              : { x: item.x * 0.4, y: item.y * 0.4, scale: 1.18, rotate: 4 }
                          }
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          style={{ backgroundColor: item.color }}
                          className="px-2 py-1 border-2 border-zinc-950 font-mono text-[11px] font-black text-zinc-950 shadow-[2px_2px_0_0_#18181B]"
                        >
                          + {item.tag}
                        </motion.span>
                      );
                    })}
                  </div>

                  {/* Caixa de Texto com Flash Amarelo */}
                  <motion.div
                    animate={{
                      backgroundColor:
                        currentTime >= 7.2 && currentTime <= 7.8 ? '#fef08a' : '#fafafa',
                    }}
                    className="p-3 border-3 border-zinc-950 font-mono text-xs text-zinc-900 leading-relaxed"
                  >
                    <span className="bg-[#E5FF00] px-1 font-bold">{'{{saudacao}}'}</span>,{' '}
                    <span className="bg-[#25D366]/40 px-1 font-bold">{'{{nome}}'}</span>! Estava dando uma olhada aqui na{' '}
                    <span className="bg-[#E5FF00] px-1 font-bold">{'{{empresa}}'}</span> em{' '}
                    <span className="bg-[#25D366]/40 px-1 font-bold">{'{{cidade}}'}</span> sobre{' '}
                    <span className="bg-zinc-200 px-1 font-bold">{'{{categoria}}'}</span>...
                  </motion.div>
                </motion.div>
              </div>

              {/* Legenda Brutalista da Cena 2 */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-5 left-4 right-4 z-30 flex justify-center pointer-events-none"
              >
                <div className="bg-white text-zinc-950 border-4 border-zinc-950 px-4 sm:px-6 py-2.5 shadow-[6px_6px_0_0_#25D366] font-black uppercase text-sm sm:text-xl md:text-2xl tracking-tight text-center">
                  &ldquo;Variáveis dinâmicas + Proteção Anti-Ban integrada.&rdquo;
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* =================================================================
              CENA 3 (00:15 – 00:24): SPLIT-SCREEN / LIVE WHATSAPP PREVIEW + GLITCH DE VARIÁVEIS
              ================================================================= */}
          {currentScene === 3 && (
            <motion.div
              key="scene-3"
              initial={{ rotateY: 35, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full flex items-center justify-center relative p-4 sm:p-8"
            >
              <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* Lado Esquerdo do Split-Screen: Lupa de Transformação de Variáveis */}
                <div className="hidden md:flex md:col-span-5 flex-col gap-3 bg-zinc-900 border-4 border-[#25D366] p-4 shadow-[8px_8px_0_0_#000]">
                  <div className="flex items-center gap-2 text-[#E5FF00] font-mono text-xs font-black uppercase">
                    <Search size={16} />
                    <span>Foco Luminoso // Interpolação Real</span>
                  </div>
                  <div className="p-3 bg-zinc-950 border-2 border-zinc-700 font-mono text-xs flex flex-col gap-2">
                    <div className="text-zinc-400 text-[10px] uppercase">Variável {'{{empresa}}'}:</div>
                    <motion.div
                      animate={
                        isGlitchingNow
                          ? { x: [-4, 4, -2, 0], scale: [1, 1.06, 1] }
                          : { x: 0, scale: 1 }
                      }
                      className={`p-2 border-2 font-black text-xs ${
                        isGlitchedResolved
                          ? 'bg-[#25D366] text-zinc-950 border-zinc-950'
                          : 'bg-zinc-800 text-[#E5FF00] border-[#E5FF00]'
                      }`}
                    >
                      {isGlitchedResolved
                        ? 'Clínica Virtuosa - Chapecó Passo dos Fortes'
                        : '{{empresa}}'}
                    </motion.div>

                    <div className="text-zinc-400 text-[10px] uppercase mt-1">Variável {'{{cidade}}'}:</div>
                    <motion.div
                      animate={
                        isGlitchingNow
                          ? { x: [4, -4, 2, 0], scale: [1, 1.06, 1] }
                          : { x: 0, scale: 1 }
                      }
                      className={`p-2 border-2 font-black text-xs ${
                        isGlitchedResolved
                          ? 'bg-[#E5FF00] text-zinc-950 border-zinc-950'
                          : 'bg-zinc-800 text-[#25D366] border-[#25D366]'
                      }`}
                    >
                      {isGlitchedResolved ? 'Chapecó' : '{{cidade}}'}
                    </motion.div>
                  </div>
                </div>

                {/* Lado Direito: Telemóvel LIVE WHATSAPP PREVIEW em Modo Escuro */}
                <div className="md:col-span-7 flex justify-center">
                  <motion.div
                    animate={{ scale: currentTime >= 16.5 ? 1.03 : 0.96 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-[360px] bg-[#111b21] rounded-[32px] p-2.5 border-4 border-zinc-950 shadow-[12px_12px_0_0_#E5FF00]"
                  >
                    <div className="bg-[#0b141a] rounded-[24px] overflow-hidden border border-[#222e35] flex flex-col h-[340px]">
                      {/* Cabeçalho com Foco no «digitando...» */}
                      <div className="bg-[#202c33] px-3.5 py-2.5 flex items-center gap-2.5 border-b-2 border-[#25D366]">
                        <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center font-black text-white text-sm shrink-0">
                          C
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-white text-xs font-bold truncate">
                            Clínica Virtuosa - Chapecó Passo do...
                          </span>
                          <span className="text-[#00a884] text-[11px] font-mono font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-ping" />
                            digitando...
                          </span>
                        </div>
                      </div>

                      {/* Corpo da Conversa */}
                      <div className="flex-1 p-3.5 flex flex-col justify-end gap-2.5">
                        {/* Indicador «Digitando •••» com Onda Sinusoidal de 150ms */}
                        <div className="self-start bg-[#202c33] text-[#8696a0] rounded-lg rounded-tl-none px-3 py-1.5 text-[11px] flex items-center gap-2 border border-[#2a3942]">
                          <span>Digitando</span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-sine-dot-1" />
                            <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-sine-dot-2" />
                            <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-sine-dot-3" />
                          </span>
                        </div>

                        {/* Balão de Mensagem em Construção + Cursor Verde em Bloco (500ms) */}
                        <motion.div
                          animate={
                            isGlitchingNow
                              ? { x: [-3, 3, -2, 0], filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(0deg)'] }
                              : { x: 0 }
                          }
                          className="self-end w-[92%] bg-[#005c4b] text-[#e9edef] rounded-lg rounded-tr-none p-3 border border-[#25D366] shadow-lg"
                        >
                          <div className="text-xs leading-relaxed font-sans break-words">
                            <span>{displayedScene3Text}</span>
                            <span className="inline-block w-2 h-3.5 bg-[#25D366] ml-0.5 align-middle animate-cursor-500" />
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#25D366] font-mono">
                            <span>✍️ Digitando no WhatsApp...</span>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Legenda Brutalista da Cena 3 */}
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-5 left-4 right-4 z-30 flex justify-center pointer-events-none"
              >
                <div className="bg-[#25D366] text-zinc-950 border-4 border-zinc-950 px-4 sm:px-6 py-2.5 shadow-[6px_6px_0_0_#000] font-black uppercase text-sm sm:text-xl md:text-2xl tracking-tight text-center">
                  &ldquo;Simulação real de escrita humana em tempo real.&rdquo;
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* =================================================================
              CENA 4 (00:24 – 00:30): ENTREGA CONFIRMADA + SCALE BOUNCE NA FILA + CTA FINAL
              ================================================================= */}
          {currentScene === 4 && (
            <motion.div
              key="scene-4"
              initial={{ scale: 1.08, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full h-full flex flex-col items-center justify-center relative p-4 sm:p-8 gap-4"
            >
              {!showFinalCTA ? (
                /* Parte A (24s - 27.4s): Confirmação «✓ Enviado» + Avanço na Fila (21) */
                <div className="w-full max-w-3xl bg-white border-4 border-zinc-950 p-5 shadow-[12px_12px_0_0_#25D366] flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b-4 border-zinc-950 pb-2.5">
                    <span className="font-black text-base uppercase text-zinc-950">
                      FILA (21) — PROGRESSO EM TEMPO REAL
                    </span>
                    <span className="font-mono text-xs font-black bg-[#25D366] text-zinc-950 px-2.5 py-0.5 border-2 border-zinc-950">
                      ✓ ENVIADO COM DUPLO VISTO
                    </span>
                  </div>

                  {/* Cartão 1: Passa para ✅ ENVIADO com Scale Bounce (1.0 -> 1.08 -> 1.0) */}
                  <motion.div
                    initial={{ backgroundColor: '#ffffff' }}
                    animate={{ backgroundColor: '#dcfce7' }}
                    transition={{ duration: 0.25 }}
                    className="p-3.5 border-3 border-zinc-950 flex items-center justify-between gap-3 shadow-[4px_4px_0_0_#18181B]"
                  >
                    <div className="flex flex-col">
                      <span className="font-black text-xs sm:text-sm text-zinc-950 uppercase">
                        CLÍNICA VIRTUOSA - CHAPECÓ PASSO DOS FORTES
                      </span>
                      <span className="font-mono text-[11px] text-emerald-800 font-bold">
                        +55 (49) 99912-3401 • Mensagem concluída
                      </span>
                    </div>
                    <motion.span
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="px-3 py-1.5 bg-[#25D366] text-zinc-950 font-mono text-xs font-black uppercase border-2 border-zinc-950 flex items-center gap-1.5 shadow-[2px_2px_0_0_#18181B]"
                    >
                      <CheckCheck size={16} strokeWidth={3} /> ✅ ENVIADO
                    </motion.span>
                  </motion.div>

                  {/* Cartão 2: Avança automaticamente para «✍️ DIGITANDO...» com pulso de 1.2s */}
                  <motion.div
                    initial={{ backgroundColor: '#ffffff' }}
                    animate={{ backgroundColor: '#ecfdf5' }}
                    className="p-3.5 border-3 border-zinc-950 flex items-center justify-between gap-3"
                  >
                    <div className="flex flex-col">
                      <span className="font-black text-xs sm:text-sm text-zinc-950 uppercase">
                        INSTITUTO ODONTO EXCELLENCE CHAPECÓ
                      </span>
                      <span className="font-mono text-[11px] text-zinc-600 font-bold">
                        +55 (49) 99845-1120 • Próximo contacto da fila
                      </span>
                    </div>
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-950 font-mono text-xs font-black uppercase border-2 border-emerald-600 animate-typing-border-pulse flex items-center gap-1.5">
                      ✍️ DIGITANDO...
                    </span>
                  </motion.div>
                </div>
              ) : (
                /* Parte B (27.4s - 30.0s): Encaixe Central com Barra Inferior + Chamada para Ação Final */
                <motion.div
                  initial={{ scale: 0.9, y: 20, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center text-center gap-5 max-w-2xl"
                >
                  <div className="flex items-center gap-2 bg-zinc-900 border-2 border-[#E5FF00] px-3.5 py-1">
                    <span className="w-3 h-3 bg-[#E5FF00] inline-block" />
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-[#E5FF00]">
                      SYSTEM // LEAD GENERATION CORE
                    </span>
                  </div>

                  <h3 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter text-white leading-none">
                    ESCALA BRUTA.<br />
                    <span className="bg-[#25D366] text-zinc-950 px-3 py-0.5 border-4 border-zinc-950 shadow-[8px_8px_0_0_#E5FF00] inline-block mt-2">
                      100% HUMANA.
                    </span>
                  </h3>

                  {/* Barra Inferior em Destaque («LOCAIS», «INDÚSTRIAS», «WHATSAPP») */}
                  <div className="grid grid-cols-3 border-4 border-zinc-950 bg-zinc-950 shadow-[6px_6px_0_0_#ffffff] w-full max-w-md overflow-hidden">
                    <div className="py-2.5 px-3 bg-zinc-900 text-zinc-300 font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5 border-r-2 border-zinc-800">
                      <Globe size={14} /> LOCAIS
                    </div>
                    <div className="py-2.5 px-3 bg-zinc-900 text-zinc-300 font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5 border-r-2 border-zinc-800">
                      <Building2 size={14} /> INDÚSTRIAS
                    </div>
                    <div className="py-2.5 px-3 bg-[#25D366] text-zinc-950 font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5">
                      <MessageSquare size={14} strokeWidth={3} /> WHATSAPP
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BARRA DE CONTROLES E TIMELINE DE 30 SEGUNDOS */}
      <div className="bg-white border-t-4 border-zinc-950 p-3 sm:p-4 flex flex-col gap-3">
        {/* Scrubber da Timeline (0s a 30s) com divisores das 4 Cenas */}
        <div className="relative w-full h-5 bg-zinc-200 border-2 border-zinc-950 cursor-pointer overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            triggeredEventsRef.current.clear();
            setCurrentTime(Number((ratio * 30).toFixed(2)));
          }}
        >
          <div
            className="h-full bg-[#25D366] border-r-2 border-zinc-950 transition-all duration-75"
            style={{ width: `${(currentTime / 30) * 100}%` }}
          />
          {/* Marcadores de corte das cenas (7s, 15s, 24s) */}
          <div className="absolute top-0 bottom-0 left-[23.33%] w-0.5 bg-zinc-950" title="00:07 - Cena 2" />
          <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-zinc-950" title="00:15 - Cena 3" />
          <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-zinc-950" title="00:24 - Cena 4" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="btn-tactile-4 min-h-[42px] px-4 py-2 bg-[#E5FF00] hover:bg-yellow-300 text-zinc-950 font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[4px_4px_0_0_#18181B] flex items-center gap-1.5 cursor-pointer"
            >
              {isPlaying ? <Pause size={15} strokeWidth={2.75} /> : <Play size={15} strokeWidth={2.75} />}
              <span>{isPlaying ? 'Pausar' : currentTime >= 30 ? 'Reproduzir Novamente' : 'Reproduzir Storyboard (30s)'}</span>
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="btn-tactile-4 min-h-[42px] px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[4px_4px_0_0_#18181B] flex items-center gap-1.5 cursor-pointer"
              title="Reiniciar do segundo 00:00"
            >
              <RotateCcw size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMute}
              className={`btn-tactile-4 min-h-[42px] px-3 py-2 font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[4px_4px_0_0_#18181B] flex items-center gap-1.5 cursor-pointer ${
                isMuted ? 'bg-red-100 text-red-900' : 'bg-[#25D366] text-zinc-950'
              }`}
              title="Ativar/Desativar Sound Design sintetizado"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              <span>{isMuted ? 'Som: Mudo' : 'Sound Design: ON'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="btn-tactile-4 min-h-[42px] px-3 py-2 bg-zinc-950 text-white font-mono text-xs font-black uppercase border-2 border-zinc-950 shadow-[4px_4px_0_0_#25D366] flex items-center gap-1.5 cursor-pointer"
              title="Modo Tela Cheia para Gravação"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Sair Tela Cheia' : 'Modo Gravação'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
