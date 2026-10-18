'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchPanel } from '@/components/SearchPanel';
import { SearchPanelIndustries, IndustrySearchParams } from '@/components/SearchPanelIndustries';
import { LeadCard } from '@/components/LeadCard';
import { IndustrialLeadCard } from '@/components/IndustrialLeadCard';
import { ExportPDF } from '@/components/ExportPDF';
import { ExportIndustrialPDF } from '@/components/ExportIndustrialPDF';
import { Lead, IndustrialLead } from '@/types';
import { AlertTriangle, Layers, Coins, Building2, Globe, MessageSquare, CheckCircle2, LogOut, Bot } from 'lucide-react';
import { WhatsAppCampaignPanel } from '@/components/WhatsAppCampaignPanel';
import { supabase } from '@/lib/supabase';
import { getOperatorSession, signOutOperator } from '@/lib/auth';

type SearchRequest = {
  category: string;
  city: string;
  country: string;
  source?: string;
  noSite?: string;
};

function getSearchKey(params: SearchRequest) {
  return [
    'local',
    params.category,
    params.city,
    params.country,
    params.source || 'osm',
    params.noSite || 'false',
  ]
    .map(value => value.trim().toLocaleLowerCase('pt-BR'))
    .join('|');
}

function getIndustrySearchKey(params: IndustrySearchParams) {
  return [
    'industry',
    params.country,
    params.state || '',
    params.city || '',
    params.segments.join(','),
    params.applications.join(','),
    params.saltTypes.join(','),
    params.companySize
  ]
    .map(value => (value || '').trim().toLocaleLowerCase('pt-BR'))
    .join('|');
}

