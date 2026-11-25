# Tasks: Pontua — App PWA (Frontend)

**Input**: Design documents from `/specs/002-pontua-frontend-pwa/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-routes.md, quickstart.md
**API consumida**: `specs/001-pontua-backend-core/contracts/api.md` (não muda nesta feature)

**Tests**: a spec exige prova de offline sem duplicatas (SC-005) e acessibilidade AA em todas as
telas (SC-007); o plano (R-16) define testes Vitest + axe. Eles estão incluídos nas fases.

**Agentes (Princípio VIII)** — cada fase indica o agente executor:
- 🎨 `ux-designer`: `docs/design/` e imagens/ícones em `frontend/public/` (nunca `.tsx`).
- ⚛️ `frontend-react-developer`: todo o restante de `frontend/` (skills `react-architecture`,
  `react-modal`, `react-alert`).
- 🟣 `dotnet-senior-developer`: `docker-compose.yml` e `backend/Pontua.API/appsettings.Docker.json`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: história da spec (US1…US7)

## Path Conventions

`frontend/src/{types,Services,Contexts,hooks,components,pages,utils,i18n,test}` (casing do
Princípio III), `docs/design/` para o design. Todo texto de interface vai em
`frontend/src/i18n/pt-BR.json` (nunca string solta no JSX).

---

## Phase 1: Setup — Design e projeto

### 1a. Design 🎨 `ux-designer` (bloqueia as telas)

- [X] T001 Criar `docs/design/DESIGN_DIRECTION.md` com a direção visual do Pontua a partir de `docs/logomarca/logo.png` e `logo-transparente.png`: personalidade, paleta, tipografia (fonte web livre), iconografia (lucide), uso da logomarca, tom de voz dos textos, e princípios mobile-first (uso com uma mão, botão de ponto dominante)
- [X] T002 Criar `docs/design/tokens.css` com variáveis CSS (cores semânticas de fundo/superfície/texto/primária/sucesso/alerta/erro/pendente/foco, tipografia e escala, espaçamentos, raios, sombras, z-index, durações de animação com `prefers-reduced-motion`) e tabela de contraste no fim do arquivo comprovando AA (texto ≥ 4,5:1, texto grande/ícones ≥ 3:1) (depende de T001)
- [X] T003 Criar `docs/design/components.md` especificando, com estados (padrão, foco, pressionado, desabilitado, carregando, erro), os componentes do contrato `contracts/ui-routes.md`: AppShell (barra inferior < 1024 px, menu lateral ≥ 1024 px, seletor de empresa, contador), botão de ponto, ConfirmModal, PeriodFilter + modal avançado, PunchBadge (todos os tipos e status), DayCard, ScheduleEditor (semanal/diário, copiar de outro dia), formulários e erros por campo, toasts, OfflineBanner, StaleDataNotice, indicador de fila offline, UpdatePrompt, InstallAppButton (+ folha iOS), Empty/Error/Loading states (depende de T002)
- [X] T004 [P] Criar mockups HTML estáticos usando `../tokens.css` em `docs/design/screens/`: `login.html`, `welcome.html`, `clock.html` (dia útil, fora do dia útil, offline com fila), `history.html` (mês com manual pendente e filtro avançado aberto), `approvals.html`, `position-editor.html` (semanal e diário), `invite.html` (público e compartilhar), `members.html`, `settings.html` — cada um em 360 px e 1280 px (depende de T003)
- [X] T005 [P] Gerar a partir da logomarca, em `frontend/public/`: `icon-any-192.png`, `icon-any-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png` (zona segura 80%), `apple-touch-icon.png` (180), `favicon.svg`/`favicon.ico`, `logo.svg` (ou PNG otimizado) e `og-image.png`; documentar a cor de tema e de fundo do manifest em `docs/design/DESIGN_DIRECTION.md` (depende de T002)

### 1b. Projeto ⚛️ `frontend-react-developer`

- [X] T006 Criar o projeto Vite React + TypeScript em `frontend/` (`package.json` com scripts `dev`, `build` = `tsc -b && vite build`, `preview`, `lint`, `test`, `test:watch`), `tsconfig.json`/`tsconfig.app.json`/`tsconfig.node.json` em modo `strict`, `eslint.config.js` (typescript-eslint, react-hooks, react-refresh), `index.html` com `lang="pt-BR"` e meta viewport sem bloquear zoom
- [X] T007 Instalar dependências de `plan.md` › Technical Context (React 18, React Router 6, Tailwind 4 + `@tailwindcss/vite`, i18next 25 + react-i18next, vite-plugin-pwa, @radix-ui/react-dialog, sonner, lucide-react; dev: vitest, @testing-library/react/user-event/jest-dom, jsdom, vitest-axe, fake-indexeddb) em `frontend/package.json`
- [X] T008 Configurar `frontend/vite.config.ts`: plugins react + tailwind, proxy de dev `/api` e `/health` para `process.env.VITE_DEV_API_PROXY ?? "http://localhost:5080"`, bloco `test` (jsdom, `src/test/setup.ts`), e `VitePWA` conforme research R-14 (generateSW, `registerType: "prompt"`, `injectRegister: false`, precache da casca, `navigateFallback` com denylist `/api/`, `/health`, `/swagger`, manifest pt-BR com nome "Pontua", ícones de T005, cores de T002, atalho "Registrar ponto" → `/?acao=registrar`)
- [X] T009 [P] Criar `frontend/.env.example` (`VITE_API_URL=`, `VITE_SITE_BASENAME=`, `VITE_GOOGLE_CLIENT_ID=`, `VITE_DEV_API_PROXY=http://localhost:5080`), `frontend/src/vite-env.d.ts` tipando `import.meta.env` e garantir `.env.local` ignorado em `frontend/.gitignore`
- [X] T010 [P] Criar `frontend/src/index.css` importando Tailwind e mapeando em `@theme` as variáveis de `docs/design/tokens.css` (copiar os tokens para `frontend/src/styles/tokens.css` e importar), mais estilos base de foco visível e `prefers-reduced-motion` (depende de T002)
- [X] T011 [P] Criar `frontend/src/test/setup.ts` (jest-dom, `vitest-axe/extend-expect`, `fake-indexeddb/auto`, mock de `matchMedia`) e `frontend/src/test/fetchMock.ts` (helper para simular respostas da API, incluindo envelope de erro e header `Date`)

