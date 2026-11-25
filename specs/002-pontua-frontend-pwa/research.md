# Research: Pontua — App PWA (Frontend)

**Feature**: `002-pontua-frontend-pwa` | **Date**: 2026-11-25

Decisões técnicas da Fase 0. Nenhum item ficou como NEEDS CLARIFICATION. Base de referência: o
projeto irmão Finami (`C:\repos\finami\frontend`, feature `005-pwa-webapp`), que usa a mesma
stack da constituição.

---

## R-01 — Stack e bibliotecas

- **Decision**: React 18 + TypeScript 5 + Vite 6 + Tailwind CSS 4 (`@tailwindcss/vite`) + React
  Router 6 + i18next/react-i18next + Fetch API. Apoio: `vite-plugin-pwa` (service worker e
  manifest), `@radix-ui/react-dialog` (modais acessíveis, skill `react-modal`), `sonner` (toasts,
  skill `react-alert`), `lucide-react` (ícones). Testes: Vitest + Testing Library + `vitest-axe`
  + `fake-indexeddb`.
- **Rationale**: Princípio II (stack fixa: Vite, Tailwind, Context API, Fetch, i18next); mesmas
  versões do Finami, já validadas como PWA.
- **Alternatives considered**: Next.js (SSR desnecessário para um PWA atrás de login); Redux/
  Zustand (proibidos pelo Princípio II); Axios (restrito a legado).

## R-02 — Design antes das telas (Princípio VIII)

- **Decision**: o `ux-designer` entrega, antes de qualquer tela, em `docs/design/`:
  `DESIGN_DIRECTION.md` (direção visual a partir de `docs/logomarca/`), `tokens.css` (cores,
  tipografia, espaçamentos, raios, sombras — validados para contraste AA), `components.md`
  (especificação de componentes e estados), mockups HTML das telas-chave (`screens/*.html`) e os
  ícones do PWA (any/maskable 192/512, apple-touch, favicon) gerados da logomarca. O
  `frontend-react-developer` consome os tokens via `@theme` do Tailwind e não inventa estilos.
- **Rationale**: constituição exige o `ux-designer` primeiro para interfaces novas; o pedido do
  usuário também.
- **Alternatives considered**: shadcn/ui pronto sem direção própria (identidade genérica).

## R-03 — Cliente HTTP e formato de erro

- **Decision**: módulo `Services/apiClient.ts` com `apiFetch<T>(path, options)`: base
  `import.meta.env.VITE_API_URL` (vazio = mesma origem), header `Authorization: Bearer`, timeout de
  10 s, JSON. Em resposta ≠ 2xx lê o envelope `{ sucesso, mensagem, erros[{campo,mensagem}] }` da
  API e lança `ApiError(status, mensagem, erros)`; 401 dispara o logout global. Os services
  (padrão de classe da skill `react-architecture`) devolvem o DTO direto.
- **Rationale**: a API do Pontua devolve o DTO em sucesso e o envelope só em erro (contracts da
  feature 001). **Desvio da skill**: a regra "sempre checar `result.sucesso`" não se aplica; o
  equivalente é `response.ok` + `ApiError`. `erros[]` alimenta os erros por campo nos formulários
  (`aria-describedby`, Princípio IX).
- **Alternatives considered**: envolver toda resposta num envelope no cliente (código extra sem
  ganho).

## R-04 — Sessão e login Google

- **Decision**: sessão em `localStorage` na chave `pontua:auth` (`{ token, expiresAt, user }`),
  conforme o Princípio VI; nunca cookie. `AuthContext` restaura a sessão na abertura, descarta se
  `expiresAt` passou e escuta o 401 do `apiFetch`. Login Google com **Google Identity Services**
  (script `accounts.google.com/gsi/client`, botão oficial) obtendo o ID token e enviando para
  `POST /api/auth/google`; `VITE_GOOGLE_CLIENT_ID` vazio esconde o botão. Retorno pós-login: a
  rota pedida é guardada em `sessionStorage` (`pontua:returnTo`).
- **Rationale**: Princípio VI; GIS é a forma suportada pelo Google de obter ID token no browser.
- **Alternatives considered**: fluxo OAuth com redirect (exige backend de callback, que não existe).

## R-05 — Empresa ativa e papéis

- **Decision**: `CompanyContext` mantém a lista (`GET /api/companies`) e a empresa ativa, salva
  em `localStorage` (`pontua:company`). As rotas internas **não** levam o id da empresa; o seletor
  troca a empresa e recarrega as telas. O papel vem de `CompanySummary` (`isOwner`, `isManager`)
  e de `CompanyInfo.myAccess`; um hook `useRole()` controla o que aparece (FR-011). Sem empresa →
  tela "Bem-vindo" (criar ou entrar por convite).
- **Rationale**: URLs curtas e estáveis para o app instalado; a troca de empresa é rara.
- **Alternatives considered**: `/:companyId/...` na URL (links mais longos; o convite já cobre o
  único deep link necessário).

