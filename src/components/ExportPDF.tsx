'use client';

import jsPDF from 'jspdf';
import { Lead } from '@/types';
import { FileDown } from 'lucide-react';

interface ExportPDFProps {
  leads: Lead[];
  searchParams: { category: string; city: string; country: string };
}

export function ExportPDF({ leads, searchParams }: ExportPDFProps) {
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // ==================== HEADER ====================
    doc.setFillColor(24, 24, 27); // zinc-950
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(229, 255, 0); // #E5FF00
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('LEAD GENERATION REPORT', 14, 18);

    doc.setTextColor(161, 161, 170); // zinc-400
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${searchParams.category.toUpperCase()} // ${searchParams.city.toUpperCase()}, ${searchParams.country.toUpperCase()}`, 14, 28);
    doc.text(`${new Date().toLocaleDateString('pt-BR')} - ${leads.length} leads extraidos`, 14, 34);

    y = 50;

    // ==================== LEADS ====================
    leads.forEach((lead, index) => {
      // Checa se precisa de nova página
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      const boxHeight = 42;

      // Background do card
      doc.setFillColor(245, 245, 245); // zinc-100
      doc.rect(14, y, pageWidth - 28, boxHeight, 'F');

      // Barra lateral amarela
      doc.setFillColor(229, 255, 0); // #E5FF00
      doc.rect(14, y, 4, boxHeight, 'F');

      // Número do lead
      doc.setFillColor(24, 24, 27);
      doc.rect(pageWidth - 28, y, 14, 14, 'F');
      doc.setTextColor(229, 255, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(index + 1).padStart(2, '0'), pageWidth - 24, y + 10);

      // Nome
      doc.setTextColor(24, 24, 27);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(lead.name.toUpperCase(), 22, y + 10);

      // Categoria + localidade
      doc.setTextColor(113, 113, 122); // zinc-500
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${lead.category} — ${lead.city}, ${lead.country}`, 22, y + 17);

      // Linha divisória
      doc.setDrawColor(212, 212, 216);
      doc.line(22, y + 21, pageWidth - 18, y + 21);

      // --- Contatos clicáveis ---
      let contactX = 22;
      const contactY = y + 30;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      // WhatsApp
      if (lead.whatsapp) {
        const cleanNumber = lead.whatsapp.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanNumber}`;

        doc.setTextColor(37, 211, 102); // Verde WhatsApp
        doc.text('WPP:', contactX, contactY);
        contactX += 12;

        doc.setTextColor(24, 24, 27);
        doc.textWithLink(lead.whatsapp, contactX, contactY, { url: whatsappUrl });
        contactX += doc.getTextWidth(lead.whatsapp) + 4;

        // Botão visual para o WhatsApp
        const btnWidth = 30;
        const btnHeight = 6;
        const btnY = contactY - 4.5;
        
        doc.setFillColor(37, 211, 102); // Verde WhatsApp
        doc.rect(contactX, btnY, btnWidth, btnHeight, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.text('ABRIR CONVERSA', contactX + 3.5, contactY - 0.5);
        
        // Torna a área do botão clicável
        doc.link(contactX, btnY, btnWidth, btnHeight, { url: whatsappUrl });
        
        doc.setFontSize(9); // Restaura o tamanho da fonte
        contactX += btnWidth + 8;
      }

      // Instagram
      if (lead.instagram) {
        let instaUrl = lead.instagram;
        let instaHandle = lead.instagram;

        if (lead.instagram.match(/^https?:\/\//)) {
          instaUrl = lead.instagram;
          instaHandle = lead.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
        } else if (lead.instagram.includes('instagram.com')) {
          instaUrl = `https://${lead.instagram.replace(/^\/\//, '')}`;
          instaHandle = lead.instagram.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '').replace(/\/$/, '');
        } else {
          instaHandle = lead.instagram.replace(/^@/, '').replace(/^\//, '').split(/[?/]/)[0];
          instaUrl = `https://instagram.com/${instaHandle}`;
        }

        doc.setTextColor(255, 0, 102); // Rosa Instagram
        doc.text('IG:', contactX, contactY);
        contactX += 12;

        doc.setTextColor(24, 24, 27);
        const displayHandle = instaHandle.length > 20 ? instaHandle.slice(0, 20) + '...' : `@${instaHandle}`;
        doc.textWithLink(displayHandle, contactX, contactY, { url: instaUrl });
        contactX += doc.getTextWidth(displayHandle) + 10;
      } else {
        // Quando não tem Instagram, coloca link de busca
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(lead.name + ' ' + lead.city + ' instagram')}`;
        doc.setTextColor(255, 0, 102);
        doc.text('IG:', contactX, contactY);
        contactX += 12;

        doc.setTextColor(113, 113, 122);
        doc.textWithLink('[BUSCAR NO GOOGLE]', contactX, contactY, { url: searchUrl });
        contactX += doc.getTextWidth('[BUSCAR NO GOOGLE]') + 10;
      }

      // Website
      if (lead.website) {
        const siteUrl = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
        doc.setTextColor(59, 130, 246); // Azul
        doc.text('SITE:', contactX, contactY);
        contactX += 18;
        doc.setTextColor(24, 24, 27);
        const shortSite = lead.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30);
        doc.textWithLink(shortSite, contactX, contactY, { url: siteUrl });
      } else {
        doc.setTextColor(220, 38, 38); // Vermelho
        doc.text('SEM SITE', contactX, contactY);
        contactX += doc.getTextWidth('SEM SITE') + 4;
        doc.setTextColor(113, 113, 122);
        doc.setFontSize(7);
        doc.text('(OPORTUNIDADE)', contactX, contactY);
        doc.setFontSize(9);
      }

      y += boxHeight + 6;
    });

    // ==================== FOOTER ====================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(24, 24, 27);
      doc.rect(0, doc.internal.pageSize.getHeight() - 12, pageWidth, 12, 'F');
      doc.setTextColor(161, 161, 170);
      doc.setFontSize(7);
      doc.text(`LEAD GENERATOR // Pagina ${i} de ${totalPages}`, 14, doc.internal.pageSize.getHeight() - 4);
    }

    // Save file
    const filename = `leads_${searchParams.category}_${searchParams.city}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  return (
    <button
      onClick={generatePDF}
      disabled={leads.length === 0}
      className="w-full sm:w-auto min-h-[48px] bg-zinc-950 text-[#E5FF00] font-black text-xs sm:text-sm md:text-base uppercase tracking-wider border-3 md:border-4 border-zinc-950 py-3 px-5 md:py-3.5 md:px-6 shadow-[4px_4px_0_0_#E5FF00] md:shadow-[6px_6px_0_0_#E5FF00] hover:shadow-none active:translate-y-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer"
    >
      <FileDown size={20} strokeWidth={3} className="shrink-0" />
      <span>Exportar PDF</span>
    </button>
  );
}
