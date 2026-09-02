import { IndustrialLead } from '@/types';
import { Building2, MapPin, Globe, Phone, Info, Zap, Settings, Activity } from 'lucide-react';

interface IndustrialLeadCardProps {
  lead: IndustrialLead;
  index: number;
}

export function IndustrialLeadCard({ lead, index }: IndustrialLeadCardProps) {
  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'Alto': return 'bg-green-500 border-green-700 text-white shadow-[4px_4px_0_0_#166534]';
      case 'Médio': return 'bg-yellow-400 border-yellow-600 text-yellow-950 shadow-[4px_4px_0_0_#ca8a04]';
      case 'Baixo': return 'bg-red-500 border-red-700 text-white shadow-[4px_4px_0_0_#991b1b]';
      default: return 'bg-zinc-200 border-zinc-400 text-zinc-800 shadow-[4px_4px_0_0_#a1a1aa]';
    }
  };

  return (
    <div className="bg-white border-4 border-zinc-950 p-6 flex flex-col justify-between shadow-[8px_8px_0_0_#18181B] hover:shadow-[12px_12px_0_0_#18181B] transition-shadow relative">
      <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#E5FF00] border-4 border-zinc-950 flex items-center justify-center font-black font-mono text-xl shadow-[4px_4px_0_0_#18181B]">
        {index}
      </div>
      
      {/* Indicador de Potencial */}
      <div className="absolute -top-4 right-4 flex items-center gap-2">
         <div className={`px-4 py-1.5 border-4 font-black font-mono text-sm uppercase flex items-center gap-2 ${getPotentialColor(lead.consumptionPotential)}`}>
           <Activity size={16} strokeWidth={3} />
           {lead.consumptionPotential} POTENCIAL
         </div>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        <div>
          <h3 className="text-2xl font-black uppercase text-zinc-950 mb-1 leading-tight break-words pr-8">
            {lead.name}
          </h3>
          {lead.razaoSocial && (
            <div className="text-xs font-mono text-zinc-500 uppercase mb-2">
              {lead.razaoSocial}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold uppercase text-zinc-600">
              <Building2 size={12} strokeWidth={3} /> {lead.category}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 border-2 border-zinc-950 text-xs font-mono font-bold uppercase text-zinc-600">
              <MapPin size={12} strokeWidth={3} /> {lead.city}, {lead.country}
            </span>
          </div>
        </div>

        {/* Score & Justificativa */}
        <div className="border-l-4 border-zinc-950 pl-4 py-1 bg-zinc-50 flex flex-col gap-2">
           <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-black uppercase text-zinc-500 tracking-widest">Industry Score</span>
              <span className="font-mono text-lg font-black">{lead.score}/100</span>
           </div>
           
           <p className="text-xs font-mono text-zinc-700 italic border-t-2 border-zinc-200 pt-2">
             "{lead.justification}"
           </p>
        </div>

        {/* Dados Receita Federal (Brasil API) */}
        {lead.cnpj && (
          <div className="flex flex-col gap-1 mt-2 border-2 border-purple-200 p-3 bg-purple-50 relative">
            <div className="absolute top-0 right-0 bg-purple-200 text-purple-800 text-[9px] font-black uppercase px-2 py-0.5">
              Receita Federal
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-purple-600 w-12">CNPJ:</span>
              <span className="text-xs font-mono font-bold text-purple-900">{lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</span>
            </div>
            {lead.cnae && (
              <div className="flex items-start gap-2 mt-1 border-t border-purple-200 pt-1">
                <span className="text-[10px] font-black uppercase text-purple-600 w-12 mt-0.5">CNAE:</span>
                <span className="text-xs font-mono font-bold text-purple-900 leading-tight">{lead.cnae}</span>
              </div>
            )}
            {lead.porteReceita && (
              <div className="flex items-center gap-2 mt-1 border-t border-purple-200 pt-1">
                <span className="text-[10px] font-black uppercase text-purple-600 w-12">PORTE:</span>
                <span className="text-xs font-mono font-bold text-purple-900">{lead.porteReceita}</span>
              </div>
            )}
          </div>
        )}

        {/* Aplicações Prováveis */}
        {(lead.expectedApplications?.length > 0 || lead.expectedSaltTypes?.length > 0) && (
          <div className="flex flex-col gap-2 mt-2 border-2 border-zinc-200 p-3 bg-white">
            {lead.expectedApplications?.length > 0 && (
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Provável Aplicação</span>
                <div className="flex flex-wrap gap-1">
                  {lead.expectedApplications.map(app => (
                     <span key={app} className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-900 uppercase">
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
      <div className="grid grid-cols-2 gap-3 mt-6 border-t-4 border-zinc-950 pt-4">
        {lead.whatsapp ? (
          <a
            href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-black uppercase py-2 px-3 text-sm border-2 border-zinc-950 hover:shadow-[4px_4px_0_0_#18181B] hover:-translate-y-1 transition-all"
          >
            <Phone size={16} strokeWidth={3} /> WhatsApp
          </a>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-400 font-bold uppercase py-2 px-3 text-sm border-2 border-zinc-300">
            <Phone size={16} strokeWidth={3} /> S/ Whats
          </div>
        )}

        {lead.website ? (
          <a
            href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-zinc-950 text-white font-black uppercase py-2 px-3 text-sm border-2 border-zinc-950 hover:text-[#E5FF00] hover:shadow-[4px_4px_0_0_#E5FF00] hover:-translate-y-1 transition-all"
          >
            <Globe size={16} strokeWidth={3} /> Site
          </a>
        ) : (
           <div className="flex items-center justify-center gap-2 bg-red-100 text-red-600 font-bold uppercase py-2 px-3 text-sm border-2 border-red-600">
            <Globe size={16} strokeWidth={3} /> S/ Site
          </div>
        )}
      </div>
    </div>
  );
}