---

## Phase 2: Foundational ⚛️ `frontend-react-developer` (bloqueia as histórias)

**Purpose**: cliente HTTP, armazenamento local, conectividade, sessão base, i18n, utilitários de data, componentes compartilhados, shell e rotas com guards.

- [X] T012 [P] Criar todos os tipos de `data-model.md` §1 em `frontend/src/types/` (`auth.ts`, `company.ts`, `schedule.ts`, `position.ts`, `member.ts`, `invitation.ts`, `punch.ts`, `approval.ts`, `summary.ts`, `common.ts`) com `interface`, uniões de string para enums e JSDoc, conforme os DTOs de `specs/001-pontua-backend-core/contracts/api.md`
- [X] T013 [P] Configurar i18n em `frontend/src/i18n/index.ts` e `frontend/src/i18n/pt-BR.json` (namespaces por área: comum, auth, ponto, historico, aprovacoes, empresa, cargos, convites, membros, erros, pwa)
- [X] T014 [P] Criar utilitários em `frontend/src/utils/`: `dateTime.ts` (formatar data/hora no fuso da empresa via `Intl.DateTimeFormat('pt-BR', { timeZone })`, "hoje" no fuso, início/fim do mês, ISO com offset do aparelho, aplicar `serverOffset`), `duration.ts` (minutos ↔ `hh:mm`, saldo com sinal `+`/`−` sempre visível), `period.ts` (validar/normalizar `month`/`start`/`end`, máx. 366 dias)
- [X] T015 Criar `frontend/src/Services/offlineCache.ts` (IndexedDB `pontua-cache`, store `responses`, `get/set/clearUser/clearAll`, `schemaVersion`, no-op se o IndexedDB falhar) conforme research R-07
- [X] T016 Criar `frontend/src/Services/apiClient.ts` com `apiFetch<T>(path, { method, body, query, cache: "network-first" | "none", signal })`: base `VITE_API_URL`, token de `pontua:auth`, timeout 10 s, parse do envelope de erro para `ApiError(status, mensagem, erros)`, `ApiError(0, …)` em falha de rede, escrita bloqueada offline (exceto chamadas marcadas `allowOffline`), leitura do header `Date` para `serverOffset`, callbacks `onUnauthorized`/`onNetworkResult`, cache network-first com `stale`/`fetchedAt` (depende de T015)
- [X] T017 Criar `frontend/src/Contexts/ConnectivityContext.tsx` e `frontend/src/hooks/useConnectivity.ts` (status online/offline combinando `navigator.onLine`, eventos e resultados do `apiFetch`; banner só após 2 s; evento `reconnected`; `serverOffset`) (depende de T016)
- [X] T018 Criar `frontend/src/Services/authService.ts`, `frontend/src/Contexts/AuthContext.tsx` e `frontend/src/hooks/useAuth.ts` seguindo `react-architecture`: sessão em `localStorage` `pontua:auth` (`AUTH_STORAGE_KEY`), restauração com checagem de `expiresAt`, `register`, `login`, `loginWithGoogle(idToken)`, `logout` (limpa sessão, `pontua:company`, `offlineCache.clearUser`), `updateName`, `updatePassword`, logout automático no 401 com `pontua:returnTo` (depende de T016)
- [X] T019 Criar `frontend/src/Services/companyService.ts`, `frontend/src/Contexts/CompanyContext.tsx`, `frontend/src/hooks/useCompany.ts` e `frontend/src/hooks/useRole.ts`: lista de empresas, empresa ativa persistida em `pontua:company` (`{ userId, companyId }`), `CompanyInfo` + `members/me` da ativa, `selectCompany`, `createCompany`, `updateCompany`, `transferOwnership`, `refresh`; `useRole` → `{ isOwner, isManager, canSupervise }` (depende de T018)
- [X] T020 [P] Criar componentes base em `frontend/src/components/`: `Button.tsx`, `TextField.tsx` (label associado, erro com `aria-describedby`), `Select.tsx`, `Modal.tsx` (Radix Dialog, foco preso, `Esc`), `ConfirmModal.tsx`, `LoadingState.tsx`, `EmptyState.tsx`, `ErrorState.tsx` (com "Tentar de novo"), `StaleDataNotice.tsx`, `Toaster` (sonner com `aria-live`), seguindo `docs/design/components.md` (depende de T003, T010)
- [X] T021 Criar `frontend/src/components/PeriodFilter.tsx` e `frontend/src/hooks/usePeriodFilter.ts`: query da URL (`month` ou `start`/`end`), padrão mês corrente no fuso da empresa, ‹ › entre meses, modal "Filtro avançado" com início/fim validados (≤ 366 dias), valor inválido na URL → mês corrente (research R-09) (depende de T014, T020)
- [X] T022 Criar `frontend/src/components/AppShell.tsx` com `BottomNav.tsx` e `SideNav.tsx` (destinos e visibilidade por papel de `contracts/ui-routes.md`, contador de pendências vindo de prop/contexto), `CompanySwitcher.tsx`, `OfflineBanner.tsx` e área para `UpdatePrompt`/indicador de fila (depende de T017, T019, T020)
- [X] T023 Criar `frontend/src/routes.tsx`, `frontend/src/App.tsx` e `frontend/src/main.tsx`: React Router com rotas de `contracts/ui-routes.md` (páginas ainda como placeholders), guards `RequireAuth` (→ `/entrar` com `returnTo`), `RequireCompany` (→ `/bem-vindo`), `RequireRole` (→ `/` com toast), `basename` de `VITE_SITE_BASENAME`, providers registrados em `main.tsx` (depende de T018, T019, T022)
- [X] T024 [P] Testes em `frontend/src/Services/__tests__/apiClient.test.ts` e `offlineCache.test.ts`: envelope de erro → `ApiError` com erros por campo; 401 chama `onUnauthorized`; timeout de 10 s (timers falsos); escrita offline não chama `fetch`; network-first grava e devolve `stale` com `fetchedAt`; não-2xx não grava; isolamento por usuário; versão incompatível descartada; IndexedDB indisponível → no-op
- [X] T025 [P] Testes em `frontend/src/Contexts/__tests__/AuthContext.test.tsx`, `ConnectivityContext.test.tsx` e `frontend/src/hooks/__tests__/usePeriodFilter.test.tsx`: sessão expirada descartada, 401 limpa sessão/cache e guarda `returnTo`; banner só após 2 s e `reconnected`; filtro padrão, troca de mês, intervalo e URL inválida

