# Implementation Plan: Pontua — App PWA (Frontend)

**Branch**: `002-pontua-frontend-pwa` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-pontua-frontend-pwa/spec.md`

## Summary

App PWA mobile-first em `frontend/` (React 18 + TypeScript + Vite + Tailwind 4) que consome a API
da feature 001 sem alterá-la. Começa por uma etapa de design do `ux-designer` (direção visual a
partir da logomarca, tokens AA, componentes, mockups e ícones do PWA) e segue com o
`frontend-react-developer`: sessão JWT em `pontua:auth` e login Google, empresa ativa com papéis,
tela de ponto com relógio corrigido pelo servidor e fila offline idempotente em IndexedDB,
histórico e resumo com filtro por mês/intervalo, marcação manual e correção, painel de
aprovações com contador, configuração de cargos/jornadas, convites compartilháveis e gestão de
membros. Service worker com precache da casca, dados de leitura offline em cache do app, e
serviço `frontend` (nginx) no compose de homologação.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.x, Node.js 22 LTS (build)
**Primary Dependencies**: Vite 6, Tailwind CSS 4 (`@tailwindcss/vite`), React Router 6, i18next 25 + react-i18next, vite-plugin-pwa (Workbox), @radix-ui/react-dialog, sonner, lucide-react; Fetch API nativa
**Storage**: localStorage (`pontua:auth`, `pontua:company`), sessionStorage (`returnTo`, convite pendente), IndexedDB (`pontua-queue` para marcações offline, `pontua-cache` para leitura offline)
**Testing**: Vitest + Testing Library + vitest-axe + fake-indexeddb; validação manual com Lighthouse pelo quickstart
**Target Platform**: navegadores modernos móveis (Android Chrome, iOS Safari 16.4+) e desktop (Chrome, Edge, Firefox, Safari); instalável como PWA
**Project Type**: web app (SPA/PWA) — `frontend/` consumindo `backend/` existente
**Performance Goals**: tela principal em < 2 s em 4G (SC-006); registrar ponto em ≤ 2 toques e < 5 s (SC-001); bundle inicial ≤ 250 KB gzip
**Constraints**: WCAG 2.1 AA (Princípio IX, SC-007); 320 px sem rolagem horizontal (SC-008); offline só para bater ponto e leitura de dados já vistos; sem alterações no backend além de configuração de homolog
**Scale/Scope**: 15 rotas, ~10 contexts, ~25 componentes compartilhados; 1 idioma (pt-BR)

Nenhum item ficou como NEEDS CLARIFICATION — todos resolvidos em [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra a constituição **v1.2.0**.

| # | Princípio | Avaliação | Status |
|---|---|---|---|
| I | Skills obrigatórias | Cada entidade do frontend (Auth, Company, Punch, History, Position, Invitation, Member, Approval) segue `react-architecture` (Types → Service → Context → Hook → Provider). Modais com `react-modal`, toasts com `react-alert`. **Ajuste documentado (R-03)**: a API retorna o DTO em sucesso e o envelope `{sucesso,mensagem,erros}` só em erro, então o "checar `result.sucesso`" vira `response.ok` + `ApiError`. | ✅ |
| II | Stack fixa | Vite, React 18, TS 5, React Router 6, Tailwind 4, i18next, Fetch API, Context API; sem Bootstrap/MUI/Redux/Axios. Bibliotecas auxiliares (vite-plugin-pwa, Radix Dialog, sonner, lucide) não substituem itens da stack. Docker só via WSL. | ✅ |
| III | Case de diretórios | `src/Contexts/`, `src/Services/`, `src/hooks/`, `src/types/`; imports com o casing exato (build Linux no compose). | ✅ |
| IV | Convenções de código | Componentes PascalCase, `interface` (não `type`) para objetos, arrow functions, `const`, constantes UPPER_CASE (`AUTH_STORAGE_KEY = "pontua:auth"`). Uniões de string para enums vindos da API. | ✅ |
| V | Banco de dados | n/a (sem mudança de banco). | ✅ n/a |
| VI | Autenticação | JWT Bearer no header; token só em `localStorage` `pontua:auth`; nunca cookie; descarte em expiração/401 com volta à entrada; nenhum segredo no frontend (`VITE_GOOGLE_CLIENT_ID` é público). | ✅ |
| VII | Erros no backend | Backend não muda. No frontend, `handleError`/`clearError`/`loading` em todo context (skill). | ✅ |
| VIII | Agentes | `ux-designer` primeiro (design e ícones), depois `frontend-react-developer` (todo `frontend/`); `dotnet-senior-developer` só para compose/config de homolog. Sessão principal só orquestra. Ver R-17. | ✅ |
| IX | Acessibilidade | Tokens validados para contraste AA; alvos ≥ 44 px; `label` em todos os campos, `aria-describedby` nos erros; `aria-live` para toasts e confirmação de ponto; foco preso nos modais com `Esc`; `lang="pt-BR"`; saldo com sinal além da cor; `prefers-reduced-motion`; zoom 200%; axe em todas as páginas nos testes. | ✅ |
| — | Variáveis de ambiente | `VITE_API_URL`, `VITE_SITE_BASENAME` (opcional), `VITE_GOOGLE_CLIENT_ID`; acesso via `import.meta.env.VITE_*`; sem `REACT_APP_`. Extra só de dev: `VITE_DEV_API_PROXY`. | ✅ |

**Resultado do gate (pré-pesquisa)**: aprovado, sem violações (1 ajuste de padrão documentado em
R-03, não uma violação).
**Re-check pós-design (Fase 1)**: data model, rotas e quickstart revisados contra a tabela —
nenhuma violação nova.

## Project Structure

### Documentation (this feature)

```text
specs/002-pontua-frontend-pwa/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões R-01 a R-17
├── data-model.md        # Fase 1 — tipos, estado dos contexts, armazenamento local
├── quickstart.md        # Fase 1 — dev, homolog e roteiro de validação
├── contracts/
│   └── ui-routes.md     # Fase 1 — rotas, permissões, chamadas e componentes compartilhados
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
docs/design/                     # ux-designer
├── DESIGN_DIRECTION.md
├── tokens.css                   # cores, tipografia, espaço, raio, sombra (AA validado)
├── components.md                # especificação e estados dos componentes
└── screens/                     # mockups HTML mobile + desktop das telas-chave

