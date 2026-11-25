# UI Contract: Rotas, telas e permissões

**Feature**: `002-pontua-frontend-pwa`

A API consumida é a da feature 001 ([../../001-pontua-backend-core/contracts/api.md](../../001-pontua-backend-core/contracts/api.md)) —
esta feature **não** altera endpoints. Este contrato define as rotas do app, quem vê cada uma e
quais chamadas cada tela faz.

Papéis na empresa ativa: 👤 membro · 👁 gestor (escopo dos seus cargos) · 👑 responsável.
`{range}` = query do filtro de datas (`?month=yyyy-MM` ou `?start=…&end=…`).

## Públicas

| Rota | Tela | Chamadas |
|---|---|---|
| `/entrar` | Login (e-mail/senha, Google) | `POST /api/auth/login`, `POST /api/auth/google` |
| `/cadastro` | Criar conta | `POST /api/auth/register`, `POST /api/auth/google` |
| `/convite/:token` | Convite: empresa e cargo, criar conta/entrar, aceitar | `GET /api/invitations/{token}`, `POST /api/invitations/{token}/accept` |

## Autenticadas sem empresa

| Rota | Tela | Chamadas |
|---|---|---|
| `/bem-vindo` | Sem empresa: "Criar empresa" ou "Tenho um convite" (colar link) | `GET /api/companies` |
| `/empresas/nova` | Criar empresa (nome, documento, fuso) | `POST /api/companies` |
| `/conta` | Minha conta: nome, senha, instalar app, sair | `GET/PUT /api/auth/me`, `PUT /api/auth/me/password` |

## Autenticadas com empresa ativa

| Rota | Tela | Papel | Chamadas principais |
|---|---|---|---|
| `/` | **Ponto**: relógio, jornada do dia, próximo período, marcações de hoje, botão registrar, fila offline | 👤 | `GET .../members/me`, `GET .../punches/me?start=hoje&end=hoje`, `POST .../punches`, `POST .../punches/offline` |
| `/historico{range}` | **Histórico**: totais, semanas, dias com marcações; incluir manual, corrigir, cancelar | 👤 | `GET .../punches/me`, `GET .../summary/me`, `POST .../punches/manual`, `POST .../punches/{id}/cancel` |
| `/historico/marcacao/:punchId` | Detalhe da marcação com histórico de status | 👤 (autor) 👁 👑 | `GET .../punches/{id}` |
| `/aprovacoes{range}&tipo=&cargo=` | **Painel**: por dia, membros sem marcação/pendências, aprovar/rejeitar | 👁 👑 | `GET .../approvals`, `POST .../punches/{id}/approve`, `POST .../punches/{id}/reject` |
| `/empresa` | **Empresa**: atalhos de configuração (👑) e informações da empresa (👤) | 👤 | `GET .../companies/{id}` |
| `/empresa/cargos` | Lista de cargos com resumo da jornada | 👑 | `GET .../positions` |
| `/empresa/cargos/novo` e `/empresa/cargos/:positionId` | Editor de cargo e jornada (semanal/diária, dias, períodos, cargas, vigência) | 👑 | `POST .../positions`, `GET/PUT .../positions/{id}`, `PUT .../positions/{id}/schedule`, `DELETE .../positions/{id}` |
| `/empresa/convites{range}` | Convites: gerar, compartilhar/copiar, revogar | 👑 | `GET/POST .../invitations`, `POST .../invitations/{id}/revoke` |
| `/empresa/membros` | Membros ativos/inativos | 👁 (seus cargos) 👑 | `GET .../members` |
| `/empresa/membros/:memberId{range}` | Detalhe: cargo, jornada, histórico e resumo do mês; ações do responsável | 👁 👑 | `GET .../members/{id}`, `GET .../members/{id}/punches`, `GET .../members/{id}/summary`, `PUT .../position`, `PUT/DELETE .../schedule`, `POST .../deactivate`, `POST .../reactivate`, `PUT .../manager` |
| `/empresa/configuracoes` | Dados da empresa (nome, documento, fuso, limite manual) e transferência | 👑 | `PUT .../companies/{id}`, `POST .../transfer-ownership` |

Regras:
- Rota sem permissão → redireciona para `/` com toast "Você não tem acesso a esta área."
- Sem sessão → `/entrar` guardando `returnTo`.
- Sem empresa ativa → `/bem-vindo`.
- `?acao=registrar` em `/` (atalho do PWA) abre direto a confirmação de registro.
- Qualquer `{range}` inválido na URL é trocado pelo mês corrente.

## Componentes compartilhados (contrato de UI)

| Componente | Responsabilidade |
|---|---|
| `AppShell` | barra inferior (< 1024 px) / menu lateral (≥ 1024 px), seletor de empresa, banner offline, aviso de nova versão |
| `PeriodFilter` | mês com ‹ ›, botão "Filtro avançado" (modal com início/fim, máx. 366 dias) |
| `PunchBadge` | selo de tipo + status da marcação |
| `DayCard` | dia com períodos previstos, marcações, trabalhado/previsto/saldo |
| `ScheduleEditor` | edição de jornada semanal/diária com "copiar de outro dia" |
| `ConfirmModal` | confirmações (registrar ponto, rejeitar, desativar, transferir) — nunca `window.confirm` |
| `EmptyState`, `ErrorState`, `LoadingState` | estados obrigatórios de cada tela (FR-006) |
| `StaleDataNotice` | "Sem conexão — dados de [data/hora]" |
| `InstallAppButton` | instalação (prompt nativo ou instruções do iOS) |
