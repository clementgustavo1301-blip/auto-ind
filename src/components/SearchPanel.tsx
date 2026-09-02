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
  const [source, setSource] = useState<'osm' | 'serpapi'>('osm');
  const [noSite, setNoSite] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !city || !country) return;
    onSearch({ category, city, country, source, ...(noSite ? { noSite: 'true' } : {}) });
  };

  return (
    <div className="bg-white border-4 border-zinc-950 p-6 md:p-10 shadow-[12px_12px_0_0_#18181B] relative">
      <div className="absolute -top-5 -right-5 bg-[#E5FF00] border-4 border-zinc-950 shadow-[4px_4px_0_0_#18181B] px-4 py-2 font-mono font-black text-sm uppercase lg:rotate-3 z-10 transition-transform hover:rotate-0">
        Query Engine
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-8 lg:gap-10 w-full">
        {/* Source Selector */}
        <div className="flex gap-0 w-full border-4 border-zinc-950">
          <button
            type="button"
            onClick={() => setSource('osm')}
            className={`flex-1 py-3 px-4 font-mono font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              source === 'osm'
                ? 'bg-zinc-950 text-[#E5FF00]'
                : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600'
            }`}
          >
            <Globe size={16} strokeWidth={3} />
            OpenStreetMap
            <span className="text-[10px] opacity-60 ml-1">FREE</span>
          </button>
          <button
            type="button"
            onClick={() => setSource('serpapi')}
            className={`flex-1 py-3 px-4 font-mono font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-l-4 border-zinc-950 cursor-pointer ${
              source === 'serpapi'
                ? 'bg-zinc-950 text-[#E5FF00]'
                : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600'
            }`}
          >
            <Zap size={16} strokeWidth={3} />
            Google Maps
            <span className="text-[10px] opacity-60 ml-1">250/MÊS</span>
          </button>
        </div>

        {/* Filtro: sem site */}
        <label
          className={`flex items-center gap-3 cursor-pointer select-none border-4 py-3 px-5 font-mono font-black text-sm uppercase tracking-wider transition-all ${
            noSite
              ? 'bg-red-600 text-white border-red-600 shadow-[4px_4px_0_0_#991b1b]'
              : 'bg-zinc-100 text-zinc-400 border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <input
            type="checkbox"
            checked={noSite}
            onChange={(e) => setNoSite(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-5 h-5 border-3 flex items-center justify-center transition-all ${
            noSite ? 'bg-white border-white' : 'border-zinc-400 bg-transparent'
          }`}>
            {noSite && <span className="text-red-600 font-black text-xs">✓</span>}
          </div>
          Apenas sem site
          <span className="text-[10px] opacity-70">(OPORTUNIDADES)</span>
        </label>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-10 items-end w-full">
          <div className="flex-1 w-full flex flex-col gap-3">
            <label className="font-mono font-bold uppercase text-sm tracking-widest text-zinc-950 flex items-center gap-2">
              <Building2 size={18} strokeWidth={3} /> Alvo / Nicho
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="EX: RESTAURANTES"
              className="w-full bg-zinc-50 border-4 border-zinc-950 text-zinc-950 rounded-none py-4 px-5 focus:outline-none focus:bg-[#E5FF00]/20 focus:ring-4 focus:ring-zinc-950/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-xl"
              required
            />
          </div>

          <div className="flex-1 w-full flex flex-col gap-3">
            <label className="font-mono font-bold uppercase text-sm tracking-widest text-zinc-950 flex items-center gap-2">
              <MapPin size={18} strokeWidth={3} /> Localização
            </label>
            <div className="flex gap-4">
               <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="CIDADE"
                  className="w-full bg-zinc-50 border-4 border-zinc-950 text-zinc-950 rounded-none py-4 px-5 focus:outline-none focus:bg-[#E5FF00]/20 focus:ring-4 focus:ring-zinc-950/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-xl"
                  required
                />
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="PAÍS"
                  className="w-1/3 bg-zinc-50 border-4 border-zinc-950 text-zinc-950 rounded-none py-4 px-5 focus:outline-none focus:bg-[#E5FF00]/20 focus:ring-4 focus:ring-zinc-950/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-xl"
                  required
                />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full md:w-auto mt-4 md:mt-0 bg-[#E5FF00] text-zinc-950 font-black text-2xl uppercase tracking-wider border-4 border-zinc-950 py-4 px-10 shadow-[8px_8px_0_0_#18181B] hover:shadow-none hover:translate-y-2 hover:translate-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed h-[76px] flex items-center justify-center gap-4 group cursor-pointer"
          >
            {isLoading ? (
              <span className="font-mono text-lg tracking-widest animate-pulse">PROCESSANDO...</span>
            ) : (
              <>
                Extrair <Search strokeWidth={4} size={28} className="group-hover:rotate-12 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
