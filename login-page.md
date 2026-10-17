# Login Page & Proteção de Sessão (LeadCore)

## Goal
Implementar a página de login (`/login`) com estética Neo-Brutalista Industrial do LeadCore, autenticação via Supabase Auth (provisionamento exclusivo via banco de dados) e proteção de sessão com logout no painel principal.

## Tasks
- [x] Task 1: Criar utilitários de autenticação em `src/lib/auth.ts` integrados ao cliente `supabase` (`signInOperator`, `signOutOperator`, `getOperatorSession` e tradução segura de erros) → Verify: `npx tsc --noEmit` sem erros de tipagem.
- [x] Task 2: Construir `src/app/login/page.tsx` com layout Neo-Brutalista assimétrico em camadas (Pure Tailwind, geometria `0px`, paleta `#E5FF00` / `#18181B`, aviso de provisionamento exclusivo via banco) → Verify: Rota `/login` renderiza formulário acessível com estados de loading, erro e redirecionamento.
- [x] Task 3: Adicionar guarda de autenticação e botão de Logout com identificação do operador em `src/app/page.tsx` → Verify: Usuários não autenticados em `/` são redirecionados para `/login` e o botão "Sair" encerra a sessão.
- [x] Task 4: Executar validações de código e auditoria (`npm run lint`, `npx tsc --noEmit`, `ux_audit.py`, `accessibility_checker.py`, `security_scan.py`) → Verify: Zero erros críticos.

## Done When
- [x] Página `/login` funcional com Supabase Auth (E-mail + Senha) e sem cadastro público.
- [x] Painel principal (`/`) protegido por sessão ativa e com botão de Logout funcional.
- [x] Design 100% alinhado ao sistema Neo-Brutalista do LeadCore e aprovado no typecheck/lint.