## R-06 — Bater ponto e fila offline (FR-013, SC-005)

- **Decision**:
  - **Online**: `POST /punches` (timeout 10 s). Resposta 201 → confirmação com período.
  - **Offline ou falha de rede/timeout**: a marcação vai para a fila IndexedDB `pontua-queue`
    (store `punches`, chave `clientId = crypto.randomUUID()`) com `{ clientId, userId,
    companyId, punchedAt (ISO com offset do aparelho), createdAt, state: "waiting" }` e o app
    confirma "guardada para envio".
  - **Envio**: `PunchQueueContext` tenta enviar ao abrir o app, no evento `reconnected`, a cada
    30 s enquanto houver itens e após qualquer resposta bem-sucedida da API; agrupa por empresa em
    lotes de até 50 para `POST /punches/offline`. `created`/`duplicate` → remove da fila;
    `future`/`too_old` → marca `rejected` com motivo, avisa por toast e mostra na tela até o
    usuário dispensar.
  - O indicador mostra a quantidade em `waiting`.
- **Rationale**: o backend é idempotente por `clientId` (R-10 da feature 001); IndexedDB
  sobrevive a fechar o app.
- **Trade-off aceito**: se a marcação normal chegou ao servidor mas a resposta se perdeu
  (timeout), a cópia enviada pela fila vira uma marcação offline **pendente** a mais; o
  responsável a rejeita no painel. Preferido a perder a marcação.
- **Alternatives considered**: Background Sync API (só Chromium; o envio na abertura cobre os
  demais); enviar sempre pela rota offline (toda marcação ficaria pendente).

## R-07 — Dados sem conexão (somente leitura)

- **Decision**: igual ao Finami (R-02/R-03 da feature 005 deles): cache na camada do app, não no
  service worker. `apiFetch` com `cache: "network-first"` nos GETs de consulta (empresas, membro
  atual, histórico, resumo, cargos, painel): grava em IndexedDB `pontua-cache` (chave
  `{userId}:{path+query}`, `fetchedAt`, `schemaVersion`); sem rede devolve o valor guardado com
  `stale: true` e `fetchedAt`. Escritas offline (exceto ponto) lançam `ApiError(0, ...)` sem
  chamar `fetch`. Logout e 401 limpam o cache de leitura do usuário.
- **Atualização (implementação)**: a **fila de marcações offline NÃO é apagada** no logout nem no
  401 — apagar perderia registros de ponto. Os itens ficam no aparelho ligados ao `userId` e são
  enviados quando o mesmo usuário entrar de novo. No logout manual com itens aguardando, o
  `ConfirmModal` avisa "Você tem N marcações aguardando envio; elas serão enviadas no seu próximo
  acesso neste aparelho".
- **Rationale**: isola por usuário, não expõe o token ao SW e informa a data dos dados para o
  aviso "dados de [hora]".
- **Alternatives considered**: `runtimeCaching` do Workbox em `/api/*` (sem separar usuários nem
  informar data).

## R-08 — Conectividade, relógio e fuso

- **Decision**: `ConnectivityContext` combina `navigator.onLine`, eventos `online/offline` e o
  resultado real das chamadas (falha/timeout → offline); aviso só após 2 s offline contínuos;
  evento `reconnected`. Relógio: diferença entre o header `Date` das respostas e o relógio do
  aparelho guardada como `serverOffset`; a tela de ponto mostra a hora corrigida. Datas e horas
  sempre formatadas com `Intl.DateTimeFormat('pt-BR', { timeZone: company.timeZone })`.
- **Rationale**: `navigator.onLine` sozinho dá falso positivo; o fuso da empresa define o "hoje"
  (spec, Assumptions).
- **Alternatives considered**: endpoint de hora do servidor (não existe; o header basta).

## R-09 — Filtro de datas (FR-024)

- **Decision**: componente `PeriodFilter` + hook `usePeriodFilter()` sincronizados com a query
  da URL (`?month=2026-11` ou `?start=…&end=…`), que é repassada como está à API (`DateRange`
  da feature 001). Padrão: mês corrente no fuso da empresa; setas ‹ › trocam o mês; "Filtro
  avançado" abre um modal com data inicial e final (máx. 366 dias, validado no formulário).
- **Rationale**: mesma semântica do backend; o filtro sobrevive a recarregar e voltar.
- **Alternatives considered**: estado só em memória (perde o filtro ao navegar).

## R-10 — Navegação responsiva

- **Decision**: até 1023 px, barra inferior com até 4 destinos (Ponto, Histórico, Aprovações
  com contador — só responsável/gestor —, Empresa/Mais); a partir de 1024 px, menu lateral com os
  mesmos destinos e o seletor de empresa no topo. Telas de configuração do responsável ficam em
  "Empresa".
- **Rationale**: FR-002 (uso com uma mão no celular, espaço extra no computador).

