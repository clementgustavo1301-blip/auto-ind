import { Lead } from '../types';
import { Globe, Instagram, MessageCircle, MapPin, ArrowUpRight, Search } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  index: number;
}

export function LeadCard({ lead, index }: LeadCardProps) {
  return (
    <article className="group relative bg-white border-4 border-zinc-950 p-6 md:p-8 hover:bg-zinc-50 transition-colors shadow-[8px_8px_0_0_#18181B]">
      {/* Brutalist Corner Motif */}
      <div className="absolute top-0 right-0 w-14 h-14 border-l-4 border-b-4 border-zinc-950 flex items-center justify-center bg-[#E5FF00] font-black text-2xl">
        {String(index).padStart(2, '0')}
      </div>
      
      <div className="flex flex-col h-full gap-6 pr-10">
        <header>
          <h3 className="text-3xl font-black uppercase mb-3 text-zinc-950 leading-none">
            {lead.name}
          </h3>
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-zinc-600 bg-zinc-100 inline-block px-3 py-1 border-2 border-zinc-950">
            {lead.category}
          </p>
        </header>

        <div className="flex flex-col gap-2 font-mono text-base border-l-4 border-[#E5FF00] pl-4">
          <div className="flex items-center gap-3 text-zinc-800 font-bold uppercase tracking-wide">
            <MapPin size={20} strokeWidth={3} className="shrink-0" />
            <span>{lead.city}, {lead.country}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-auto pt-6 border-t-4 border-zinc-950">
          {lead.website ? (
            <a 
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 min-w-[140px] flex items-center justify-center gap-3 py-3 px-4 bg-zinc-950 text-white font-black uppercase text-base border-4 border-zinc-950 hover:bg-[#E5FF00] hover:text-zinc-950 transition-all shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
            >
              <Globe size={20} strokeWidth={2.5} />
              Website <ArrowUpRight size={18} strokeWidth={3} />
            </a>
          ) : (
             <div className="flex-1 min-w-[140px] flex items-center justify-center gap-3 py-3 px-4 bg-zinc-100 text-zinc-400 font-black uppercase text-base border-4 border-zinc-200 cursor-not-allowed border-dashed">
                <Globe size={20} strokeWidth={2.5} />
                No URL
             </div>
          )}

          <div className="flex gap-4">
            {lead.instagram ? (
              <a 
                href={
                  lead.instagram.match(/^https?:\/\//) 
                    ? lead.instagram 
                    : lead.instagram.includes('instagram.com') 
                      ? `https://${lead.instagram.replace(/^\/\//, '')}` 
                      : `https://instagram.com/${lead.instagram.replace(/^@/, '').replace(/^\//, '').split(/[?/]/)[0]}`
                }
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center w-14 h-14 bg-zinc-50 text-zinc-950 border-4 border-zinc-950 hover:bg-[#ff0066] hover:text-white transition-all shadow-[4px_4px_0_0_#18181B] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                title={`Instagram: ${lead.instagram}`}
              >
                <Instagram size={24} strokeWidth={2.5} />
              </a>
            ) : (
              <a 
                href={`https://www.google.com/search?q=${encodeURIComponent(lead.name + ' ' + lead.city + ' instagram')}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center w-14 h-14 bg-[#ff0066]/10 text-[#ff0066] border-4 border-[#ff0066] hover:bg-[#ff0066] hover:text-white transition-all shadow-[4px_4px_0_0_#cc0052] hover:shadow-none hover:translate-x-1 hover:translate-y-1 relative"
                title="Buscar Instagram no Google"
              >
                <Instagram size={20} strokeWidth={2.5} />
                <Search size={12} strokeWidth={3} className="absolute -bottom-1 -right-1 bg-[#ff0066] text-white rounded-full p-0.5" />
              </a>
            )}

            {lead.whatsapp ? (
              <a 
                href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center w-14 h-14 bg-zinc-50 text-zinc-950 border-4 border-zinc-950 hover:bg-[#25D366] hover:text-white transition-all shadow-[4px_4px_0_0_#18181B] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                title="WhatsApp"
              >
                <MessageCircle size={24} strokeWidth={2.5} />
              </a>
            ) : (
               <div className="flex items-center justify-center w-14 h-14 bg-zinc-50 text-zinc-300 border-4 border-zinc-300 cursor-not-allowed border-dashed">
                <MessageCircle size={24} />
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