**Checkpoint**: app sobe com shell, rotas protegidas e filtro de datas; testes de base passando.

---

## Phase 3: User Story 1 - Entrar no app e escolher a empresa (Priority: P1) 🎯 MVP

**Goal**: criar conta / entrar (e-mail ou Google), instalar o app, escolher a empresa ou ver "Bem-vindo".

**Independent Test**: criar conta, sair, entrar e trocar entre duas empresas com o nome da ativa sempre visível (quickstart passo 1).

- [X] T026 [P] [US1] Criar `frontend/src/components/GoogleSignInButton.tsx` carregando o script do Google Identity Services sob demanda, renderizando o botão oficial e devolvendo o ID token; não renderiza se `VITE_GOOGLE_CLIENT_ID` estiver vazio
- [X] T027 [US1] Criar `frontend/src/pages/LoginPage.tsx` e `frontend/src/pages/RegisterPage.tsx` (mockup `docs/design/screens/login.html`): validação por campo, erros da API em `erros[]` ligados aos campos, Google, link entre as duas, redirecionamento para `returnTo`/convite pendente/empresa (depende de T026)
- [X] T028 [P] [US1] Criar `frontend/src/pages/WelcomePage.tsx` (mockup `welcome.html`): "Criar empresa" e "Tenho um convite" (campo para colar o link e extrair o token)
- [X] T029 [P] [US1] Criar `frontend/src/pages/AccountPage.tsx`: editar nome, trocar/definir senha (campo atual só se `hasPassword`), botão sair com confirmação, item "Instalar app"
- [X] T030 [P] [US1] Criar `frontend/src/components/InstallAppButton.tsx` e `frontend/src/hooks/useInstallPrompt.ts` (`beforeinstallprompt`, detecção de instalado, folha com instruções no iOS, dispensa por 30 dias em `pontua:install-dismissed`) e `frontend/src/components/UpdatePrompt.tsx` (`virtual:pwa-register/react`, "Nova versão disponível — Atualizar")
- [X] T031 [P] [US1] Testes com axe em `frontend/src/pages/__tests__/LoginPage.test.tsx`, `RegisterPage.test.tsx`, `WelcomePage.test.tsx`, `AccountPage.test.tsx` (erros por campo, redirecionamentos, sem violações axe)