## R-11 — Contador de pendências (FR-023)

- **Decision**: `GET /approvals?type=pending&start={hoje−30}&end={hoje}` ao entrar, ao trocar de
  empresa, a cada aprovação/rejeição e a cada 2 min com o app visível; o contador soma as
  marcações pendentes dos últimos 31 dias.
- **Rationale**: o backend não tem endpoint de contagem; 31 dias cobre o limite retroativo padrão
  (30 dias). Pendências mais antigas aparecem ao filtrar o painel.
- **Alternatives considered**: novo endpoint de contagem no backend (fica como melhoria futura).

## R-12 — Fluxo de convite (FR-021)

- **Decision**: rota pública `/convite/:token` → `GET /api/invitations/{token}`. Sem sessão, o
  token fica em `sessionStorage` (`pontua:pendingInvite`) durante cadastro/login e, ao autenticar,
  `POST /api/invitations/{token}/accept` é chamado automaticamente; sucesso ou 409 (já membro)
  selecionam a empresa e abrem a tela de ponto.
- **Rationale**: SC-002 (convite → primeira marcação em < 2 min) sem reabrir o link.

## R-13 — Marcação manual: datas permitidas (FR-016)

- **Decision**: o seletor de data aceita de `max(hoje − manualRetroDays, data de entrada do
  membro)` até hoje; horário no futuro (hoje) é recusado no formulário. Data de entrada vem de
  `MemberInfo.joinedAt` (`GET .../members/me`).
- **Rationale**: evita marcações que nunca apareceriam no painel (achado da validação da feature
  001). O backend continua sendo a validação final.

## R-14 — PWA: service worker, manifest, instalação e atualização

- **Decision**: `vite-plugin-pwa` com `generateSW`, `registerType: "prompt"` (aviso "Nova versão
  disponível — Atualizar"), precache só da casca (JS, CSS, HTML, fontes, ícones),
  `navigateFallback: /index.html` com denylist para `/api/`, `/health` e `/swagger`. Manifest:
  `name`/`short_name` "Pontua", `lang: pt-BR`, `display: standalone`, cores dos tokens, ícones
  any/maskable, atalho "Registrar ponto" (`/?acao=registrar`). Instalação: botão "Instalar app"
  via `beforeinstallprompt`; no iOS, folha com instruções "Compartilhar → Adicionar à Tela de
  Início".
- **Rationale**: FR-001, SC-006; mesmo desenho validado no Finami.

## R-15 — Servir o app (homolog e dev)

- **Decision**:
  - **Dev**: `npm run dev` (Vite, porta 5173) com proxy `/api` e `/health` para a API (padrão
    `http://localhost:5080`, a de homolog; configurável por `VITE_DEV_API_PROXY`).
  - **Homolog**: `frontend/Dockerfile` multi-stage (Node 22 build → `nginx:alpine`) e
    `frontend/nginx.conf` servindo o SPA com fallback para `index.html`, `no-cache` em
    `index.html`, `sw.js` e `manifest.webmanifest`, cache longo em `/assets/`, e proxy de `/api/`
    para `api:8080` (mesma origem, sem CORS). O serviço `frontend` do `docker-compose.yml` é
    descomentado com porta `8081:80`; `App__FrontendBaseUrl` e CORS de homolog passam a apontar
    para `http://localhost:8081`.
- **Rationale**: mesma origem simplifica sessão, SW e CORS; dev continua com hot reload.

## R-16 — Testes

- **Decision**: Vitest + Testing Library + `vitest-axe` (checagem de acessibilidade em cada
  página e componente), `fake-indexeddb` para fila e cache, `fetch` simulado. Cobertura
  obrigatória: `apiClient`, `offlineCache`, `punchQueue` (enfileirar, enviar em lote, duplicate,
  rejected), `usePeriodFilter`, `AuthContext` (401, expiração, returnTo), fluxo de convite, e
  uma renderização + axe de cada página. Validação manual pelo quickstart (Lighthouse PWA e
  acessibilidade, instalação real, modo avião).
- **Rationale**: SC-005 e SC-007 exigem prova automatizada; o resto é coberto pelo roteiro.
- **Alternatives considered**: Playwright E2E (útil depois; aumenta setup agora).

## R-17 — Distribuição entre agentes (Princípio VIII)

- **`ux-designer`**: `docs/design/*` (direção, tokens, componentes, mockups das telas-chave em
  mobile e desktop) e ícones/imagens do PWA em `frontend/public/` a partir da logomarca. Não
  escreve `.tsx`.
- **`frontend-react-developer`**: todo o código em `frontend/` (projeto, PWA, services,
  contexts, hooks, páginas, componentes, i18n, testes, Dockerfile e nginx do frontend).
- **`dotnet-senior-developer`**: só ajustes de configuração de homolog (CORS e
  `App__FrontendBaseUrl` para a porta 8081) e o serviço `frontend` no `docker-compose.yml`.
