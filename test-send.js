/**
 * Script de Teste Rápido de Fila e Digitação Humanizada
 * Execução: node test-send.js [numero_opcional]
 */

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:5001';

async function main() {
  const targetPhone = process.argv[2] || '5511999998888';

  console.log('='.repeat(70));
  console.log('🧪 TESTE DE DISPARO SEQUENCIAL COM FILA INTELIGENTE E ANTI-BAN');
  console.log('='.repeat(70));
  console.log(`📡 URL do Microserviço: ${SERVICE_URL}`);
  console.log(`📱 Telefone de Teste:   ${targetPhone}\n`);

  // 1. Verificar Status do Microserviço
  try {
    const statusRes = await fetch(`${SERVICE_URL}/api/status`);
    if (!statusRes.ok) {
      throw new Error(`Status HTTP ${statusRes.status}`);
    }
    const statusData = await statusRes.json();
    console.log('📊 Status Atual do WhatsApp:');
    console.log(`   - Conectado:       ${statusData.connected ? '✅ Sim' : '❌ Não'}`);
    console.log(`   - Autenticado:     ${statusData.logged_in ? '✅ Sim' : '⚠️ Não (QR pendente)'}`);
    console.log(`   - Disparos hoje:   ${statusData.sent_today} / ${statusData.daily_limit}`);
    console.log(`   - Limite atingido: ${statusData.limit_reached ? '⚠️ SIM' : '🟢 Não'}`);
    const queueLen = statusData.queue_length ?? (Array.isArray(statusData.queue) ? statusData.queue.length : 0);
    console.log(`   - Fila atual:      ${queueLen} mensagem(ns)\n`);

    if (!statusData.logged_in) {
      console.log('⚠️ AVISO: O cliente WhatsApp ainda não foi autenticado.');
      console.log(`👉 Abra no navegador: ${SERVICE_URL}/api/qr para ler o QR Code.\n`);
    }
  } catch (err) {
    console.error('❌ Não foi possível conectar ao microserviço em Go.');
    console.error('👉 Certifique-se de executar o microserviço primeiro:');
    console.error('   cd whatsapp-service && .\\start.bat\n');
    process.exit(1);
  }

  // 2. Enviar Mensagem 1
  console.log('📤 [1/2] Disparando Mensagem #1...');
  const msg1Res = await fetch(`${SERVICE_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: targetPhone,
      message: 'Olá! Esta é a primeira mensagem de teste com digitação humanizada do Whatsmeow.',
    }),
  });
  const msg1Data = await msg1Res.json();
  console.log(`   Resposta:`, msg1Data);

  // 3. Enviar Mensagem 2 imediatamente a seguir (para testar a fila e o espaçamento anti-ban)
  console.log('\n📤 [2/2] Disparando Mensagem #2 imediatamente em seguida...');
  const msg2Res = await fetch(`${SERVICE_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: targetPhone,
      message: 'Olá novamente! Esta é a segunda mensagem que deve aguardar o intervalo anti-ban.',
    }),
  });
  const msg2Data = await msg2Res.json();
  console.log(`   Resposta:`, msg2Data);

  // 4. Acompanhar a fila em tempo real (Polling por 30 segundos)
  console.log('\n👀 Monitorando status da fila em tempo real (Ctrl+C para sair):');
  let cycles = 0;
  const interval = setInterval(async () => {
    cycles++;
    try {
      const qRes = await fetch(`${SERVICE_URL}/api/queue`);
      const qData = await qRes.json();
      const queue = Array.isArray(qData) ? qData : (qData.queue || []);

      const relevant = queue.filter(
        (m) => m.id === msg1Data.queue_id || m.id === msg2Data.queue_id
      );

      console.log(`\n⏱️ [Ciclo ${cycles}] Estado das mensagens:`);
      for (const item of relevant) {
        const icon =
          item.status === 'sent'
            ? '✅ SENT'
            : item.status === 'typing'
            ? '✍️ TYPING'
            : item.status === 'queued'
            ? '⏳ QUEUED'
            : item.status === 'limit_reached'
            ? '🛑 LIMIT_REACHED'
            : `❌ ${item.status.toUpperCase()}`;

        console.log(`   - [${item.id}] Status: ${icon} | Destino: ${item.phone} ${item.error ? `(Erro: ${item.error})` : ''}`);
      }

      const allDone = relevant.every((m) => m.status === 'sent' || m.status === 'failed' || m.status === 'limit_reached');
      if (allDone && relevant.length >= 2) {
        console.log('\n🎉 Todas as mensagens de teste foram processadas pela fila!');
        clearInterval(interval);
      }
    } catch (e) {
      console.error('Erro ao consultar fila:', e.message);
    }

    if (cycles >= 30) {
      console.log('\n⌛ Fim do monitoramento de teste. A fila continua ativa no microserviço.');
      clearInterval(interval);
    }
  }, 3000);
}

main().catch(console.error);