**Checkpoint**: entrada, conta e seleção de empresa funcionando.

---

## Phase 4: User Story 2 - Bater o ponto (Priority: P1)

**Goal**: tela principal com relógio, jornada do dia, próximo período, marcações de hoje, registro com confirmação e fila offline.

**Independent Test**: registrar 4 marcações online; ficar offline, registrar, voltar e ver a marcação "Offline · Pendente" sem duplicar (quickstart passo 4).

- [X] T032 [P] [US2] Criar `frontend/src/Services/punchService.ts` (`punch`, `syncOffline(items)`, `getMyDays(range)`, `getMemberDays`, `getPunch`, `createManual`, `cancel`) conforme a API
- [X] T033 [US2] Criar `frontend/src/Services/punchQueue.ts` (IndexedDB `pontua-queue`, store `punches`: `enqueue`, `listByState`, `markSending`, `remove`, `markRejected`, `resetStuckSending` > 1 min, `clearUser`) conforme `data-model.md` §3
- [X] T034 [US2] Criar `frontend/src/Contexts/PunchQueueContext.tsx` e `frontend/src/hooks/usePunchQueue.ts`: `flush` ao montar, no `reconnected`, a cada 30 s com itens e após respostas OK; lotes de até 50 por empresa em `POST /punches/offline`; `created`/`duplicate` removem, `future`/`too_old` marcam rejeitada com toast; contagem `waiting` e lista de rejeitadas (depende de T032, T033)
- [X] T035 [US2] Criar `frontend/src/Contexts/PunchContext.tsx` e `frontend/src/hooks/usePunch.ts`: `loadToday` (`GET punches/me` do dia, network-first), `punch()` online → `POST /punches`; offline ou falha de rede/timeout → `enqueue` (research R-06); 422 de "aguarde 1 minuto" vira mensagem amigável (depende de T032, T034)
- [X] T036 [P] [US2] Criar `frontend/src/components/PunchBadge.tsx`, `frontend/src/components/ClockFace.tsx` (hora corrigida por `serverOffset`, fuso da empresa, atualização por segundo sem anunciar a cada segundo ao leitor de tela) e `frontend/src/components/QueueIndicator.tsx` (aguardando envio + rejeitadas com motivo e "Dispensar")
- [X] T037 [US2] Criar `frontend/src/pages/ClockPage.tsx` (mockup `clock.html`): data/hora, jornada do dia com períodos previstos, "Próxima: …", marcações de hoje com `PunchBadge` ("Extra" quando sem período), aviso de dia não útil, botão principal → `ConfirmModal` → confirmação `aria-live` ("Entrada registrada às 08:02"), suporte a `?acao=registrar`, `StaleDataNotice` offline (depende de T035, T036)
- [X] T038 [P] [US2] Testes em `frontend/src/Services/__tests__/punchQueue.test.ts` e `frontend/src/Contexts/__tests__/PunchQueueContext.test.tsx`: enfileirar offline, envio em lote por empresa, `duplicate` remove sem duplicar, `future`/`too_old` rejeitam, falha de rede volta para `waiting`, `sending` travado volta na abertura, ~~logout limpa a fila do usuário~~ logout/401 **mantêm** a fila e só o usuário logado envia os seus itens (revisão — research R-07 › Atualização)
- [X] T039 [P] [US2] Teste com axe em `frontend/src/pages/__tests__/ClockPage.test.tsx` (registro online, dia não útil, offline enfileira, aviso de 1 minuto)

