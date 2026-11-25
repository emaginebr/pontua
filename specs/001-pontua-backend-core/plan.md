# Implementation Plan: Pontua — Núcleo do Backend de Ponto Eletrônico

**Branch**: `001-pontua-backend-core` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-pontua-backend-core/spec.md`

## Summary

API REST em .NET 8 (Clean Architecture, pasta `backend/`) para controle de ponto eletrônico
multiempresa: contas com JWT próprio e login Google, empresas com um responsável transferível,
cargos com jornadas versionadas por vigência (modo semanal ou diário, períodos com horário
previsto opcional, carga diária e semanal), jornada própria por membro, convites reutilizáveis
por link, marcações imutáveis com NSR sequencial por empresa (preparação para a Portaria
671/2021), marcações normais, offline (idempotentes) e manuais com justificativa, fluxo de
aprovação pelo responsável ou por gestores por cargo, painel de pendências e resumo de horas
com saldo diário e semanal — todas as listagens filtráveis por mês ou intervalo de datas.

## Technical Context

**Language/Version**: C# 12 / .NET 8 (`net8.0`; build com o SDK 9.0.309 instalado)
**Primary Dependencies**: ASP.NET Core 8 Web API, EF Core 9.x + Npgsql.EntityFrameworkCore.PostgreSQL 9.x, Swashbuckle 8.x, Microsoft.AspNetCore.Authentication.JwtBearer 8.x, Google.Apis.Auth, Microsoft.Extensions.Identity.Core (PasswordHasher), FluentValidation 11.x
**Storage**: PostgreSQL 15+ (snake_case, `timestamp without time zone` em UTC, `date`/`time` para datas e horários locais da empresa, trigger de imutabilidade em `punches`)
**Testing**: xUnit + Moq + FluentAssertions (`Pontua.Tests`); categoria `Integration` contra PostgreSQL real opcional (`PONTUA_TEST_DB`)
**Target Platform**: Linux server / container (deploy); desenvolvimento em Windows sem Docker
**Project Type**: web-service (somente backend; frontend PWA em feature futura)
**Performance Goals**: marcação confirmada < 1 s em p95 (SC-002); histórico e painel de um mês para 100 membros < 2 s (SC-006)
**Constraints**: marcações imutáveis e nunca excluídas (FR-022a); NSR sem lacunas por empresa (FR-022b); idempotência de marcações offline (FR-017a); isolamento entre empresas (SC-005); sem Docker local
**Scale/Scope**: empresas pequenas e médias — até ~100 membros por empresa, ~2.500 marcações/mês por empresa; ~45 endpoints, 12 tabelas

Nenhum item ficou como NEEDS CLARIFICATION — todos resolvidos em [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra a constituição **v1.1.0**.

| # | Princípio | Avaliação | Status |
|---|---|---|---|
| I | Skills obrigatórias | Entidades seguem `dotnet-architecture` (DTO → Infra.Interfaces → Domain → Infra → Application); validação com `dotnet-fluent-validation`; testes com `dotnet-test`. Frontend fora do escopo (`react-architecture` n/a). | ✅ |
| II | Stack fixa | .NET 8, EF Core 9, PostgreSQL, Swashbuckle 8; nenhum ORM extra; trigger e `UPDATE … RETURNING` do NSR via EF Core (`migrationBuilder.Sql` / `ExecuteSqlInterpolatedAsync`); sem Docker local (testes de integração sem Testcontainers). | ✅ |
| III | Case de diretórios | Regras de frontend; no backend pastas em PascalCase. | ✅ |
| IV | Convenções de código | Namespaces file-scoped `Pontua.*`, `_camelCase` em campos privados, `[JsonPropertyName]` camelCase em todos os DTOs. | ✅ |
| V | Banco de dados | snake_case plural, PK `{entidade}_id` bigint identity, `{tabela}_pkey`, `fk_{pai}_{filho}`, `ClientSetNull`, `timestamp without time zone`, `varchar` com tamanho, enums `integer`. Colunas `date`/`time`/`uuid` usadas onde o dado é data local, horário previsto ou identificador do aparelho — não conflitam com o princípio. Ver [data-model.md](./data-model.md). | ✅ |
| VI | Autenticação | JWT Bearer HMAC-SHA256 via `JwtBearer`; login e-mail/senha e Google por ID token; `Jwt__Secret` ≥ 32 bytes obrigatório no startup; senhas só como hash; `[Authorize]` em todos os controllers exceto `auth/register`, `auth/login`, `auth/google` e `GET invitations/{token}`; CORS aberto só em Development. Chave do frontend `pontua:auth` (feature futura). | ✅ |
| VII | Erros no backend | Todo controller termina em `catch (Exception ex) { return StatusCode(500, ex.Message); }`; exceções de domínio tipadas são capturadas antes e mapeadas para 400/403/404/409/422 com envelope `{ sucesso, mensagem, erros }`. | ✅ |
| VIII | Agentes especializados | Todo o código desta feature fica em `backend/` e será implementado **exclusivamente pelo `dotnet-senior-developer`**; a sessão principal só orquestra e revisa. Sem tarefas para `frontend-react-developer` ou `ux-designer` nesta feature. | ✅ |
| IX | Acessibilidade | Sem interface nesta feature; mensagens de erro em português claro e por campo (`erros[]`) para o frontend ligar ao campo via `aria-describedby`. | ✅ n/a |
| — | Variáveis de ambiente | `ConnectionStrings__PontuaContext`, `ASPNETCORE_ENVIRONMENT`, `Jwt__Secret`, `Google__ClientId` (constituição) + `Jwt__ExpirationHours`, `App__FrontendBaseUrl`, `Cors__AllowedOrigins`. | ✅ |

**Resultado do gate (pré-pesquisa)**: aprovado, sem violações.
**Re-check pós-design (Fase 1)**: data model, contratos e quickstart revisados contra a tabela
acima — nenhuma violação nova. Os endpoints de [contracts/api.md](./contracts/api.md) exigem
autenticação, exceto os 4 marcados como públicos (🔓) e `/health`.

## Project Structure

### Documentation (this feature)

```text
specs/001-pontua-backend-core/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas (R-01 a R-16)
├── data-model.md        # Fase 1 — tabelas, enums, transições, invariantes
├── quickstart.md        # Fase 1 — execução local e roteiro de validação
├── contracts/
│   └── api.md           # Fase 1 — contrato REST
├── checklists/
│   └── requirements.md  # Qualidade da spec
└── tasks.md             # Fase 2 (/speckit.tasks — não criado aqui)
```

### Source Code (repository root)

```text
backend/
├── Pontua.sln
├── Pontua.DTO/
│   ├── Auth/            # RegisterInfo, LoginInfo, GoogleLoginInfo, AuthResult, UserInfo, PasswordUpdateInfo
│   ├── Companies/       # CompanyInsertInfo, CompanyUpdateInfo, CompanyInfo, CompanySummary, TransferOwnershipInfo
│   ├── Positions/       # PositionInsertInfo, PositionUpdateInfo, PositionInfo
│   ├── Schedules/       # ScheduleInput, ScheduleInfo, ScheduleDayInfo, SchedulePeriodInfo
│   ├── Members/         # MemberInfo, MemberPositionUpdateInfo, ManagerUpdateInfo
│   ├── Invitations/     # InvitationInsertInfo, InvitationInfo, InvitationPublicInfo
│   ├── Punches/         # PunchInfo, ManualPunchInsertInfo, OfflinePunchBatchInfo, OfflineSyncResult, ReviewInfo, DayRecord
│   ├── Approvals/       # PendingPanelDay, PendingPanelMember
│   ├── Summary/         # HoursSummary, WeekSummaryInfo, DaySummaryInfo
│   ├── Common/          # DateRangeQuery
│   ├── Settings/        # JwtSettings, GoogleSettings, AppSettings
│   └── ErrorResult.cs   # { sucesso, mensagem, erros }
├── Pontua.Infra.Interfaces/
│   ├── Repository/      # IUserRepository, ICompanyRepository, IPositionRepository, IMemberRepository,
│   │                    # IScheduleRepository, IInvitationRepository, IPunchRepository (Insert + UpdateStatus),
│   │                    # INsrAllocator, IUnitOfWork
│   └── AppServices/     # IGoogleTokenAppService
├── Pontua.Domain/
│   ├── Enums/           # MemberStatus, ScheduleMode, PunchKind, PunchStatus, PendingReason
│   ├── Models/          # User, Company, Position, Member, MemberPosition, ManagerPosition,
│   │                    # Schedule, ScheduleDay, SchedulePeriod, Invitation, Punch, PunchStatusChange
│   ├── Exceptions/      # Validation/NotFound/Forbidden/Conflict/BusinessRule
│   ├── Validators/      # FluentValidation dos DTOs de entrada
│   ├── Interfaces/      # IAuthService, ITokenService, ICompanyService, IPositionService, IMemberService,
│   │                    # IInvitationService, IPunchService, IApprovalService, ISummaryService,
│   │                    # ICompanyAccessPolicy, IScheduleResolver, IClock
│   └── Services/        # implementações + DayEvaluator, WorkHoursCalculator, CompanyClock (fuso)
├── Pontua.Infra/
│   ├── Context/         # PontuaContext (Fluent API, ValueConverter UTC)
│   ├── Repository/      # implementações + NsrAllocator (UPDATE … RETURNING) + UnitOfWork
│   ├── AppServices/     # GoogleTokenAppService
│   └── Migrations/      # inclui trigger punches_immutable
├── Pontua.Application/
│   └── Startup.cs       # DI centralizado, JWT, CORS, FluentValidation, health checks
├── Pontua.API/
│   ├── Controllers/     # Auth, Companies, Positions, Members, Invitations, Punches, Approvals, Summary
│   ├── Extensions/      # ClaimsPrincipal.GetUserId(), ErrorResult mapping
│   ├── Program.cs
│   ├── appsettings.json / appsettings.{Development,Docker,Production}.json
│   └── Pontua.API.http
└── Pontua.Tests/
    ├── Domain/          # WorkHoursCalculator, DayEvaluator, ScheduleResolver, CompanyAccessPolicy,
    │                    # PunchService, ApprovalService, InvitationService, DateRangeQuery
    └── Integration/     # [Trait("Category","Integration")] NSR concorrente, trigger, idempotência offline
