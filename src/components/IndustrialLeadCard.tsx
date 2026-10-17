import { IndustrialLead } from '@/types';
import { Building2, MapPin, Globe, Phone, Info, Zap, Settings, Activity } from 'lucide-react';

interface IndustrialLeadCardProps {
  lead: IndustrialLead;
  index: number;
}

export function IndustrialLeadCard({ lead, index }: IndustrialLeadCardProps) {
  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'Alto': return 'bg-green-500 border-green-700 text-white shadow-[3px_3px_0_0_#166534]';
      case 'Médio': return 'bg-yellow-400 border-yellow-600 text-yellow-950 shadow-[3px_3px_0_0_#ca8a04]';
      case 'Baixo': return 'bg-red-500 border-red-700 text-white shadow-[3px_3px_0_0_#991b1b]';
      default: return 'bg-zinc-200 border-zinc-400 text-zinc-800 shadow-[3px_3px_0_0_#a1a1aa]';
    }
  };

  return (
    <div className="bg-white border-4 border-zinc-950 p-4 sm:p-6 flex flex-col justify-between shadow-[5px_5px_0_0_#18181B] md:shadow-[8px_8px_0_0_#18181B] hover:shadow-[12px_12px_0_0_#18181B] transition-shadow relative mt-2 sm:mt-0">
      <div className="absolute -top-3.5 left-3 md:-top-4 md:-left-4 w-9 h-9 sm:w-10 sm:h-10 bg-[#E5FF00] border-3 md:border-4 border-zinc-950 flex items-center justify-center font-black font-mono text-base sm:text-xl shadow-[3px_3px_0_0_#18181B]">
        {index}
      </div>
      
      {/* Indicador de Potencial */}
      <div className="absolute -top-3.5 right-3 sm:-top-4 sm:right-4 flex items-center gap-2">
         <div className={`px-2.5 py-1 sm:px-4 sm:py-1.5 border-3 md:border-4 font-black font-mono text-xs sm:text-sm uppercase flex items-center gap-1.5 ${getPotentialColor(lead.consumptionPotential)}`}>
           <Activity size={14} strokeWidth={3} />
           {lead.consumptionPotential} POTENCIAL
         </div>
      </div>

      <div className="flex flex-col gap-3.5 sm:gap-4 mt-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black uppercase text-zinc-950 mb-1 leading-tight break-words">
            {lead.name}
          </h3>
          {lead.razaoSocial && (
            <div className="text-xs font-mono text-zinc-500 uppercase mb-2 break-words">
              {lead.razaoSocial}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 border-2 border-zinc-950 text-[11px] sm:text-xs font-mono font-bold uppercase text-zinc-600">
              <Building2 size={12} strokeWidth={3} className="shrink-0" /> {lead.category}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 border-2 border-zinc-950 text-[11px] sm:text-xs font-mono font-bold uppercase text-zinc-600">
              <MapPin size={12} strokeWidth={3} className="shrink-0" /> {lead.city}, {lead.country}
            </span>
          </div>
        </div>

        {/* Score & Justificativa */}
        <div className="border-l-4 border-zinc-950 pl-3.5 sm:pl-4 py-1.5 bg-zinc-50 flex flex-col gap-2">
           <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-black uppercase text-zinc-500 tracking-widest">Industry Score</span>
              <span className="font-mono text-base sm:text-lg font-black">{lead.score}/100</span>
           </div>
           
           <p className="text-xs font-mono text-zinc-700 italic border-t-2 border-zinc-200 pt-2">
             &quot;{lead.justification}&quot;
           </p>
        </div>

        {/* Dados Receita Federal (Brasil API) - Sem Roxo (Purple Ban) */}
        {lead.cnpj && (
          <div className="flex flex-col gap-1 mt-1 border-2 border-zinc-950 p-3 bg-amber-50/70 relative">
            <div className="absolute top-0 right-0 bg-zinc-950 text-[#E5FF00] text-[9px] font-black uppercase px-2 py-0.5">
              Receita Federal
            </div>
            <div className="flex items-center gap-2 pr-20">
              <span className="text-[10px] font-black uppercase text-zinc-600 w-12 shrink-0">CNPJ:</span>
              <span className="text-xs font-mono font-bold text-zinc-950">{lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>
            </div>
            {lead.cnae && (
              <div className="flex items-start gap-2 mt-1 border-t border-zinc-200 pt-1">
                <span className="text-[10px] font-black uppercase text-zinc-600 w-12 mt-0.5 shrink-0">CNAE:</span>
                <span className="text-xs font-mono font-bold text-zinc-900 leading-tight break-words">{lead.cnae}</span>
              </div>
            )}
            {lead.porteReceita && (
              <div className="flex items-center gap-2 mt-1 border-t border-zinc-200 pt-1">
                <span className="text-[10px] font-black uppercase text-zinc-600 w-12 shrink-0">PORTE:</span>
                <span className="text-xs font-mono font-bold text-zinc-900">{lead.porteReceita}</span>
              </div>
            )}
          </div>
        )}

        {/* Aplicações Prováveis */}
        {(lead.expectedApplications?.length > 0 || lead.expectedSaltTypes?.length > 0) && (
          <div className="flex flex-col gap-2 mt-1 border-2 border-zinc-200 p-3 bg-white">
            {lead.expectedApplications?.length > 0 && (
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Provável Aplicação</span>
                <div className="flex flex-wrap gap-1">
                  {lead.expectedApplications.map(app => (
                     <span key={app} className="text-[10px] font-mono font-bold px-2 py-0.5 bg-zinc-100 text-zinc-900 border border-zinc-950 uppercase">
                       {app}
                     </span>
                  ))}
                </div>
              </div>
            )}
            {lead.expectedSaltTypes?.length > 0 && (
              <div className="mt-1">
                <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Tipo de Produto</span>
                <div className="flex flex-wrap gap-1">
                  {lead.expectedSaltTypes.map(type => (
                     <span key={type} className="text-[10px] font-mono font-bold px-2 py-0.5 bg-yellow-100 text-yellow-900 border border-yellow-900 uppercase">
                       {type}
                     </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Contatos */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-5 sm:mt-6 border-t-4 border-zinc-950 pt-4">
        {lead.whatsapp ? (
          <a
            href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] flex items-center justify-center gap-2 bg-[#25D366] text-zinc-950 font-black uppercase py-2.5 px-3 text-xs sm:text-sm border-2 border-zinc-950 shadow-[3px_3px_0_0_#18181B] active:translate-y-0.5 transition-all"
          >
            <Phone size={16} strokeWidth={3} className="shrink-0" /> WhatsApp
          </a>
        ) : (
          <div className="min-h-[48px] flex items-center justify-center gap-2 bg-zinc-100 text-zinc-400 font-bold uppercase py-2.5 px-3 text-xs sm:text-sm border-2 border-zinc-300">
            <Phone size={16} strokeWidth={3} className="shrink-0" /> S/ Whats
          </div>
        )}

        {lead.website ? (
          <a
            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] flex items-center justify-center gap-2 bg-zinc-950 text-white font-black uppercase py-2.5 px-3 text-xs sm:text-sm border-2 border-zinc-950 hover:text-[#E5FF00] shadow-[3px_3px_0_0_#E5FF00] active:translate-y-0.5 transition-all"
          >
            <Globe size={16} strokeWidth={3} className="shrink-0" /> Site
          </a>
        ) : (
           <div className="min-h-[48px] flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold uppercase py-2.5 px-3 text-xs sm:text-sm border-2 border-red-600">
            <Globe size={16} strokeWidth={3} className="shrink-0" /> S/ Site
          </div>
        )}
      </div>
    </div>
  );
}