**Checkpoint**: MVP de produto — entrar e bater ponto, inclusive sem internet.

---

## Phase 5: User Story 3 - Configurar a empresa: criar empresa, cargos e jornadas (Priority: P1)

**Goal**: criar empresa; responsável cria/edita/exclui cargos com jornada semanal ou diária.

**Independent Test**: criar empresa, criar "Atendente" semanal e um cargo diário com sábado diferente, ver o resumo de cada jornada (quickstart passo 2).

- [X] T040 [US3] Criar `frontend/src/pages/NewCompanyPage.tsx` (nome, documento opcional, fuso com padrão `America/Sao_Paulo` e lista de fusos do Brasil) que cria a empresa, seleciona-a e abre `/`
- [X] T041 [P] [US3] Criar `frontend/src/Services/positionService.ts`, `frontend/src/Contexts/PositionContext.tsx` e `frontend/src/hooks/usePositions.ts` (`load`, `get`, `create`, `rename`, `saveSchedule`, `remove`)
- [X] T042 [US3] Criar `frontend/src/components/ScheduleEditor.tsx` (mockup `position-editor.html`): alternar semanal/diário, dias úteis, períodos com nome e horário opcional (adicionar, renomear, reordenar com botões acessíveis, remover), carga diária e semanal em `hh:mm`, "copiar de outro dia" no modo diário, data de início da vigência (não passada), validação no próprio campo (nenhum dia útil, horários fora de ordem, período sem nome, limites) e conversão para `ScheduleInput`
- [X] T043 [US3] Criar `frontend/src/components/ScheduleSummary.tsx` ("Seg–Sex · 4 marcações · 44 h/semana") e `frontend/src/pages/PositionsPage.tsx` (lista com membros ativos e resumo da jornada) e `frontend/src/pages/PositionEditorPage.tsx` (criar/editar nome e jornada, histórico de versões, excluir com explicação de 422/409 e sugestão de renomear) (depende de T041, T042)
- [X] T044 [US3] Criar `frontend/src/pages/CompanyPage.tsx` (hub "Empresa": informações para todos; atalhos Cargos, Convites, Membros, Configurações só para o responsável)
- [X] T045 [P] [US3] Testes com axe em `frontend/src/components/__tests__/ScheduleEditor.test.tsx` e `frontend/src/pages/__tests__/PositionEditorPage.test.tsx` (semanal → `ScheduleInput`, diário com cópia, validações, erro 409/422 da exclusão)

**Checkpoint**: responsável configura a empresa pelo app.

---

## Phase 6: User Story 4 - Convidar e entrar por convite (Priority: P1)

**Goal**: gerar/compartilhar/revogar convites; abrir o link, criar conta/entrar e aceitar automaticamente.

**Independent Test**: gerar convite, abrir em janela anônima, criar conta e registrar a primeira marcação (quickstart passo 3).

