'use client';

import { Search, MapPin, Building2, Zap, Globe } from 'lucide-react';
import { useState } from 'react';

interface SearchPanelProps {
  onSearch: (params: { category: string; city: string; country: string; source: string; noSite?: string }) => void;
  isLoading: boolean;
}

export function SearchPanel({ onSearch, isLoading }: SearchPanelProps) {
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Brasil');
  const [source, setSource] = useState<'osm' | 'serpapi'>('serpapi');
  const [noSite, setNoSite] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !city || !country) return;
    onSearch({ category, city, country, source, ...(noSite ? { noSite: 'true' } : {}) });
  };

  return (
    <div className="bg-white border-4 border-zinc-950 p-4 sm:p-6 md:p-10 shadow-[6px_6px_0_0_#18181B] md:shadow-[12px_12px_0_0_#18181B] relative mt-3 md:mt-0">
      <div className="absolute -top-4 right-2 md:-top-5 md:-right-5 bg-[#E5FF00] border-3 md:border-4 border-zinc-950 shadow-[3px_3px_0_0_#18181B] md:shadow-[4px_4px_0_0_#18181B] px-3 py-1 md:px-4 md:py-2 font-mono font-black text-xs md:text-sm uppercase lg:rotate-3 z-10 transition-transform hover:rotate-0">
        Query Engine
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 sm:gap-7 lg:gap-10 w-full pt-2 md:pt-0">
        {/* Source Selector */}
        <div className="grid grid-cols-2 w-full border-3 md:border-4 border-zinc-950">
          <button
            type="button"
            onClick={() => setSource('osm')}
            className={`min-h-[48px] py-2.5 px-2 sm:px-4 font-mono font-black text-xs sm:text-sm uppercase tracking-tight sm:tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 transition-all cursor-pointer ${
              source === 'osm'
                ? 'bg-zinc-950 text-[#E5FF00]'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Globe size={15} strokeWidth={3} className="shrink-0" />
              <span>OpenStreetMap</span>
            </span>
            <span className="text-[9px] sm:text-[10px] opacity-70">FREE</span>
          </button>
          <button
            type="button"
            onClick={() => setSource('serpapi')}
            className={`min-h-[48px] py-2.5 px-2 sm:px-4 font-mono font-black text-xs sm:text-sm uppercase tracking-tight sm:tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 transition-all border-l-3 md:border-l-4 border-zinc-950 cursor-pointer ${
              source === 'serpapi'
                ? 'bg-zinc-950 text-[#E5FF00]'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Zap size={15} strokeWidth={3} className="shrink-0" />
              <span>Google Maps</span>
            </span>
            <span className="text-[9px] sm:text-[10px] opacity-70">250/MÊS</span>
          </button>
        </div>

        {/* Filtro: sem site */}
        <label
          className={`min-h-[48px] flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none border-3 md:border-4 py-2.5 px-3.5 sm:px-5 font-mono font-black text-xs sm:text-sm uppercase tracking-wide sm:tracking-wider transition-all ${
            noSite
              ? 'bg-red-600 text-white border-red-600 shadow-[4px_4px_0_0_#991b1b]'
              : 'bg-zinc-100 text-zinc-500 border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <input
            type="checkbox"
            checked={noSite}
            onChange={(e) => setNoSite(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 transition-all ${
            noSite ? 'bg-white border-white' : 'border-zinc-400 bg-transparent'
          }`}>
            {noSite && <span className="text-red-600 font-black text-xs">✓</span>}
          </div>
          <span className="flex flex-wrap items-center gap-1.5">
            <span>Apenas sem site</span>
            <span className="text-[10px] opacity-75">(OPORTUNIDADES)</span>
          </span>
        </label>

        <div className="flex flex-col md:flex-row gap-5 sm:gap-7 lg:gap-10 items-stretch md:items-end w-full">
          <div className="flex-1 w-full flex flex-col gap-2 sm:gap-3">
            <label className="font-mono font-bold uppercase text-xs sm:text-sm tracking-widest text-zinc-950 flex items-center gap-2">
              <Building2 size={18} strokeWidth={3} /> Alvo / Nicho
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="EX: RESTAURANTES"
              className="w-full bg-zinc-50 border-3 md:border-4 border-zinc-950 text-zinc-950 rounded-none py-3.5 px-4 md:py-4 md:px-5 focus:outline-none focus:bg-[#E5FF00]/20 focus:ring-4 focus:ring-zinc-950/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-base sm:text-lg md:text-xl"
              required
            />
          </div>

          <div className="flex-1 w-full flex flex-col gap-2 sm:gap-3">
            <label className="font-mono font-bold uppercase text-xs sm:text-sm tracking-widest text-zinc-950 flex items-center gap-2">
              <MapPin size={18} strokeWidth={3} /> Localização
            </label>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
               <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="CIDADE"
                  className="col-span-2 w-full bg-zinc-50 border-3 md:border-4 border-zinc-950 text-zinc-950 rounded-none py-3.5 px-3.5 md:py-4 md:px-5 focus:outline-none focus:bg-[#E5FF00]/20 focus:ring-4 focus:ring-zinc-950/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-base sm:text-lg md:text-xl"
                  required
                />
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="PAÍS"
                  className="col-span-1 w-full bg-zinc-50 border-3 md:border-4 border-zinc-950 text-zinc-950 rounded-none py-3.5 px-3 md:py-4 md:px-5 focus:outline-none focus:bg-[#E5FF00]/20 focus:ring-4 focus:ring-zinc-950/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-base sm:text-lg md:text-xl"
                  required
                />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full md:w-auto mt-1 md:mt-0 bg-[#E5FF00] text-zinc-950 font-black text-xl md:text-2xl uppercase tracking-wider border-4 border-zinc-950 py-3.5 px-8 md:py-4 md:px-10 shadow-[5px_5px_0_0_#18181B] md:shadow-[8px_8px_0_0_#18181B] hover:shadow-none hover:translate-y-1 hover:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[60px] md:h-[76px] flex items-center justify-center gap-3 md:gap-4 group cursor-pointer"
          >
            {isLoading ? (
              <span className="font-mono text-base md:text-lg tracking-widest animate-pulse">PROCESSANDO...</span>
            ) : (
              <>
                Extrair <Search strokeWidth={4} size={24} className="group-hover:rotate-12 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
