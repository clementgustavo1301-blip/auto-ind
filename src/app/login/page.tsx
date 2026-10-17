'use client';

import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  getOperatorSession,
  isSupabaseConfigured,
  signInOperator,
} from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authStepText, setAuthStepText] = useState('AGUARDANDO CREDENCIAIS DO OPERADOR');

  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      const session = await getOperatorSession();
      if (!active) return;

      if (session) {
        router.replace('/');
        return;
      }
      setIsCheckingSession(false);
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, [router]);

  const handleKeyState = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(event.getModifierState('CapsLock'));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setAuthStepText('VALIDANDO HASH NO SUPABASE AUTH...');

    const result = await signInOperator(email, password);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      setAuthStepText('FALHA NA AUTENTICAÇÃO // ACESSO NEGADO');
      return;
    }

    setAuthStepText('SESSÃO AUTORIZADA // REDIRECIONANDO...');
    router.replace('/');
    router.refresh();
  };

  const transitionConfig = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-[#E5FF00] selection:text-black relative overflow-hidden flex flex-col justify-between">
      {/* Barra superior brutalista */}
      <div className="h-3 md:h-4 w-full bg-zinc-950 z-20" />

      {/* Camada Tipográfica Monumental de Fundo (Z-Axis Depth) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none fixed inset-0 overflow-hidden z-0 flex flex-col justify-between p-4 sm:p-8 md:p-14"
      >
        <div className="flex justify-between items-start">
          <span className="font-black uppercase tracking-tighter text-[18vw] leading-[0.78] text-zinc-100">
            CORE
          </span>
          <div className="hidden lg:flex flex-col items-end font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-300 border-r-4 border-zinc-200 pr-4">
            <span>NODE // BR-SAO-01</span>
            <span>AUTH // SUPABASE-PG</span>
            <span>MODE // ZERO-PUBLIC-SIGNUP</span>
          </div>
        </div>

        <div className="flex justify-end items-end">
          <span className="font-black uppercase tracking-tighter text-[15vw] leading-[0.78] text-zinc-100">
            GATE//01
          </span>
        </div>
      </div>

      {/* Trilho Vertical de Tensão Assimétrica (90/10 Tension Rail) */}
      <aside
        aria-label="Telemetria do Sistema"
        className="hidden xl:flex fixed left-0 top-4 bottom-0 w-16 bg-zinc-950 text-white z-20 flex-col items-center justify-between py-8 border-r-4 border-zinc-950"
      >
        <div className="w-5 h-5 bg-[#E5FF00] border-2 border-white" />
        <div className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-[#E5FF00] [writing-mode:vertical-rl] rotate-180">
          LEADCORE // RESTRICTED B2B EXTRACTION TERMINAL
        </div>
        <div className="font-mono text-[10px] font-bold text-zinc-400">
          v2.6
        </div>
      </aside>

      {/* Conteúdo Principal em Camadas Sobrepostas (100% Stacked + Overlapping) */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-8 md:px-14 xl:pl-24 py-8 sm:py-12 md:py-16 flex flex-col">
        {/* Cabeçalho Assimétrico Deslocado */}
        <motion.header
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionConfig}
          className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2.5 bg-zinc-950 text-white px-3 py-1.5 border-2 border-zinc-950">
              <span className="w-2.5 h-2.5 bg-[#E5FF00] inline-block animate-cursor-500" />
              <span className="font-mono text-[11px] sm:text-xs font-black uppercase tracking-widest">
                SECURITY GATE // AUTHENTICATION REQUIRED
              </span>
            </div>

            <div className="inline-flex items-center gap-2 bg-white border-2 border-zinc-950 px-3 py-1 font-mono text-[11px] font-black uppercase shadow-[3px_3px_0_0_#18181B]">
              <Database size={13} strokeWidth={2.75} className="text-zinc-950" />
              <span>PROVISIONAMENTO: SOMENTE BANCO DE DADOS</span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] text-zinc-950">
            Acesso ao{' '}
            <span className="bg-[#E5FF00] px-3 sm:px-4 py-0.5 border-3 md:border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] md:shadow-[10px_10px_0_0_#18181B] inline-block mt-1">
              Terminal B2B
            </span>
          </h1>
        </motion.header>

        {/* Container Sobreposto em Eixo Z (Overlapping Brutalist Vault) */}
        <div className="relative w-full max-w-2xl self-start md:ml-8 lg:ml-16">
          {/* Laje Arquitetônica Deslocada de Fundo */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute -top-4 -right-4 md:-top-6 md:-right-6 w-full h-full bg-[#E5FF00] border-4 border-zinc-950 z-0"
          />

          {/* Cofre de Autenticação Principal */}
          <motion.section
            aria-label="Formulário de Login do Operador"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transitionConfig, delay: prefersReducedMotion ? 0 : 0.08 }}
            className="relative z-10 bg-white border-4 border-zinc-950 shadow-[8px_8px_0_0_#18181B] sm:shadow-[12px_12px_0_0_#18181B] p-5 sm:p-8 md:p-10 flex flex-col gap-6"
          >
            {/* Faixa Superior de Telemetria do Cofre */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b-4 border-zinc-950">
              <div className="flex items-center gap-2">
                <Terminal size={18} strokeWidth={3} className="text-zinc-950" />
                <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider">
                   CREDENCIAIS DE OPERADOR // SUPABASE AUTH
                </span>
              </div>
              <span className="font-mono text-[11px] font-black uppercase px-2 py-0.5 bg-zinc-950 text-[#E5FF00]">
                TLS // JWT
              </span>
            </div>

            {/* Aviso caso variáveis do Supabase não estejam definidas */}
            {!supabaseReady && (
              <div
                role="alert"
                className="p-4 bg-amber-50 border-3 border-zinc-950 shadow-[4px_4px_0_0_#18181B] flex items-start gap-3"
              >
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" strokeWidth={2.75} />
                <div className="flex flex-col gap-1">
                  <p className="font-black uppercase text-xs sm:text-sm text-zinc-950">
                    Variáveis do Supabase Ausentes
                  </p>
                  <p className="font-mono text-xs font-bold text-zinc-700 leading-relaxed">
                    Configure <code className="bg-zinc-200 px-1">NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
                    <code className="bg-zinc-200 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em{' '}
                    <code className="bg-zinc-200 px-1">.env.local</code> para validar usuários do banco.
                  </p>
                </div>
              </div>
            )}

            {/* Estado de erro de autenticação */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-3 p-4 bg-red-50 border-4 border-red-600 shadow-[5px_5px_0_0_#DC2626]"
              >
                <AlertTriangle className="text-red-600 shrink-0 w-6 h-6" strokeWidth={2.75} />
                <div className="min-w-0">
                  <h2 className="text-red-600 font-black uppercase text-sm sm:text-base mb-0.5">
                    Acesso Recusado
                  </h2>
                  <p className="font-mono font-bold text-xs sm:text-sm text-zinc-900 break-words">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {isCheckingSession ? (
              <div
                aria-live="polite"
                className="py-10 flex flex-col items-center justify-center gap-3 border-3 border-dashed border-zinc-950 bg-zinc-50"
              >
                <div className="w-8 h-8 bg-[#E5FF00] border-3 border-zinc-950 animate-spin" />
                <p className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-950">
                  Verificando sessão ativa...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
                {/* Campo E-mail */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="operator-email"
                    className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-950 flex items-center justify-between"
                  >
                    <span>01 // E-mail do Operador</span>
                    <span className="text-[11px] font-bold text-zinc-600">OBRIGATÓRIO</span>
                  </label>
                  <input
                    id="operator-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operador@empresa.com.br"
                    className="w-full h-13 sm:h-14 px-4 bg-zinc-50 text-zinc-950 font-mono font-bold text-sm sm:text-base border-3 border-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-[#E5FF00]/15 focus:shadow-[4px_4px_0_0_#18181B] transition-all disabled:opacity-60"
                  />
                </div>

                {/* Campo Senha */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="operator-password"
                      className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-950"
                    >
                      02 // Chave de Acesso (Senha)
                    </label>
                    {capsLockActive && (
                      <span
                        role="status"
                        className="font-mono text-[11px] font-black uppercase bg-[#E5FF00] text-zinc-950 px-2 py-0.5 border-2 border-zinc-950"
                      >
                        CAPS LOCK ATIVO
                      </span>
                    )}
                  </div>

                  <div className="relative flex items-stretch">
                    <input
                      id="operator-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      disabled={isSubmitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={handleKeyState}
                      onKeyDown={handleKeyState}
                      placeholder="••••••••••••"
                      className="w-full h-13 sm:h-14 pl-4 pr-14 bg-zinc-50 text-zinc-950 font-mono font-bold text-sm sm:text-base border-3 border-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-[#E5FF00]/15 focus:shadow-[4px_4px_0_0_#18181B] transition-all disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      className="w-13 sm:w-14 bg-zinc-950 text-[#E5FF00] hover:bg-zinc-800 border-y-3 border-r-3 border-zinc-950 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff size={20} strokeWidth={2.5} />
                      ) : (
                        <Eye size={20} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Botão Tátil de Submissão */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-tactile-6 mt-2 w-full min-h-[56px] sm:min-h-[64px] bg-[#E5FF00] hover:bg-[#d8f000] text-zinc-950 font-black uppercase tracking-wider text-base sm:text-xl border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] flex items-center justify-between px-5 sm:px-7 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-3">
                    <KeyRound size={22} strokeWidth={3} />
                    <span>{isSubmitting ? 'Autenticando...' : 'Liberar Terminal'}</span>
                  </span>
                  <ArrowRight size={24} strokeWidth={3} />
                </button>
              </form>
            )}

            {/* Barra de Status em Tempo Real + Regra de Provisionamento via Banco */}
            <div className="pt-4 border-t-3 border-zinc-950 flex flex-col gap-3">
              <div
                aria-live="polite"
                className="bg-zinc-950 text-white px-3.5 py-2.5 font-mono text-xs font-bold uppercase flex items-center justify-between gap-2"
              >
                <span className="truncate text-[#E5FF00]">&gt; {authStepText}</span>
                <ShieldCheck size={16} className="text-[#25D366] shrink-0" />
              </div>

              <div className="bg-zinc-100 border-2 border-zinc-950 p-3 flex items-start gap-2.5">
                <Lock size={16} strokeWidth={2.75} className="text-zinc-950 shrink-0 mt-0.5" />
                <p className="font-mono text-[11px] sm:text-xs font-bold text-zinc-800 leading-snug uppercase">
                  Auto-cadastro desativado. Novos operadores devem ser inseridos diretamente na tabela{' '}
                  <span className="bg-[#E5FF00] px-1 text-zinc-950 font-black">auth.users</span> no painel do
                  banco de dados Supabase.
                </p>
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* Rodapé Técnico Brutalista */}
      <footer className="relative z-10 border-t-4 border-zinc-950 bg-zinc-950 text-zinc-400 px-4 sm:px-8 md:px-14 xl:pl-24 py-4 font-mono text-[11px] font-bold uppercase flex flex-wrap items-center justify-between gap-2">
        <span>LEADCORE // B2B EXTRACTION ENGINE</span>
        <span className="text-[#E5FF00]">ZERO-TRUST SESSION GUARD ACTIVE</span>
      </footer>
    </div>
  );
}
