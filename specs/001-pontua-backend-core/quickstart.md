# Quickstart: Pontua — Núcleo do Backend

**Feature**: `001-pontua-backend-core`

## Pré-requisitos

- .NET SDK 9.x (projetos em `net8.0`). O `dotnet-ef` 9.x é ferramenta local da solução
  (`backend/.config/dotnet-tools.json`): rode `dotnet tool restore` em `backend/`.
- **PostgreSQL 15 ou superior** (o índice de `schedule_periods` usa `NULLS NOT DISTINCT`),
  local, remoto ou o container do ambiente de homologação (`docker compose` via WSL —
  Princípio II).

## Ambientes

| Ambiente | `ASPNETCORE_ENVIRONMENT` | Onde roda | Configuração |
|---|---|---|---|
| Dev | `Development` | `dotnet run` no Windows, banco `pontua_dev` do PostgreSQL do compose | `backend/Pontua.API/appsettings.Development.json` (valores locais) |
| Homolog | `Docker` | `docker compose` via WSL2 (`pontua-db`, `pontua-api`, `pontua-frontend`) | `.env` na raiz (não versionado; modelo em `.env.example`) + `appsettings.Docker.json` |
| Prod | `Production` | Cluster Kubernetes (pendente — ver `deploy/k8s/README.md`) | `appsettings.Production.json` + Secrets do cluster |

**Portas no host**

| Serviço | Endereço | Observação |
|---|---|---|
| PostgreSQL (`pontua-db`) | `localhost:5432` (`DB_PORT`) | bancos `pontua` (homolog), `pontua_dev` (dev) e `pontua_test` (integração); usuário/senha do `.env` (`pontua`/`pontua` por padrão) |
| API homolog (`pontua-api`) | `http://localhost:5080` (`API_PORT`) | Swagger em `/swagger`, health em `/health` |
| API dev (`dotnet run`) | `http://localhost:5157` | perfil `http` do `launchSettings.json` |
| Frontend homolog (`pontua-frontend`) | `http://localhost:8081` (`FRONTEND_PORT`) | nginx servindo o PWA; `/api/` e `/health` encaminhados para `api:8080` (mesma origem); health do container em `/healthz` |
| Frontend dev (`npm run dev`) | `http://localhost:5173` | Vite com proxy `/api` → `http://localhost:5080` (feature 002) |

### Homologação (Docker via WSL)

Docker só existe dentro do WSL2 (Princípio II, skill `wsl-docker`). Na raiz do repositório
(PowerShell):

```powershell
copy .env.example .env      # primeira vez: preencha JWT_SECRET (>= 32 bytes)
wsl --cd /mnt/c/repos/pontua -e docker compose up -d --build
wsl --cd /mnt/c/repos/pontua -e docker compose ps                 # pontua-db, pontua-api e pontua-frontend "healthy"
curl http://localhost:5080/health                                  # Healthy
curl http://localhost:8081/health                                  # Healthy (via nginx do frontend)
wsl --cd /mnt/c/repos/pontua -e docker compose logs --tail=100 api
wsl --cd /mnt/c/repos/pontua -e docker compose stop                # dados ficam no volume pontua_pgdata
```

No Git Bash, prefixe com `MSYS_NO_PATHCONV=1` (ex.:
`MSYS_NO_PATHCONV=1 wsl.exe --cd /mnt/c/repos/pontua -e docker compose ps`).

- A API de homologação aplica as migrações no startup (`Database:MigrateOnStartup=true` em
  `appsettings.Docker.json`); Development e Production não aplicam.
- `pontua_dev` e `pontua_test` são criados por `docker/postgres/init/01-databases.sql` apenas na
  primeira inicialização do volume. Recriar do zero: `docker compose down -v` (apaga os dados).
- As variáveis da API no compose seguem o padrão `Secao__Chave` (`Jwt__Secret`,
  `ConnectionStrings__PontuaContext`, `Cors__AllowedOrigins__0`...), alimentadas pelo `.env`.
- Em homologação o link do convite usa `APP_FRONTEND_BASE_URL` (padrão `http://localhost:8081`) e o
  CORS libera `CORS_ALLOWED_ORIGIN` (`http://localhost:8081`) e `CORS_ALLOWED_ORIGIN_DEV`
  (`http://localhost:5173`, o Vite em dev). As `VITE_*` do `.env` (`VITE_API_URL` vazio = mesma
  origem, `VITE_GOOGLE_CLIENT_ID` opcional) entram no bundle no build: ao mudá-las rode
  `docker compose up -d --build frontend`.

### Dev apontando para o banco do compose