- [X] T046 [P] [US4] Criar `frontend/src/Services/invitationService.ts`, `frontend/src/Contexts/InvitationContext.tsx` e `frontend/src/hooks/useInvitations.ts` (`load(range, status)`, `create`, `revoke`, `getPublic(token)`, `accept(token)`)
- [X] T047 [US4] Criar `frontend/src/pages/InvitationsPage.tsx` (mockup `invite.html`): `PeriodFilter`, filtro de situação, lista com cargo, validade, aceites; "Novo convite" (cargo + validade 1–30 dias); "Compartilhar" via `navigator.share` com fallback "Copiar link" (`navigator.clipboard`) e toast; "Revogar" com `ConfirmModal` (depende de T046)
- [X] T048 [US4] Criar `frontend/src/pages/InvitePage.tsx` (rota pública `/convite/:token`): mostra "Você foi convidado para {empresa} como {cargo}" ou estado expirado/revogado/inexistente; sem sessão guarda `pontua:pendingInvite` e oferece criar conta/entrar; com sessão aceita, trata 409 (já membro) abrindo a empresa, seleciona a empresa e navega para `/` (depende de T046)
- [X] T049 [US4] Integrar o convite pendente em `frontend/src/Contexts/AuthContext.tsx`/`frontend/src/pages/LoginPage.tsx`/`RegisterPage.tsx`: após autenticar com `pontua:pendingInvite`, aceitar automaticamente e limpar a chave (research R-12)
- [X] T050 [P] [US4] Testes com axe em `frontend/src/pages/__tests__/InvitePage.test.tsx` e `InvitationsPage.test.tsx` (público válido/expirado, aceite pós-cadastro, 409, compartilhar/copiar, revogar)

**Checkpoint**: equipe entra pelo link e já bate ponto.

---

## Phase 7: User Story 5 - Histórico, resumo e marcação manual (Priority: P2)

**Goal**: histórico do período com totais e semanas, marcação manual e correção com justificativa, cancelamento, detalhe com análise.

**Independent Test**: incluir Saída esquecida de ontem → "Manual · Pendente", saldo inalterado; cancelar (quickstart passo 5).

- [X] T051 [P] [US5] Criar `frontend/src/Services/summaryService.ts` e `frontend/src/Contexts/HistoryContext.tsx` + `frontend/src/hooks/useHistory.ts` (`load(range, memberId?)` buscando dias e resumo em paralelo com network-first, `createManual`, `cancel`, `stale`/`fetchedAt`)
- [X] T052 [P] [US5] Criar `frontend/src/components/DayCard.tsx` (períodos previstos, marcações com `PunchBadge`, original e correção pendente lado a lado, trabalhado/previsto/saldo, destaque de dia útil sem marcação, "incompleto") e `frontend/src/components/SummaryHeader.tsx` (totais e semanas)
- [X] T053 [US5] Criar `frontend/src/components/ManualPunchModal.tsx`: modos "Incluir" e "Corrigir horário" (com a marcação original), data limitada a `max(hoje − manualRetroDays, data de entrada do membro)` até hoje, horário não futuro, justificativa 5–500 caracteres com contador, erros da API por campo (research R-13)
- [X] T054 [US5] Criar `frontend/src/pages/HistoryPage.tsx` (mockup `history.html`): `PeriodFilter`, `SummaryHeader`, lista de `DayCard`, ações por marcação (corrigir, cancelar pendente com `ConfirmModal`) e "Incluir marcação" por dia, `StaleDataNotice` (depende de T051–T053)
- [X] T055 [P] [US5] Criar `frontend/src/pages/PunchDetailPage.tsx`: dados da marcação, NSR, tipo, justificativa, histórico de status com quem/quando/motivo
- [X] T056 [P] [US5] Testes com axe em `frontend/src/components/__tests__/ManualPunchModal.test.tsx` e `frontend/src/pages/__tests__/HistoryPage.test.tsx` (limites de data incluindo entrada do membro, justificativa obrigatória, manual pendente não altera saldo exibido, cancelar, troca de mês e intervalo)

**Checkpoint**: membro acompanha e corrige o próprio ponto.

---

## Phase 8: User Story 6 - Painel de aprovações (Priority: P2)

**Goal**: painel por dia para responsável/gestor com aprovar/rejeitar por marcação e contador na navegação.

**Independent Test**: aprovar uma manual pendente e ver lista e contador atualizarem (quickstart passo 6).

- [X] T057 [P] [US6] Criar `frontend/src/Services/approvalService.ts`, `frontend/src/Contexts/ApprovalContext.tsx` e `frontend/src/hooks/useApprovals.ts`: `load(range, type, positionId)`, `approve(id, note?)`, `reject(id, note?)` com atualização otimista e reversão em erro, 409 → aviso e recarga; `pendingCount` pelos últimos 31 dias, atualizado ao entrar, ao trocar de empresa, após cada análise e a cada 2 min com a aba visível (research R-11)
- [X] T058 [US6] Criar `frontend/src/pages/ApprovalsPage.tsx` (mockup `approvals.html`): `PeriodFilter`, filtros de situação e cargo, dias decrescentes, membro com nome/cargo/situação e marcações do dia (tipo, horário, status, justificativa), botões Aprovar/Rejeitar (rejeitar abre modal com motivo opcional), sem botões nas próprias marcações de um gestor, estados vazio/erro (depende de T057)
- [X] T059 [US6] Ligar `pendingCount` ao `frontend/src/components/AppShell.tsx` (badge com texto acessível "3 pendências") só para quem pode aprovar (depende de T057)
- [X] T060 [P] [US6] Testes com axe em `frontend/src/pages/__tests__/ApprovalsPage.test.tsx` (aprovar atualiza lista e contador, rejeitar com motivo, 409 de já analisada, gestor sem botões nas próprias, membro comum sem acesso)

