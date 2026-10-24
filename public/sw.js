// Service Worker do LeadCore - Notificações Push e Pop-up Mobile de Leads Qualificados
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function buildNotificationOptions(payload) {
  const company = payload.company_name || 'Novo Lead';
  const phone = payload.phone || '';
  const city = payload.city || '';
  const segment = payload.segment || '';
  const notes = payload.notes || 'Lead qualificado e pronto para atendimento humano!';
  const cleanDigits = String(phone).replace(/\D/g, '');
  const whatsappUrl = cleanDigits ? `https://wa.me/${cleanDigits}` : '/?tab=automation';
  const appUrl = `/?tab=automation&qualifiedPhone=${encodeURIComponent(phone)}`;

  const locationPart = [segment, city].filter(Boolean).join(' • ');
  const bodyLines = [
    locationPart ? `📍 ${locationPart}` : '',
    notes ? `💬 ${notes}` : '',
    phone ? `📱 ${phone}` : ''
  ].filter(Boolean);

  return {
    title: `🔥 LEAD QUALIFICADO: ${company}`,
    options: {
      body: bodyLines.join('\n') || 'Lead pronto para fechamento no Piloto Automático!',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `qualified-lead-${cleanDigits || Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [250, 100, 250, 100, 400],
      data: {
        url: appUrl,
        whatsappUrl,
        phone,
        company_name: company,
        city,
        segment,
        notes,
        timestamp: payload.timestamp || new Date().toISOString()
      },
      actions: [
        {
          action: 'open_panel',
          title: '🤖 Ver no Piloto Automático'
        },
        {
          action: 'open_whatsapp',
          title: '💬 Abrir WhatsApp'
        }
      ]
    }
  };
}

// 1. Escuta Web Push vindo do servidor (funciona com o navegador/celular em 2º plano ou tela bloqueada)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      company_name: 'Lead Qualificado',
      notes: event.data ? event.data.text() : 'Um lead acabou de ser qualificado pela IA!'
    };
  }

  const { title, options } = buildNotificationOptions(payload);

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Avisa clientes abertos para exibir o Pop-up interno imediatamente
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: 'LEAD_QUALIFIED_PUSH',
          payload: options.data
        });
      }
    })()
  );
});

// 2. Escuta comando direto da página aberta (fallback local imediato via Service Worker)
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_QUALIFIED_NOTIFICATION') return;
  const payload = event.data.payload || {};
  const { title, options } = buildNotificationOptions(payload);

  event.waitUntil(self.registration.showNotification(title, options));
});

// 3. Ação ao tocar na notificação na barra do celular
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = event.action === 'open_whatsapp' && data.whatsappUrl
    ? data.whatsappUrl
    : (data.url || '/?tab=automation');

  if (event.action === 'open_whatsapp' && data.whatsappUrl) {
    event.waitUntil(self.clients.openWindow(data.whatsappUrl));
    return;
  }

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'OPEN_QUALIFIED_LEAD',
            payload: data
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
