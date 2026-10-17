'use client';

import { Search, MapPin, Building2, Zap, Settings, Factory, Layers } from 'lucide-react';
import { useState } from 'react';

export type IndustrySearchParams = {
  country: string;
  state: string;
  city: string;
  segments: string[];
  applications: string[];
  saltTypes: string[];
  companySize: string;
  quantity: number;
};

interface SearchPanelIndustriesProps {
  onSearch: (params: IndustrySearchParams) => void;
  isLoading: boolean;
}

const SEGMENTOS_INDUSTRIAIS = [
  'Indústria Química', 'Indústria Petroquímica', 'Indústria de Petróleo e Gás',
  'Perfuração de Poços', 'Tratamento de Água', 'Tratamento de Efluentes', 'Saneamento',
  'Indústria de Limpeza', 'Produtos de Limpeza', 'Fabricação de Detergentes', 'Fabricação de Sabões',
  'Indústria Têxtil', 'Curtumes', 'Indústria Alimentícia', 'Frigoríficos',
  'Indústria de Conservação de Alimentos', 'Indústria de Processamento de Carnes',
  'Indústria de Pescados', 'Indústria de Laticínios', 'Indústria Farmacêutica',
  'Indústria de Cosméticos', 'Indústria de Higiene', 'Fabricação de Cloro e Derivados',
  'Fabricação de Hipoclorito', 'Indústria de Plásticos', 'Indústria de Borracha',
  'Indústria de Papel e Celulose', 'Indústria de Vidro', 'Indústria Metalúrgica',
  'Mineração', 'Indústria de Fertilizantes', 'Indústria Agroquímica',
  'Indústria de Ração Animal', 'Indústria de Biodiesel', 'Indústria de Biocombustíveis',
  'Usinas', 'Indústrias de Processos Químicos', 'Outras indústrias', 'Todos os segmentos'
];

const APLICACOES_SAL = [
  'Tratamento de água', 'Tratamento de efluentes', 'Regeneração de sistemas de abrandamento de água',
  'Produção de cloro', 'Produção de hipoclorito', 'Processos químicos', 'Perfuração de poços',
  'Petróleo e gás', 'Processamento de alimentos', 'Conservação', 'Processamento de carnes',
  'Processamento de pescados', 'Produção de sabão', 'Produção de detergentes',
  'Indústria têxtil', 'Curtimento de couro', 'Produção farmacêutica', 'Produção de cosméticos',
  'Processos industriais diversos', 'Outro uso industrial'
];

const TIPOS_SAL = [
  'Sal industrial', 'Sal grosso industrial', 'Sal refinado industrial', 'Sal granulado',
  'Cloreto de sódio industrial', 'Sal para tratamento de água', 'Sal para processos químicos',
  'Sal para regeneração de resinas', 'Outro'
];

