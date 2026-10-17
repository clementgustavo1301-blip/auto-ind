# Neo-Brutalist UI Motion Design & 30s Promo Video Studio

## Goal
Implementar todas as micro-interações Neo-Brutalistas (Parte 1) na interface real de campanha WhatsApp e construir um Player/Studio Interativo de Motion Graphics de 30 segundos (Parte 2) com Framer Motion e Sound Design via Web Audio API.

## Tasks
- [ ] Task 1: Instalar `framer-motion` no projeto (`npm install framer-motion`) → Verify: `package.json` contém `framer-motion` sem erros.
- [ ] Task 2: Criar sintetizador de áudio Neo-Brutalista em `src/lib/sound-effects.ts` (cliques mecânicos, digitação humana variável, onda de choque e notificação de enviado) → Verify: Funções exportadas sem dependências de arquivos externos.
- [ ] Task 3: Adicionar utilitários de curva mecânica `cubic-bezier(0.22, 1, 0.36, 1)`, animação de cursor piscante de `500ms`, onda sinusoidal de `150ms` e pulso de borda de `1.2s` em `src/app/globals.css` → Verify: Classes CSS compilam no Tailwind v4.
- [ ] Task 4: Implementar Micro-interações da Parte 1 em `src/components/WhatsAppCampaignPanel.tsx` (clique físico `translate(4px, 4px)` com colapso de sombra, transição de cartões da fila com scale bounce `1.0 → 1.08 → 1.0`, flash amarelo nos modelos, salto de variáveis com contador odometer e simulador Live WhatsApp Preview) → Verify: Interações respondem entre 150ms e 250ms.
- [ ] Task 5: Criar o componente `src/components/PromoVideoStudio.tsx` reproduzindo as 4 cenas do Storyboard de 30 segundos (00:00–00:30) com câmera 3D isométrica, cascata de 50ms, glitch de variáveis e áudio sincronizado → Verify: Player executa as 4 cenas em 30s com controles de timeline e tela cheia.
- [ ] Task 6: Validar TypeScript e Lint (`npm run lint && npx tsc --noEmit`) → Verify: Zero erros de compilação ou tipagem.

## Done When
- [ ] Todas as micro-interações da Parte 1 funcionam na aba WhatsApp com feedback tátil e sonoro.
- [ ] O Studio do Vídeo Promocional de 30s (Parte 2) pode ser reproduzido em tempo real com as 4 cenas completas.
- [ ] Build/TypeScript e Linter passam sem erros.
