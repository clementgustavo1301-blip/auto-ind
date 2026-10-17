'use client';

import { useRef, useState } from 'react';
import { SearchPanel } from '@/components/SearchPanel';
import { SearchPanelIndustries, IndustrySearchParams } from '@/components/SearchPanelIndustries';
import { LeadCard } from '@/components/LeadCard';
import { IndustrialLeadCard } from '@/components/IndustrialLeadCard';
import { ExportPDF } from '@/components/ExportPDF';
import { ExportIndustrialPDF } from '@/components/ExportIndustrialPDF';
import { Lead, IndustrialLead } from '@/types';
import { AlertTriangle, Layers, Coins, Building2, Globe, MessageSquare, CheckCircle2 } from 'lucide-react';
import { WhatsAppCampaignPanel } from '@/components/WhatsAppCampaignPanel';

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


  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-[#E5FF00] selection:text-black">
      {/* Pura brutalidade: linha grossa no topo */}
      <div className="h-4 w-full bg-zinc-950" />
      
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 flex flex-col gap-16">
        {/* Header - Brutalist Typographic */}
        <header className="flex flex-col gap-6 md:gap-8 max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-[#E5FF00] border-2 border-zinc-950" />
            <span className="font-mono text-sm uppercase tracking-widest font-bold text-zinc-600">
              System // Lead Generation Core
            </span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] text-zinc-950">
            Encontre<br/>
            <span className="bg-[#E5FF00] px-4 border-4 border-zinc-950 shadow-[12px_12px_0_0_#18181B] inline-block mt-4 mb-2">
              Leads Reais
            </span>
          </h1>
          <p className="text-xl md:text-2xl font-bold text-zinc-700 max-w-2xl border-l-4 border-zinc-950 pl-6 mt-6 uppercase leading-snug">
            Automação de prospecção hiper-direcionada e extração B2B. Sem "Visual Fofinho". Apenas dados brutos.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-4 border-b-4 border-zinc-950 pb-0 w-full mt-4 flex-wrap">
          <button
            id="tab-local"
            onClick={() => { setActiveTab('local'); setError(''); }}
            className={`px-8 py-4 font-black uppercase tracking-wider text-xl border-4 border-b-0 border-zinc-950 transition-all flex items-center gap-2 ${
              activeTab === 'local' 
                ? 'bg-zinc-950 text-[#E5FF00] translate-y-1' 
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
            }`}
          >
            <Globe size={24} /> Locais
          </button>
          <button
            id="tab-industries"
            onClick={() => { setActiveTab('industries'); setError(''); }}
            className={`px-8 py-4 font-black uppercase tracking-wider text-xl border-4 border-b-0 border-zinc-950 transition-all flex items-center gap-2 ${
              activeTab === 'industries' 
                ? 'bg-[#E5FF00] text-zinc-950 translate-y-1' 
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
            }`}
          >
            <Building2 size={24} /> Indústrias
          </button>
          <button
            id="tab-whatsapp"
            onClick={() => { setActiveTab('whatsapp'); setError(''); }}
            className={`px-8 py-4 font-black uppercase tracking-wider text-xl border-4 border-b-0 border-zinc-950 transition-all flex items-center gap-2 ${
              activeTab === 'whatsapp' 
                ? 'bg-[#25D366] text-zinc-950 translate-y-1' 
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
            }`}
          >
            <MessageSquare size={24} /> WhatsApp {leadsWithWhatsApp.length > 0 ? `(${leadsWithWhatsApp.length})` : ''}
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
          <div className="flex items-start gap-4 p-6 bg-red-50 border-4 border-red-600 shadow-[8px_8px_0_0_#DC2626]">
            <AlertTriangle className="text-red-600 shrink-0" size={32} strokeWidth={2.5} />
            <div>
              <h3 className="text-red-600 font-black uppercase text-xl mb-1">Erro de Sintaxe</h3>
              <p className="font-mono font-bold text-zinc-800">{error}</p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {hasSearched && !error && (
          <section className="flex flex-col gap-8 w-full">
            <div className="flex items-center justify-between border-b-8 border-zinc-950 pb-6 mb-4">
              <h2 className="text-4xl md:text-5xl font-black uppercase flex items-center gap-4">
                <Layers size={40} strokeWidth={3} />
                Index
              </h2>
              {activeTab === 'local' && leads.length > 0 && (
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="font-mono bg-zinc-950 text-[#E5FF00] px-6 py-3 font-bold uppercase tracking-widest text-lg">
                    {leads.length} Records
                  </div>
                  <div className="bg-[#25D366]/20 border-2 border-emerald-600 text-emerald-950 px-3.5 py-2.5 font-mono font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#059669]">
                    <CheckCircle2 size={16} className="text-emerald-700" />
                    100% WhatsApp / Celular
                  </div>
                  {credits !== null && (
                    <div className="flex flex-col">
                      <div className="font-mono bg-orange-500 text-white px-4 py-3 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                        <Coins size={16} strokeWidth={3} />
                        {credits} créditos restantes
                      </div>
                      {renewalDate && (
                        <div className="font-mono bg-zinc-800 text-zinc-300 px-4 py-1.5 font-bold uppercase text-[10px] tracking-wider">
                          Renova: {renewalDate}
                        </div>
                      )}
                    </div>
                  )}
                  {leadsWithWhatsApp.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('whatsapp')}
                      className="flex items-center gap-2 bg-[#25D366] text-zinc-950 font-black uppercase py-3 px-5 text-sm border-4 border-zinc-950 hover:shadow-[6px_6px_0_0_#18181B] hover:-translate-y-1 transition-all"
                    >
                      <MessageSquare size={18} strokeWidth={3} />
                      Disparar WhatsApp ({leadsWithWhatsApp.length})
                    </button>
                  )}
                  <ExportPDF leads={leads} searchParams={searchParams} />
                </div>
              )}
              {activeTab === 'industries' && industrialLeads.length > 0 && (
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="font-mono bg-zinc-950 text-[#E5FF00] px-6 py-3 font-bold uppercase tracking-widest text-lg">
                    {industrialLeads.length} Records
                  </div>
                  <div className="bg-[#25D366]/20 border-2 border-emerald-600 text-emerald-950 px-3.5 py-2.5 font-mono font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0_0_#059669]">
                    <CheckCircle2 size={16} className="text-emerald-700" />
                    100% WhatsApp / Celular
                  </div>
                  {credits !== null && (
                    <div className="flex flex-col">
                      <div className="font-mono bg-orange-500 text-white px-4 py-3 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                        <Coins size={16} strokeWidth={3} />
                        {credits} créditos restantes
                      </div>
                      {renewalDate && (
                        <div className="font-mono bg-zinc-800 text-zinc-300 px-4 py-1.5 font-bold uppercase text-[10px] tracking-wider">
                          Renova: {renewalDate}
                        </div>
                      )}
                    </div>
                  )}
                  {leadsWithWhatsApp.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('whatsapp')}
                      className="flex items-center gap-2 bg-[#25D366] text-zinc-950 font-black uppercase py-3 px-5 text-sm border-4 border-zinc-950 hover:shadow-[6px_6px_0_0_#18181B] hover:-translate-y-1 transition-all"
                    >
                      <MessageSquare size={18} strokeWidth={3} />
                      Disparar WhatsApp ({leadsWithWhatsApp.length})
                    </button>
                  )}
                  <ExportIndustrialPDF leads={industrialLeads} searchParams={searchParams} />
                </div>
              )}
            </div>

            {isLoading ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-12">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-[320px] bg-zinc-100 border-4 border-zinc-300 relative overflow-hidden">
                     {/* Brutalist load animation */}
                     <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent animate-[shimmer_1.5s_infinite] -skew-x-12" />
                     <div className="absolute top-0 right-0 w-12 h-12 border-l-4 border-b-4 border-zinc-300 bg-zinc-200" />
                  </div>
                ))}
              </div>
            ) : (activeTab === 'local' && leads.length > 0) || (activeTab === 'industries' && industrialLeads.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
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
              <div className="flex flex-col items-center justify-center p-20 text-center border-4 border-zinc-950 bg-[#E5FF00]/10 shadow-[8px_8px_0_0_#18181B]">
                <p className="text-zinc-950 text-3xl font-black uppercase text-center max-w-lg leading-tight">
                  {hasExhaustedResults ? 'Todos os leads desta busca já foram exibidos' : 'Nenhum registro encontrado'}
                </p>
                <p className="text-zinc-600 font-mono font-bold mt-4 uppercase bg-white px-2 py-1 border-2 border-zinc-950">
                  {hasExhaustedResults ? 'Altere os filtros para encontrar novas empresas.' : '0 matches in absolute radius. Modify parameters.'}
                </p>
              </div>
            )}
          </section>
        )}
      </>
    )}
      </main>
    </div>
  );
}