export default function Home() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [operatorEmail, setOperatorEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'local' | 'industries' | 'whatsapp'>('local');
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [industrialLeads, setIndustrialLeads] = useState<IndustrialLead[]>([]);

  // Agrupar leads válidos com WhatsApp de qualquer busca realizada
  const leadsWithWhatsApp = (activeTab === 'industries' && industrialLeads.length > 0)
    ? industrialLeads.filter(l => Boolean(l.whatsapp && l.whatsapp.trim().length > 0))
    : (leads.length > 0)
    ? leads.filter(l => Boolean(l.whatsapp && l.whatsapp.trim().length > 0))
    : [...industrialLeads, ...leads].filter(l => Boolean(l.whatsapp && l.whatsapp.trim().length > 0));
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const [searchParams, setSearchParams] = useState({ category: '', city: '', country: '' });
  const [credits, setCredits] = useState<number | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [hasExhaustedResults, setHasExhaustedResults] = useState(false);
  const seenLeadIds = useRef(new Map<string, Set<string>>());

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      const session = await getOperatorSession();
      if (!mounted) return;

      if (!session) {
        router.replace('/login');
        return;
      }

      setOperatorEmail(session.user.email || 'OPERADOR');
      setIsCheckingAuth(false);
    }

    verifySession();

    const authListener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        router.replace('/login');
      } else {
        setOperatorEmail(session.user.email || 'OPERADOR');
        setIsCheckingAuth(false);
      }
    });

    return () => {
      mounted = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await signOutOperator();
    router.replace('/login');
  };

  const handleSearch = async (params: SearchRequest) => {
    setIsLoading(true);
    setError('');
    setHasSearched(true);
    setHasExhaustedResults(false);
    setSearchParams({ category: params.category, city: params.city, country: params.country });
    
    try {
      const searchKey = getSearchKey(params);
      const previousLeadIds = seenLeadIds.current.get(searchKey) || new Set<string>();
      const query = new URLSearchParams();

      for (const [key, value] of Object.entries(params)) {
        if (value) query.set(key, value);
      }

      if (previousLeadIds.size > 0) {
        query.set('excludeIds', [...previousLeadIds].join(','));
      }

      const res = await fetch(`/api/leads?${query.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Falha ao buscar leads');
      }
      
      const data = await res.json();
      const newLeads = data.leads || [];
      setLeads(newLeads);
      setHasExhaustedResults(data.exhausted === true);

      if (newLeads.length > 0) {
        const updatedLeadIds = new Set(previousLeadIds);
        newLeads.forEach((lead: Lead) => updatedLeadIds.add(lead.id));
        seenLeadIds.current.set(searchKey, updatedLeadIds);
      }

      if (data.credits !== undefined && data.credits !== null) {
        setCredits(data.credits);
      } else {
        setCredits(null);
      }
      
      if (data.renewalDate !== undefined && data.renewalDate !== null) {
        setRenewalDate(data.renewalDate);
      } else {
        setRenewalDate(null);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao buscar os leads.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndustrySearch = async (params: IndustrySearchParams) => {
    setIsLoading(true);
    setError('');
    setHasSearched(true);
    setHasExhaustedResults(false);
    setSearchParams({ category: params.segments.join(', ') || 'Todos', city: params.city || params.state, country: params.country });
    
    try {
      const searchKey = getIndustrySearchKey(params);
      const previousLeadIds = seenLeadIds.current.get(searchKey) || new Set<string>();

      const query = new URLSearchParams();
      query.set('country', params.country);
      if (params.state) query.set('state', params.state);
      if (params.city) query.set('city', params.city);
      if (params.segments.length > 0) query.set('segments', params.segments.join(','));
      if (params.applications.length > 0) query.set('applications', params.applications.join(','));
      if (params.saltTypes.length > 0) query.set('saltTypes', params.saltTypes.join(','));
      query.set('companySize', params.companySize);
      query.set('quantity', params.quantity.toString());

      if (previousLeadIds.size > 0) {
        query.set('excludeIds', [...previousLeadIds].join(','));
      }

      const res = await fetch(`/api/industries?${query.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Falha ao buscar indústrias');
      }
      
      const data = await res.json();
      const newLeads = data.leads || [];
      setIndustrialLeads(newLeads);
      setHasExhaustedResults(data.exhausted === true);

      if (newLeads.length > 0) {
        const updatedLeadIds = new Set(previousLeadIds);
        newLeads.forEach((lead: IndustrialLead) => updatedLeadIds.add(lead.id));
        seenLeadIds.current.set(searchKey, updatedLeadIds);
      }

      if (data.credits !== undefined && data.credits !== null) {
        setCredits(data.credits);
      } else {
        setCredits(null);
      }
      
      if (data.renewalDate !== undefined && data.renewalDate !== null) {
        setRenewalDate(data.renewalDate);
      } else {
        setRenewalDate(null);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao buscar indústrias.');
    } finally {
      setIsLoading(false);
    }
  };


  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-white text-zinc-950 font-sans flex flex-col justify-between">
        <div className="h-3 md:h-4 w-full bg-zinc-950" />
        <main className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-10 h-10 bg-[#E5FF00] border-4 border-zinc-950 shadow-[4px_4px_0_0_#18181B] animate-spin" />
          <p className="font-mono text-xs sm:text-sm font-black uppercase tracking-widest text-zinc-950 bg-zinc-100 px-3 py-1.5 border-2 border-zinc-950">
            VERIFICANDO SESSÃO CRIPTOGRÁFICA // LEADCORE
          </p>
        </main>
        <div className="h-3 md:h-4 w-full bg-zinc-950" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-[#E5FF00] selection:text-black overflow-x-hidden">
      {/* Pura brutalidade: linha grossa no topo */}
      <div className="h-3 md:h-4 w-full bg-zinc-950" />
      
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 md:px-12 pt-5 pb-28 md:py-20 flex flex-col gap-7 sm:gap-10 md:gap-16">
        {/* Header - Brutalist Typographic (Adaptado para Mobile) */}
        <header className="flex flex-col gap-3 sm:gap-5 md:gap-8 max-w-4xl">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 md:w-4 md:h-4 bg-[#E5FF00] border-2 border-zinc-950 shrink-0" />
              <span className="font-mono text-[11px] sm:text-xs md:text-sm uppercase tracking-widest font-bold text-zinc-600 truncate">
                System // Lead Generation Core
              </span>
            </div>
            <div className="flex items-center gap-2">
              {leadsWithWhatsApp.length > 0 && activeTab !== 'whatsapp' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('whatsapp')}
                  className="md:hidden bg-[#25D366] text-zinc-950 border-2 border-zinc-950 px-2.5 py-1 font-mono font-black text-[10px] uppercase flex items-center gap-1 shadow-[2px_2px_0_0_#18181B] shrink-0"
                >
                  <MessageSquare size={12} strokeWidth={3} />
                  {leadsWithWhatsApp.length} WPP
                </button>
              )}
              {operatorEmail && (
                <span className="hidden sm:inline-block font-mono text-[11px] font-bold uppercase bg-zinc-100 border-2 border-zinc-950 px-2.5 py-1 text-zinc-800 truncate max-w-[220px]">
                  {operatorEmail}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                title="Encerrar sessão"
                className="btn-tactile-4 bg-white hover:bg-[#E5FF00] text-zinc-950 border-2 border-zinc-950 px-2.5 sm:px-3 py-1 font-mono font-black text-[10px] sm:text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#18181B] cursor-pointer shrink-0"
              >
                <LogOut size={13} strokeWidth={2.75} />
                <span>Sair</span>
              </button>
            </div>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.92] text-zinc-950">
            Encontre<br/>
            <span className="bg-[#E5FF00] px-2.5 sm:px-4 py-0.5 border-3 md:border-4 border-zinc-950 shadow-[6px_6px_0_0_#18181B] md:shadow-[12px_12px_0_0_#18181B] inline-block mt-2 md:mt-4 mb-1 md:mb-2">
              Leads Reais
            </span>
          </h1>
          <p className="text-sm sm:text-lg md:text-2xl font-bold text-zinc-700 max-w-2xl border-l-4 border-zinc-950 pl-3.5 sm:pl-6 mt-1 md:mt-6 uppercase leading-snug">
            Automação de prospecção hiper-direcionada e extração B2B. Sem &quot;Visual Fofinho&quot;. Apenas dados brutos.
          </p>
        </header>

        {/* Tabs Superiores (Compactas no Mobile, Completas no Desktop) */}
        <div className="grid grid-cols-3 md:flex gap-1.5 sm:gap-3 md:gap-4 border-b-4 border-zinc-950 pb-0 w-full mt-1 md:mt-4">
          <button
            id="tab-local"
            onClick={() => { setActiveTab('local'); setError(''); }}
            className={`px-2 sm:px-5 md:px-8 py-3 md:py-4 font-black uppercase tracking-tight sm:tracking-wider text-xs sm:text-base md:text-xl border-3 md:border-4 border-b-0 border-zinc-950 transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[48px] ${
              activeTab === 'local' 
                ? 'bg-zinc-950 text-[#E5FF00] translate-y-1' 
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
            }`}
          >
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 shrink-0" />
            <span className="truncate">Locais</span>
          </button>
          <button
            id="tab-industries"
            onClick={() => { setActiveTab('industries'); setError(''); }}
            className={`px-2 sm:px-5 md:px-8 py-3 md:py-4 font-black uppercase tracking-tight sm:tracking-wider text-xs sm:text-base md:text-xl border-3 md:border-4 border-b-0 border-zinc-950 transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[48px] ${
              activeTab === 'industries' 
                ? 'bg-[#E5FF00] text-zinc-950 translate-y-1' 
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
            }`}
          >
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 shrink-0" />
            <span className="truncate">Indústrias</span>
          </button>
          <button
            id="tab-whatsapp"
            onClick={() => { setActiveTab('whatsapp'); setError(''); }}
            className={`px-2 sm:px-5 md:px-8 py-3 md:py-4 font-black uppercase tracking-tight sm:tracking-wider text-xs sm:text-base md:text-xl border-3 md:border-4 border-b-0 border-zinc-950 transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-h-[48px] relative ${
              activeTab === 'whatsapp' 
                ? 'bg-[#25D366] text-zinc-950 translate-y-1' 
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
            }`}
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 shrink-0" />
            <span className="truncate">WhatsApp & Robô IA</span>
            {leadsWithWhatsApp.length > 0 && (
              <span className="bg-zinc-950 text-[#E5FF00] text-[10px] sm:text-xs font-mono font-black px-1.5 py-0.5 leading-none">
                {leadsWithWhatsApp.length}
              </span>
            )}
          </button>
        </div>

        {/* Conteúdo da Aba Ativa */}
        {activeTab === 'whatsapp' ? (
          <WhatsAppCampaignPanel 
            initialLeads={leadsWithWhatsApp} 
            onBackToSearch={() => setActiveTab('local')} 
          />
        ) : (
          <>
            {/* Search Section */}
            <section className="w-full">
              {activeTab === 'local' ? (
                <SearchPanel onSearch={handleSearch} isLoading={isLoading} />
              ) : (
                <SearchPanelIndustries onSearch={handleIndustrySearch} isLoading={isLoading} />
              )}
            </section>

        {/* Error State */}
        {error && (
          <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-red-50 border-4 border-red-600 shadow-[5px_5px_0_0_#DC2626] md:shadow-[8px_8px_0_0_#DC2626]">
            <AlertTriangle className="text-red-600 shrink-0 w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.5} />
            <div className="min-w-0">
              <h3 className="text-red-600 font-black uppercase text-base sm:text-xl mb-1">Erro de Sintaxe</h3>
              <p className="font-mono font-bold text-xs sm:text-sm text-zinc-800 break-words">{error}</p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && !error && (
          <section className="flex flex-col gap-5 sm:gap-8 w-full">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-4 md:border-b-8 border-zinc-950 pb-4 md:pb-6 mb-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase flex items-center gap-2.5 sm:gap-4">
                  <Layers className="w-7 h-7 sm:w-10 sm:h-10" strokeWidth={3} />
                  Index
                </h2>
                {((activeTab === 'local' && leads.length > 0) || (activeTab === 'industries' && industrialLeads.length > 0)) && (
                  <div className="lg:hidden font-mono bg-zinc-950 text-[#E5FF00] px-3 py-1.5 font-bold uppercase tracking-widest text-xs sm:text-sm">
                    {activeTab === 'local' ? leads.length : industrialLeads.length} Records
                  </div>
                )}
              </div>

              {activeTab === 'local' && leads.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap w-full lg:w-auto">
                  <div className="hidden lg:block font-mono bg-zinc-950 text-[#E5FF00] px-6 py-3 font-bold uppercase tracking-widest text-lg">
                    {leads.length} Records
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-[#25D366]/20 border-2 border-emerald-600 text-emerald-950 px-3 py-2 font-mono font-black text-[11px] sm:text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#059669]">
                      <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                      100% WhatsApp / Celular
                    </div>
                    {credits !== null && (
                      <div className="flex items-center gap-2 bg-orange-500 text-white px-3 py-2 font-mono font-bold uppercase text-xs">
                        <Coins size={14} strokeWidth={3} />
                        <span>{credits} créditos</span>
                        {renewalDate && <span className="opacity-80 text-[10px]">({renewalDate})</span>}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:flex gap-2.5 sm:gap-3 w-full sm:w-auto">
                    {leadsWithWhatsApp.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('whatsapp')}
                        className="btn-tactile-4 w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 bg-[#25D366] text-zinc-950 font-black uppercase py-3 px-5 text-xs sm:text-sm border-3 md:border-4 border-zinc-950 shadow-[4px_4px_0_0_#18181B] transition-all cursor-pointer"
                      >
                        <MessageSquare size={18} strokeWidth={3} />
                        Disparar WhatsApp ({leadsWithWhatsApp.length})
                      </button>
                    )}
                    <ExportPDF leads={leads} searchParams={searchParams} />
                  </div>
                </div>
              )}

              {activeTab === 'industries' && industrialLeads.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap w-full lg:w-auto">
                  <div className="hidden lg:block font-mono bg-zinc-950 text-[#E5FF00] px-6 py-3 font-bold uppercase tracking-widest text-lg">
                    {industrialLeads.length} Records
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-[#25D366]/20 border-2 border-emerald-600 text-emerald-950 px-3 py-2 font-mono font-black text-[11px] sm:text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#059669]">
                      <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                      100% WhatsApp / Celular
                    </div>
                    {credits !== null && (
                      <div className="flex items-center gap-2 bg-orange-500 text-white px-3 py-2 font-mono font-bold uppercase text-xs">
                        <Coins size={14} strokeWidth={3} />
                        <span>{credits} créditos</span>
                        {renewalDate && <span className="opacity-80 text-[10px]">({renewalDate})</span>}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:flex gap-2.5 sm:gap-3 w-full sm:w-auto">
                    {leadsWithWhatsApp.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('whatsapp')}
                        className="btn-tactile-4 w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 bg-[#25D366] text-zinc-950 font-black uppercase py-3 px-5 text-xs sm:text-sm border-3 md:border-4 border-zinc-950 shadow-[4px_4px_0_0_#18181B] transition-all cursor-pointer"
                      >
                        <MessageSquare size={18} strokeWidth={3} />
                        Disparar WhatsApp ({leadsWithWhatsApp.length})
                      </button>
                    )}
                    <ExportIndustrialPDF leads={industrialLeads} searchParams={searchParams} />
                  </div>
                </div>
              )}
            </div>

            {isLoading ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 lg:gap-12">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-[240px] sm:h-[320px] bg-zinc-100 border-4 border-zinc-300 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent animate-[shimmer_1.5s_infinite] -skew-x-12" />
                     <div className="absolute top-0 right-0 w-10 h-10 sm:w-12 sm:h-12 border-l-4 border-b-4 border-zinc-300 bg-zinc-200" />
                  </div>
                ))}
              </div>
            ) : (activeTab === 'local' && leads.length > 0) || (activeTab === 'industries' && industrialLeads.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 lg:gap-12">
                {activeTab === 'local' ? (
                  leads.map((lead, idx) => (
                    <LeadCard key={lead.id} index={idx + 1} lead={lead} />
                  ))
                ) : (
                  industrialLeads.map((lead, idx) => (
                    <IndustrialLeadCard key={lead.id} index={idx + 1} lead={lead} />
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 sm:p-14 md:p-20 text-center border-4 border-zinc-950 bg-[#E5FF00]/10 shadow-[6px_6px_0_0_#18181B] md:shadow-[8px_8px_0_0_#18181B]">
                <p className="text-zinc-950 text-xl sm:text-3xl font-black uppercase text-center max-w-lg leading-tight">
                  {hasExhaustedResults ? 'Todos os leads desta busca já foram exibidos' : 'Nenhum registro encontrado'}
                </p>
                <p className="text-zinc-600 font-mono text-xs sm:text-sm font-bold mt-4 uppercase bg-white px-2.5 py-1.5 border-2 border-zinc-950">
                  {hasExhaustedResults ? 'Altere os filtros para encontrar novas empresas.' : '0 matches in absolute radius. Modify parameters.'}
                </p>
              </div>
            )}
          </section>
        )}
      </>
    )}
      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA PARA MOBILE (ESTILO APP NATIVO) */}
      <nav
        aria-label="Navegação Mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t-4 border-zinc-950 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
      >
        <div className="grid grid-cols-3 h-16">
          <button
            type="button"
            onClick={() => {
              setActiveTab('local');
              setError('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-1 font-mono font-black uppercase text-[11px] tracking-wider transition-colors border-r-2 border-zinc-800 ${
              activeTab === 'local'
                ? 'bg-[#E5FF00] text-zinc-950'
                : 'bg-zinc-950 text-zinc-400 active:bg-zinc-900'
            }`}
          >
            <Globe size={20} strokeWidth={2.75} />
            <span>Locais</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('industries');
              setError('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-1 font-mono font-black uppercase text-[11px] tracking-wider transition-colors border-r-2 border-zinc-800 ${
              activeTab === 'industries'
                ? 'bg-[#E5FF00] text-zinc-950'
                : 'bg-zinc-950 text-zinc-400 active:bg-zinc-900'
            }`}
          >
            <Building2 size={20} strokeWidth={2.75} />
            <span>Indústrias</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('whatsapp');
              setError('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-1 font-mono font-black uppercase text-[11px] tracking-wider transition-colors relative ${
              activeTab === 'whatsapp'
                ? 'bg-[#25D366] text-zinc-950'
                : 'bg-zinc-950 text-zinc-400 active:bg-zinc-900'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <MessageSquare size={20} strokeWidth={2.75} />
              {leadsWithWhatsApp.length > 0 && (
                <span
                  className={`absolute -top-1.5 -right-4 px-1.5 py-0.2 text-[9px] font-mono font-black border ${
                    activeTab === 'whatsapp'
                      ? 'bg-zinc-950 text-[#E5FF00] border-zinc-950'
                      : 'bg-[#25D366] text-zinc-950 border-zinc-950'
                  }`}
                >
                  {leadsWithWhatsApp.length}
                </span>
              )}
            </div>
            <span>WhatsApp</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