export function SearchPanelIndustries({ onSearch, isLoading }: SearchPanelIndustriesProps) {
  const [country, setCountry] = useState('Brasil');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  
  const [segments, setSegments] = useState<string[]>([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [saltTypes, setSaltTypes] = useState<string[]>([]);
  
  const [companySize, setCompanySize] = useState('Todas');
  const [quantity, setQuantity] = useState<number>(50);

  const toggleSelection = (item: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!country) return;
    onSearch({ country, state, city, segments, applications, saltTypes, companySize, quantity });
  };

  return (
    <div className="bg-zinc-50 border-4 border-zinc-950 p-4 sm:p-6 md:p-10 shadow-[6px_6px_0_0_#18181B] md:shadow-[12px_12px_0_0_#18181B] relative mt-3 md:mt-0">
      <div className="absolute -top-4 right-2 md:-top-5 md:-right-5 bg-zinc-950 text-[#E5FF00] border-3 md:border-4 border-[#E5FF00] shadow-[3px_3px_0_0_#E5FF00] md:shadow-[4px_4px_0_0_#E5FF00] px-3 py-1 md:px-4 md:py-2 font-mono font-black text-xs md:text-sm uppercase lg:rotate-3 z-10 transition-transform hover:rotate-0 flex items-center gap-1.5">
        <Factory size={15} /> B2B Industries
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-8 w-full pt-2 md:pt-0">
        
        {/* Localização */}
        <div className="flex flex-col gap-3">
           <label className="font-mono font-bold uppercase text-xs sm:text-sm tracking-widest text-zinc-950 flex items-center gap-2 border-b-2 border-zinc-950 pb-2">
            <MapPin size={18} strokeWidth={3} className="shrink-0" /> 1. Localização Alvo
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
             <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="PAÍS (Obrigatório)"
                className="w-full min-h-[48px] bg-white border-3 md:border-4 border-zinc-950 text-zinc-950 rounded-none py-3 px-4 focus:outline-none focus:bg-[#E5FF00]/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-sm sm:text-base"
                required
              />
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="ESTADO / REGIÃO (Opcional)"
                className="w-full min-h-[48px] bg-white border-3 md:border-4 border-zinc-950 text-zinc-950 rounded-none py-3 px-4 focus:outline-none focus:bg-[#E5FF00]/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-sm sm:text-base"
              />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="CIDADE (Opcional)"
                className="w-full min-h-[48px] bg-white border-3 md:border-4 border-zinc-950 text-zinc-950 rounded-none py-3 px-4 focus:outline-none focus:bg-[#E5FF00]/20 transition-all font-bold placeholder:text-zinc-400 placeholder:font-mono text-sm sm:text-base"
              />
          </div>
        </div>

        {/* Segmentos e Aplicações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          
          <div className="flex flex-col gap-2.5 sm:gap-3">
             <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-2 gap-2">
               <label className="font-mono font-bold uppercase text-xs sm:text-sm tracking-widest text-zinc-950 flex items-center gap-2">
                <Building2 size={18} strokeWidth={3} className="shrink-0" /> 2. Segmentos ({segments.length || 'Todos'})
              </label>
              {segments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSegments([])}
                  className="text-[10px] font-mono font-black uppercase bg-zinc-200 px-2 py-0.5 border border-zinc-950"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="max-h-52 sm:max-h-60 overflow-y-auto border-3 md:border-4 border-zinc-950 bg-white p-2.5 flex flex-wrap gap-1.5 sm:gap-2 custom-scrollbar">
               {SEGMENTOS_INDUSTRIAIS.map(seg => (
                 <button
                   key={seg}
                   type="button"
                   onClick={() => toggleSelection(seg, segments, setSegments)}
                   className={`min-h-[36px] text-xs font-mono font-bold px-3 py-1.5 border-2 uppercase transition-all text-left ${
                     segments.includes(seg) 
                       ? 'bg-zinc-950 text-[#E5FF00] border-zinc-950' 
                       : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:border-zinc-950'
                   }`}
                 >
                   {seg}
                 </button>
               ))}
            </div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase">Toque para selecionar um ou mais. Vazio pesquisa todos.</p>
          </div>

          <div className="flex flex-col gap-2.5 sm:gap-3">
             <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-2 gap-2">
               <label className="font-mono font-bold uppercase text-xs sm:text-sm tracking-widest text-zinc-950 flex items-center gap-2">
                <Settings size={18} strokeWidth={3} className="shrink-0" /> 3. Aplicações ({applications.length || 'Todas'})
              </label>
              {applications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setApplications([])}
                  className="text-[10px] font-mono font-black uppercase bg-zinc-200 px-2 py-0.5 border border-zinc-950"
                >
                  Limpar
                </button>
              )}
            </div>
            
            <div className="max-h-52 sm:max-h-60 overflow-y-auto border-3 md:border-4 border-zinc-950 bg-white p-2.5 flex flex-col gap-4 custom-scrollbar">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Aplicações do Sal</span>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {APLICACOES_SAL.map(app => (
                    <button
                      key={app}
                      type="button"
                      onClick={() => toggleSelection(app, applications, setApplications)}
                      className={`min-h-[36px] text-xs font-mono font-bold px-3 py-1.5 border-2 uppercase transition-all text-left ${
                        applications.includes(app) 
                          ? 'bg-[#E5FF00] text-zinc-950 border-zinc-950' 
                          : 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:border-zinc-950'
                      }`}
                    >
                      {app}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configurações Finais */}
        <div className="flex flex-col gap-3 bg-zinc-200/50 p-3.5 sm:p-4 border-3 md:border-4 border-zinc-950">
           <label className="font-mono font-bold uppercase text-xs sm:text-sm tracking-widest text-zinc-950 flex items-center gap-2 mb-1">
            <Layers size={18} strokeWidth={3} className="shrink-0" /> 4. Parâmetros da Busca
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
             <div className="flex items-center bg-white border-3 md:border-4 border-zinc-950 min-h-[48px]">
               <span className="font-mono font-bold text-xs uppercase px-3 sm:px-4 border-r-3 md:border-r-4 border-zinc-950 bg-zinc-100 py-3 w-28 sm:w-1/3 shrink-0">Porte</span>
               <select 
                 value={companySize} 
                 onChange={(e) => setCompanySize(e.target.value)}
                 className="w-full font-bold font-mono text-xs sm:text-sm uppercase px-3 sm:px-4 py-2.5 outline-none cursor-pointer bg-white"
                >
                 {['Todas', 'Microempresa', 'Pequena', 'Média', 'Grande', 'Multinacional'].map(s => (
                   <option key={s} value={s}>{s}</option>
                 ))}
               </select>
             </div>
             <div className="flex items-center bg-white border-3 md:border-4 border-zinc-950 min-h-[48px]">
               <span className="font-mono font-bold text-xs uppercase px-3 sm:px-4 border-r-3 md:border-r-4 border-zinc-950 bg-zinc-100 py-3 w-28 sm:w-1/3 shrink-0">Qtd. Leads</span>
               <select 
                 value={quantity} 
                 onChange={(e) => setQuantity(Number(e.target.value))}
                 className="w-full font-bold font-mono text-xs sm:text-sm uppercase px-3 sm:px-4 py-2.5 outline-none cursor-pointer bg-white"
                >
                 {[10, 25, 50, 100, 200, 500].map(s => (
                   <option key={s} value={s}>{s} leads</option>
                 ))}
               </select>
             </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-zinc-950 text-[#E5FF00] font-black text-base sm:text-xl md:text-2xl uppercase tracking-wider border-4 border-zinc-950 py-3.5 px-6 md:py-4 md:px-10 shadow-[5px_5px_0_0_#E5FF00] md:shadow-[8px_8px_0_0_#E5FF00] hover:shadow-none hover:translate-y-1 hover:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[60px] md:h-[76px] flex items-center justify-center gap-3 md:gap-4 group cursor-pointer mt-1"
        >
          {isLoading ? (
            <span className="font-mono text-sm sm:text-lg tracking-widest animate-pulse">MINERANDO INDÚSTRIAS...</span>
          ) : (
            <>
              <span>Extrair Leads Industriais</span>
              <Search strokeWidth={4} size={24} className="group-hover:rotate-12 transition-transform shrink-0" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