```

**Structure Decision**: solução .NET única em `backend/`, seguindo as camadas da skill
`dotnet-architecture` com `Pontua.API` como camada de apresentação. A pasta `frontend/` não é
criada nesta feature.

### Execução por agente (Princípio VIII)

| Escopo | Agente |
|---|---|
| Todo o código e testes em `backend/` | `dotnet-senior-developer` |
| Frontend / layout | — (fora desta feature) |

### Fluxos-chave de design

- **Marcação normal** (`PunchService.PunchAsync`): `AccessPolicy.RequireMember` → `IClock.UtcNow`
  → `work_date` no fuso da empresa → checa intervalo de 60 s → `ScheduleResolver.Resolve(membro,
  work_date)` decide `Valid` ou `Pending/OutsideWorkday` → `IUnitOfWork` abre transação →
  `INsrAllocator.NextAsync(companyId)` (lock da linha da empresa) → insere `punches` +
  `punch_status_changes` → commit → `DayEvaluator` calcula `periodName` para a resposta.
- **Correção aprovada** (`ApprovalService.ApproveAsync`): `RequireCanSupervise(autor)` e
  bloqueio de autoaprovação de gestor → transação → correção `Pending → Approved` e original
  `→ Superseded`, cada uma com linha em `punch_status_changes`.
- **Painel** (`ApprovalService.GetPanelAsync`): escopo de membros por papel → 3 consultas
  (membros+cargos, jornadas, marcações do intervalo por `(company_id, work_date)`) → avaliação
  em memória por (membro, dia) com `ScheduleResolver` + `DayEvaluator` → agrupado por dia.

## Complexity Tracking

Nenhuma violação da constituição a justificar.