**Checkpoint**: ciclo marcação manual → aprovação completo no app.

---

## Phase 9: User Story 7 - Configurações: membros, gestores e transferência (Priority: P3)

**Goal**: gestão de membros, jornada própria, gestores, dados da empresa e transferência da responsabilidade.

**Independent Test**: designar gestor e transferir a responsabilidade; o antigo responsável perde as configurações (quickstart passo 7).

- [X] T061 [P] [US7] Criar `frontend/src/Services/memberService.ts`, `frontend/src/Contexts/MemberContext.tsx` e `frontend/src/hooks/useMembers.ts` (`load(status, positionId)`, `get`, `changePosition`, `setSchedule`, `clearSchedule`, `deactivate`, `reactivate`, `setManager`)
- [X] T062 [US7] Criar `frontend/src/pages/MembersPage.tsx` (mockup `members.html`): abas ativos/inativos, filtro por cargo, papel (responsável/gestor/membro) com texto além de ícone (depende de T061)
- [X] T063 [US7] Criar `frontend/src/pages/MemberDetailPage.tsx`: dados, cargo atual e histórico, jornada (do cargo ou própria) com `ScheduleEditor`/`ScheduleSummary`, histórico e resumo do período com `PeriodFilter` reutilizando `DayCard`/`SummaryHeader`; ações do responsável: trocar cargo com data, jornada própria / voltar à do cargo, desativar/reativar (bloqueio do responsável explicado), gestor com seleção de cargos (depende de T061, T042, T052)
- [X] T064 [US7] Criar `frontend/src/pages/CompanySettingsPage.tsx` (mockup `settings.html`): nome, documento, fuso, limite de dias para marcação manual (1–365) e seção "Transferir responsabilidade" com escolha do membro ativo e `ConfirmModal` explicando as consequências; após transferir, `CompanyContext.refresh()` e redireciona para `/empresa`
- [X] T065 [P] [US7] Testes com axe em `frontend/src/pages/__tests__/MemberDetailPage.test.tsx` e `CompanySettingsPage.test.tsx` (trocar cargo, gestor, desativar responsável bloqueado, transferência remove acesso)