frontend/                        # frontend-react-developer (ícones em public/ pelo ux-designer)
├── package.json, vite.config.ts, tsconfig*.json, eslint.config.js, index.html
├── .env.example, Dockerfile, nginx.conf, .dockerignore
├── public/                      # ícones PWA, apple-touch, favicon, robots
└── src/
    ├── main.tsx                 # providers
    ├── App.tsx, routes.tsx      # rotas e guards (auth, empresa, papel)
    ├── index.css                # Tailwind + @theme a partir de docs/design/tokens.css
    ├── i18n/                    # i18next + pt-BR.json
    ├── types/                   # auth, company, schedule, position, member, invitation, punch, approval, summary, common
    ├── Services/                # apiClient, offlineCache, punchQueue, authService, companyService,
    │                            # positionService, invitationService, memberService, punchService,
    │                            # approvalService, summaryService
    ├── Contexts/                # Auth, Connectivity, Company, Punch, PunchQueue, History,
    │                            # Position, Invitation, Member, Approval
    ├── hooks/                   # useAuth, useCompany, useRole, usePeriodFilter, usePunch, ...
    ├── components/              # AppShell, PeriodFilter, PunchBadge, DayCard, ScheduleEditor,
    │                            # ConfirmModal, Modal, Empty/Error/LoadingState, StaleDataNotice,
    │                            # InstallAppButton, UpdatePrompt, OfflineBanner, ...
    ├── pages/                   # Login, Register, Invite, Welcome, NewCompany, Account, Clock,
    │                            # History, PunchDetail, Approvals, Company, Positions,
    │                            # PositionEditor, Invitations, Members, MemberDetail, CompanySettings
    ├── utils/                   # datas/fuso (Intl), minutos ↔ hh:mm, formatação
    └── test/                    # setup (jest-dom, axe, fake-indexeddb), helpers de fetch

docker-compose.yml               # dotnet-senior-developer: serviço frontend (8081:80) descomentado
```

**Structure Decision**: aplicação web separada em `frontend/`, ao lado do `backend/` existente.
Design em `docs/design/`. Nenhum arquivo de `backend/` muda além de `appsettings.Docker.json`
(CORS/URL do frontend de homolog), feito pelo `dotnet-senior-developer`.

### Execução por agente (Princípio VIII)

| Etapa | Agente | Entregáveis |
|---|---|---|
| 1. Design | `ux-designer` | `docs/design/*`, ícones e imagens do PWA em `frontend/public/` |
| 2. App | `frontend-react-developer` | todo o resto de `frontend/` |
| 3. Homolog | `dotnet-senior-developer` | serviço `frontend` no compose, CORS e `App__FrontendBaseUrl` de homolog |

### Fluxos-chave de design

- **Registrar ponto**: botão → `ConfirmModal` (mostra hora e próximo período) → online:
  `POST /punches` → toast `aria-live` "Entrada registrada às 08:02" e `today` atualizado;
  falha de rede/offline: `punchQueue.enqueue` → toast "Guardada, será enviada" → indicador.
- **Sincronizar fila**: `reconnected` / abertura / 30 s → itens `waiting` agrupados por empresa →
  `POST /punches/offline` → remove `created/duplicate`, marca `rejected` com motivo → recarrega
  `today` e histórico.
- **Convite**: `/convite/:token` → dados públicos → sem sessão guarda o token → login/cadastro →
  aceite automático → seleciona empresa → `/`.

## Complexity Tracking

Nenhuma violação da constituição a justificar.