Com o `pontua-db` rodando (basta `wsl --cd /mnt/c/repos/pontua -e docker compose up -d db`):

```bash
cd backend
dotnet tool restore
dotnet tool run dotnet-ef database update --project Pontua.Infra --startup-project Pontua.API
dotnet run --project Pontua.API --launch-profile http     # http://localhost:5157/swagger
```

O `dotnet ef` usa a configuração da própria API (`appsettings.Development.json` → banco
`pontua_dev`); para outro banco, defina `ConnectionStrings__PontuaContext`.

## Configuração

Variáveis de ambiente (ou `appsettings.{Ambiente}.json`):

| Variável | Exemplo |
|---|---|
| `ConnectionStrings__PontuaContext` | `Host=localhost;Port=5432;Database=pontua_dev;Username=pontua;Password=pontua` |
| `ASPNETCORE_ENVIRONMENT` | `Development`, `Docker` ou `Production` |
| `Jwt__Secret` | string com pelo menos 32 bytes |
| `Jwt__ExpirationHours` | `12` |
| `Google__ClientId` | OAuth Client ID (só para login Google) |
| `App__FrontendBaseUrl` | `http://localhost:8081` em homolog (monta o link do convite) |
| `Cors__AllowedOrigins__0`, `__1` | `http://localhost:8081`, `http://localhost:5173` (fora de Development) |
| `Database__MigrateOnStartup` | `true` só em homologação (`Docker`) |

## Executar

```bash
cd backend
dotnet restore
dotnet tool restore
dotnet tool run dotnet-ef database update --project Pontua.Infra --startup-project Pontua.API
dotnet run --project Pontua.API --launch-profile http
# Swagger: http://localhost:5157/swagger
```

## Testes

```bash
cd backend
dotnet test --filter "Category!=Integration"           # unitários
PONTUA_TEST_DB="Host=...;Database=pontua_test;..." dotnet test --filter "Category=Integration"
```

## Roteiro de validação manual (via `Pontua.API.http` ou Swagger)

1. **Conta e empresa (US1)**: `POST /api/auth/register` (Ana) → `POST /api/companies`
   `{ "name": "Padaria Sol" }` → `GET /api/companies` mostra `isOwner: true` e cargo
   "Responsável".
2. **Cargo e jornada (US2)**: `POST .../positions` "Atendente", semanal, seg–sex, 4 períodos,
   528 min/dia, 2640 min/semana → `GET .../positions/{id}` mostra os 5 dias expandidos.
   Repita em modo diário com sábado de 2 períodos sem horário previsto.
3. **Convite (US3)**: `POST .../invitations` `{ positionId }` → copie `token` →
   `GET /api/invitations/{token}` sem auth → registre João → `POST /api/invitations/{token}/accept`
   → João aparece em `GET .../members` como Atendente. Aceitar de novo → 409.
4. **Marcação (US4)**: como João, `POST .../punches` → `status: valid`, `periodName: "Entrada"`.
   Repetir em < 60 s → 422. `GET .../punches/me?month=2026-11` traz o dia com a marcação.
   Envie `POST .../punches/offline` com o mesmo `clientId` duas vezes → `created` e depois
   `duplicate`.
5. **Manual (US5)**: `POST .../punches/manual` sem `justification` → 400; com justificativa
   para ontem → `kind: manual`, `status: pending`, `countsAsWorked: false`. Data de 31 dias atrás
   → 422.
6. **Painel (US6)**: como Ana, `GET .../approvals?start=...&end=...` → João aparece como
   `pending`, e outro membro sem marcação num dia útil aparece como `missing`.
   `POST .../punches/{id}/approve` → `status: approved`; o resumo passa a contar as horas.
7. **Gestão (US7)**: `PUT .../members/{joao}/manager` `{ isManager: true, positionIds: [atendente] }`
   → João vê só atendentes em `/approvals`; aprovar a própria marcação → 403.
   `POST .../transfer-ownership` `{ memberId: joao }` → Ana perde acesso a `PUT .../positions`
   (403).
8. **Imutabilidade (FR-022a)**: no banco, `UPDATE punches SET punched_at = now()` e
   `DELETE FROM punches` → ambos falham pelo trigger `punches_immutable`. Em homologação:
   `wsl -e docker exec pontua-db psql -U pontua -d pontua -c "DELETE FROM punches;"`.

> Observação (passo 6): o painel só considera os dias em que o membro estava ativo. Se João aceitou
> o convite hoje, a manual "de ontem" (passo 5) não aparece como `pending` no painel — use uma
> marcação manual de hoje, ou aprove direto pelo id.