**Checkpoint**: todas as histórias funcionais.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T066 ⚛️ Criar `frontend/Dockerfile` (Node 22 build → `nginx:alpine`), `frontend/.dockerignore` e `frontend/nginx.conf` (SPA com fallback para `index.html`; `no-cache` em `index.html`, `sw.js`, `workbox-*.js`, `manifest.webmanifest`; cache longo em `/assets/`; proxy `/api/` e `/health` para `http://api:8080`; cabeçalhos de segurança básicos) conforme research R-15
- [X] T067 🟣 Descomentar/ajustar o serviço `frontend` em `docker-compose.yml` (build `./frontend`, container `pontua-frontend`, porta `${FRONTEND_PORT:-8081}:80`, `depends_on` api healthy, rede `pontua-network`), acrescentar `FRONTEND_PORT` em `.env.example`/`.env`, e atualizar `backend/Pontua.API/appsettings.Docker.json` (`App:FrontendBaseUrl` e `Cors:AllowedOrigins` para `http://localhost:8081`, mantendo `http://localhost:5173`); subir via WSL e validar `http://localhost:8081` e `http://localhost:8081/api/...` (depende de T066)
- [X] T068 [P] ⚛️ Teste de build em `frontend/src/test/pwaBuild.test.ts` ou script `frontend/scripts/check-pwa-build.mjs`: `dist/manifest.webmanifest` com nome, ícones existentes, cores e atalho; `dist/sw.js` presente com denylist de `/api/`
- [X] T069 [P] ⚛️ Revisão de acessibilidade e responsividade em todas as páginas: 320 px sem rolagem horizontal, zoom 200%, navegação só por teclado, `prefers-reduced-motion`, textos todos em `pt-BR.json`; corrigir o que faltar em `frontend/src/`
- [X] T070 [P] 🎨 Revisão visual das telas implementadas contra `docs/design/` e registro de ajustes em `docs/design/REVIEW.md` (sem editar `.tsx`; ajustes viram correções do ⚛️)
- [X] T071 ⚛️ Aplicar os ajustes de `docs/design/REVIEW.md` em `frontend/src/` (depende de T070)
- [X] T072 ⚛️ Rodar `npm run lint`, `npm test` e `npm run build` em `frontend/` sem erros; verificar bundle inicial ≤ 250 KB gzip; criar `frontend/README.md` apontando para `specs/002-pontua-frontend-pwa/quickstart.md`
- [X] T073 Executar o roteiro de `specs/002-pontua-frontend-pwa/quickstart.md` no ambiente de homologação (`http://localhost:8081`), incluindo modo offline e Lighthouse, e registrar o resultado em `specs/002-pontua-frontend-pwa/quickstart.md` › "Resultado da validação"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1a (Design)**: sem dependências; **bloqueia** T010, T020 e todas as páginas.
- **Phase 1b (Projeto)**: T006–T009 podem começar em paralelo ao design; T010 espera T002.
- **Phase 2 (Foundational)**: depende do Setup; bloqueia as histórias.
- **US1**: depende só da Foundational.
- **US2**: depende da Foundational e de US1 (precisa de sessão e empresa).
- **US3**: depende da Foundational; T040 é necessário para quem não tem empresa (US1 leva a ela).
- **US4**: depende de US1 (login/cadastro) e de US3 (escolher cargo no convite).
- **US5**: depende de US2 (`punchService`, `PunchBadge`).
- **US6**: depende de US5 (`DayCard`) e US2.
- **US7**: depende de US3 (`ScheduleEditor`) e US5 (`DayCard`, `SummaryHeader`).
- **Polish**: T066–T067 podem rodar assim que houver build (após US2); demais no fim.

```text
Design ─┐
Projeto ┴─ Foundational ─ US1 ─┬─ US2 ─ US5 ─┬─ US6
                               └─ US3 ─ US4  └─ US7 (também depende de US3)
```

### Parallel Opportunities

- Design: T004 e T005 em paralelo após T002/T003; o projeto (T006–T009) em paralelo ao design.
- Foundational: T012, T013, T014 juntos; T020 em paralelo com T015–T019; testes T024/T025.
- Após US1: US2 e US3 em paralelo (desenvolvedores diferentes).
- Dentro de cada história, os services/contexts [P] e os testes [P].

---

## Parallel Example: User Story 2

```text
Task: "T032 [US2] Criar punchService em frontend/src/Services/punchService.ts"
Task: "T036 [US2] Criar PunchBadge, ClockFace e QueueIndicator em frontend/src/components/"
# depois de T037:
Task: "T038 [US2] Testes da fila offline em frontend/src/Services/__tests__/punchQueue.test.ts"
Task: "T039 [US2] Teste com axe da ClockPage em frontend/src/pages/__tests__/ClockPage.test.tsx"
```

---

## Implementation Strategy

### MVP First

1. Design (1a) + Projeto (1b) → Foundational.
2. US1 (entrar) → US2 (bater ponto) — com a empresa criada pela tela de US3 (T040) ou por API.
3. **Validar**: entrar, criar empresa, bater ponto online e offline → MVP de produto.

### Incremental Delivery

US1 → US2 (MVP) → US3 (cargos) → US4 (convites, abre para equipes) → US5 (histórico e manual) →
US6 (aprovações) → US7 (gestão) → Polish (container, revisão de design, Lighthouse).

### Execução pelos agentes

1. 🎨 `ux-designer`: T001–T005 (uma chamada).
2. ⚛️ `frontend-react-developer`: T006–T025, depois uma chamada por grupo de histórias.
3. 🎨 revisão T070 → ⚛️ T071.
4. 🟣 `dotnet-senior-developer`: T067.

---

## Notes

- Nunca usar `alert()`/`window.confirm()` (skill `react-architecture`): `ConfirmModal` e `sonner`.
- Nunca guardar token fora de `pontua:auth` nem em cookie (Princípio VI).
- Imports com o casing exato de `Contexts/`, `Services/`, `hooks/`, `types/` (build Linux).
- Docker só via WSL (`wsl --cd C:\repos\pontua -e docker compose ...`).
