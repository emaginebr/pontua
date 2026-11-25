# Tasks: Pontua — Núcleo do Backend de Ponto Eletrônico

**Input**: Design documents from `/specs/001-pontua-backend-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: a spec não pede TDD, mas o plano (research R-16) exige testes unitários das regras
críticas (cálculo de horas, resolução de jornada, permissões, marcações, aprovações) e testes de
integração das garantias que só o PostgreSQL verifica (NSR, imutabilidade, idempotência). Eles
estão incluídos nas fases das histórias correspondentes.

**Organization**: tarefas agrupadas por história de usuário (US1–US7 da spec).

**Agente executor (Princípio VIII)**: **todas** as tarefas deste arquivo ficam em `backend/` e
DEVEM ser executadas pelo agente `dotnet-senior-developer`, seguindo as skills
`dotnet-architecture`, `dotnet-fluent-validation` e `dotnet-test`. A sessão principal só
orquestra e revisa.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa pendente)
- **[Story]**: história de usuário da spec (US1…US7)

## Path Conventions

Solução .NET em `backend/` com os projetos `Pontua.DTO`, `Pontua.Domain`,
`Pontua.Infra.Interfaces`, `Pontua.Infra`, `Pontua.Application`, `Pontua.API` e
`Pontua.Tests` (ver plan.md › Project Structure). Referências de contrato: `contracts/api.md`;
tabelas e regras: `data-model.md`; decisões: `research.md` (R-xx).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: criar a solução e os projetos com as dependências da stack fixa.

- [X] T001 Criar `backend/Pontua.sln` e os projetos `net8.0`: `Pontua.DTO` (classlib), `Pontua.Domain` (classlib), `Pontua.Infra.Interfaces` (classlib), `Pontua.Infra` (classlib), `Pontua.Application` (classlib), `Pontua.API` (webapi) e `Pontua.Tests` (xunit), com as referências entre camadas da skill `dotnet-architecture` (API → Application → Infra → Infra.Interfaces → Domain → DTO; Tests → todos)
- [X] T002 Adicionar pacotes NuGet: EF Core 9.x + `Npgsql.EntityFrameworkCore.PostgreSQL` 9.x e `Microsoft.EntityFrameworkCore.Design` em `backend/Pontua.Infra/Pontua.Infra.csproj` (e Design em `Pontua.API`); `Google.Apis.Auth` em `Pontua.Infra`; `FluentValidation` 11.x, `Microsoft.Extensions.Identity.Core` 8.x e `System.IdentityModel.Tokens.Jwt` em `Pontua.Domain`; `Microsoft.AspNetCore.Authentication.JwtBearer` 8.x, `FluentValidation.DependencyInjectionExtensions` e `AspNetCore.HealthChecks.NpgSql` em `Pontua.Application`; `Swashbuckle.AspNetCore` 8.x em `Pontua.API`; `Moq`, `FluentAssertions` 6.x e `Microsoft.EntityFrameworkCore.InMemory` em `Pontua.Tests`
- [X] T003 [P] Criar `backend/.gitignore` (bin/, obj/, appsettings.*.local.json) e `backend/README.md` curto apontando para `specs/001-pontua-backend-core/quickstart.md`
- [X] T004 [P] Criar `backend/Pontua.API/appsettings.json`, `appsettings.Development.json`, `appsettings.Docker.json` e `appsettings.Production.json` com as seções `ConnectionStrings:PontuaContext`, `Jwt:{Secret,ExpirationHours=12,Issuer=pontua,Audience=pontua}`, `Google:ClientId`, `App:FrontendBaseUrl`, `Cors:AllowedOrigins` (segredos vazios fora de Development)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: modelo de dados completo, contexto, migração inicial, autenticação JWT, política de acesso, relógio/fuso, resolução de jornada e tratamento de erros — usados por todas as histórias.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase.

### Domínio e DTOs comuns

- [X] T005 [P] Criar enums `MemberStatus`, `ScheduleMode`, `PunchKind`, `PunchStatus` (inclui `Superseded = 6`) e `PendingReason` em `backend/Pontua.Domain/Enums/` conforme data-model.md › Enums
- [X] T006 [P] Criar exceções de domínio `ValidationException` (com lista campo/mensagem), `NotFoundException`, `ForbiddenException`, `ConflictException` e `BusinessRuleException` em `backend/Pontua.Domain/Exceptions/`
- [X] T007 [P] Criar `ErrorResult` (`sucesso`, `mensagem`, `erros[{campo,mensagem}]`, `[JsonPropertyName]` camelCase) em `backend/Pontua.DTO/ErrorResult.cs` e `JwtSettings`, `GoogleSettings`, `AppSettings` (FrontendBaseUrl) em `backend/Pontua.DTO/Settings/`
- [X] T008 [P] Criar `DateRangeQuery` (`month`, `start`, `end`) em `backend/Pontua.DTO/Common/DateRangeQuery.cs` e o resolvedor `DateRangeResolver.Resolve(query, todayLocal)` em `backend/Pontua.Domain/Services/DateRangeResolver.cs` com as regras de R-14 (mês corrente por padrão; não combinar `month` com `start/end`; `start ≤ end`; ≤ 366 dias → `ValidationException`)
- [X] T009 [P] Criar os modelos de domínio `User`, `Company`, `Position`, `Member`, `MemberPosition`, `ManagerPosition`, `Schedule`, `ScheduleDay`, `SchedulePeriod`, `Invitation`, `Punch` e `PunchStatusChange` em `backend/Pontua.Domain/Models/` com os campos de data-model.md; `Punch` sem setters públicos e com método único `ChangeStatus(newStatus, userId, note, utcNow)` que devolve o `PunchStatusChange` (R-04)

### Persistência

- [X] T010 Criar `PontuaContext` em `backend/Pontua.Infra/Context/PontuaContext.cs` com Fluent API para as 12 tabelas (nomes snake_case, PK `{tabela}_pkey`, FKs `fk_{pai}_{filho}` com `DeleteBehavior.ClientSetNull`, `varchar` com tamanho, índices únicos e parciais de data-model.md, check `schedules_owner_ck`) e `ValueConverter` que grava/lê `DateTime` como UTC em `timestamp without time zone` (depende de T009)
- [X] T011 Criar interfaces de repositório em `backend/Pontua.Infra.Interfaces/Repository/`: `IUserRepository`, `ICompanyRepository`, `IPositionRepository`, `IMemberRepository`, `IScheduleRepository`, `IInvitationRepository`, `IPunchRepository` (somente `InsertAsync`, `UpdateStatusAsync`, consultas — sem Update genérico nem Delete), `INsrAllocator` (`NextAsync(companyId)`) e `IUnitOfWork` (`BeginTransactionAsync`, `CommitAsync`)
- [X] T012 Implementar os repositórios em `backend/Pontua.Infra/Repository/` (um arquivo por interface de T011), `UnitOfWork.cs` e `NsrAllocator.cs` com `UPDATE companies SET last_nsr = last_nsr + 1 WHERE company_id = {id} RETURNING last_nsr` via `Database.SqlQuery` dentro da transação corrente (R-05) (depende de T010, T011)
- [X] T013 Gerar a migração inicial `InitialCreate` em `backend/Pontua.Infra/Migrations/` e acrescentar, via `migrationBuilder.Sql`, a função/trigger PL/pgSQL `punches_immutable` que bloqueia `DELETE` e qualquer `UPDATE` de colunas diferentes de `status` em `punches` (R-04), com o `Down` removendo trigger e função (depende de T010)

### Serviços transversais

- [X] T014 [P] Criar `IClock` (`UtcNow`) e `SystemClock` em `backend/Pontua.Domain/Interfaces/IClock.cs` e `backend/Pontua.Domain/Services/SystemClock.cs`, e `CompanyClock` em `backend/Pontua.Domain/Services/CompanyClock.cs` com `ToLocal(utc, timeZoneId)`, `ToUtc(date, time, timeZoneId)`, `TodayLocal(timeZoneId)` e validação de ID IANA (R-06)
- [X] T015 Criar `IScheduleResolver` e `ScheduleResolver` em `backend/Pontua.Domain/Interfaces/IScheduleResolver.cs` e `backend/Pontua.Domain/Services/ScheduleResolver.cs`: dado o membro, as versões de `member_positions` e de `schedules` (cargo e membro), devolve `ResolvedSchedule` para uma data (modo, é dia útil, carga diária, carga semanal, períodos do dia) seguindo R-08, incluindo `inherits_position`; método em lote para (membros × intervalo) sem N+1 (depende de T009)
- [X] T016 Criar `DayEvaluator` e `WorkHoursCalculator` em `backend/Pontua.Domain/Services/`: associação das marcações efetivas (`Valid`, `Approved`, `Pending`) aos períodos pela ordem de horário (R-07), minutos trabalhados por pares só com `Valid`/`Approved`, `incomplete`, `missing`, `hasPending`, saldo diário e semanas seg–dom com semanas parciais somando cargas diárias (R-09) (depende de T009)
- [X] T017 Criar `ICompanyAccessPolicy` e `CompanyAccessPolicy` em `backend/Pontua.Domain/Interfaces/ICompanyAccessPolicy.cs` e `backend/Pontua.Domain/Services/CompanyAccessPolicy.cs`: `GetContextAsync(companyId, userId)` → `AccessContext { MemberId, IsOwner, IsManager, ManagedPositionIds }`; `RequireMember` (404 sem vínculo ativo), `RequireOwner` (403), `RequireCanSupervise(targetMemberId, date)` (responsável sempre; gestor só se o cargo do alvo na data estiver em `ManagedPositionIds`; 403) (R-03) (depende de T011)
- [X] T018 [P] Criar `ITokenService` e `TokenService` (JWT HMAC-SHA256 com `sub` = userId, expiração `Jwt:ExpirationHours`) em `backend/Pontua.Domain/Interfaces/ITokenService.cs` e `backend/Pontua.Domain/Services/TokenService.cs`
- [X] T019 Criar `backend/Pontua.Application/Startup.cs` com DI centralizado (contexto Npgsql, repositórios, serviços, `IClock`, validadores FluentValidation por assembly), `JwtBearer` exigindo `Jwt:Secret` com ≥ 32 bytes (falha no startup caso contrário), CORS aberto só em Development e por `Cors:AllowedOrigins` nos demais, enums serializados como string camelCase e health check do PostgreSQL (depende de T012, T014–T018)
- [X] T020 Criar `backend/Pontua.API/Program.cs` (Swagger com esquema Bearer, `/health`, `UseAuthentication/UseAuthorization`) e `backend/Pontua.API/Extensions/ClaimsPrincipalExtensions.cs` (`GetUserId()`) e `backend/Pontua.API/Extensions/ControllerErrorExtensions.cs` com o mapeamento padrão das exceções de domínio para 400/403/404/409/422 + `ErrorResult`, a ser usado em todos os controllers antes do `catch (Exception ex) { return StatusCode(500, ex.Message); }` (Princípio VII) (depende de T019)
- [X] T021 [P] Testes unitários de `DateRangeResolver` em `backend/Pontua.Tests/Domain/DateRangeResolverTests.cs` (mês padrão, mês explícito, intervalo, combinação inválida, start > end, > 366 dias)
- [X] T022 [P] Testes unitários de `ScheduleResolver` em `backend/Pontua.Tests/Domain/ScheduleResolverTests.cs` (semanal, diário, troca de vigência no meio do intervalo, jornada própria do membro, `inherits_position`, mudança de cargo com vigência)
- [X] T023 [P] Testes unitários de `DayEvaluator`/`WorkHoursCalculator` em `backend/Pontua.Tests/Domain/WorkHoursCalculatorTests.cs` (4 marcações, ímpar = incomplete, pendente não conta, extra, jornada flexível sem horário, dia não útil com carga 0, semana parcial)
- [X] T024 [P] Testes unitários de `CompanyAccessPolicy` em `backend/Pontua.Tests/Domain/CompanyAccessPolicyTests.cs` (sem vínculo → 404, membro comum → 403 em owner, gestor dentro/fora do escopo, responsável sempre)

**Checkpoint**: banco migrável, API sobe com Swagger e `/health`, regras de calendário/horas testadas.

---

## Phase 3: User Story 1 - Conta e criação de empresa (Priority: P1) 🎯 MVP

**Goal**: cadastro/login (e-mail+senha e Google) e criação de empresa com o criador como responsável e membro, já com o cargo "Responsável" e jornada padrão.

**Independent Test**: registrar → `POST /api/companies` → `GET /api/companies` mostra `isOwner: true` e cargo "Responsável"; outro usuário recebe 404 em `GET /api/companies/{id}` (quickstart passo 1).

- [X] T025 [P] [US1] Criar DTOs `RegisterInfo`, `LoginInfo`, `GoogleLoginInfo`, `AuthResult`, `UserInfo`, `UserUpdateInfo`, `PasswordUpdateInfo` em `backend/Pontua.DTO/Auth/` conforme contracts/api.md › Auth
- [X] T026 [P] [US1] Criar DTOs `CompanyInsertInfo`, `CompanyUpdateInfo`, `CompanyInfo`, `CompanySummary`, `MyAccessInfo` em `backend/Pontua.DTO/Companies/`
- [X] T027 [P] [US1] Criar validadores `RegisterInfoValidator` (nome, e-mail, senha ≥ 8), `LoginInfoValidator`, `PasswordUpdateInfoValidator`, `CompanyInsertInfoValidator` e `CompanyUpdateInfoValidator` (nome ≤ 160, documento só dígitos ≤ 20, fuso IANA válido, `manualRetroDays` 1–365) em `backend/Pontua.Domain/Validators/`
- [X] T028 [P] [US1] Criar `IGoogleTokenAppService` em `backend/Pontua.Infra.Interfaces/AppServices/IGoogleTokenAppService.cs` e `GoogleTokenAppService` em `backend/Pontua.Infra/AppServices/GoogleTokenAppService.cs` (`GoogleJsonWebSignature.ValidateAsync` com `Audience = Google:ClientId`, exige e-mail verificado)
- [X] T029 [US1] Implementar `IAuthService`/`AuthService` em `backend/Pontua.Domain/Interfaces/IAuthService.cs` e `backend/Pontua.Domain/Services/AuthService.cs`: registrar (e-mail em minúsculas, 409 se existir, `PasswordHasher`), login (401 genérico, inclusive conta sem senha), Google (cria conta ou vincula por e-mail, `isNewUser`), `me`, atualizar nome e trocar senha (R-02) (depende de T025, T028)
- [X] T030 [US1] Implementar `ICompanyService`/`CompanyService` em `backend/Pontua.Domain/Interfaces/ICompanyService.cs` e `backend/Pontua.Domain/Services/CompanyService.cs`: criar empresa numa transação com `owner_user_id`, membro ativo (`active_since` = hoje local), cargo "Responsável" com jornada semanal padrão (seg–sex, 4 períodos 08:00/12:00/13:00/17:00, 480 min/dia, 2400 min/semana) e `member_positions` (R-16a); listar empresas do usuário (`CompanySummary`); obter (`RequireMember`); atualizar (`RequireOwner`) (depende de T026, T017)
- [X] T031 [US1] Criar `AuthController` em `backend/Pontua.API/Controllers/AuthController.cs` (`register`, `login`, `google` com `[AllowAnonymous]`; `GET/PUT me`, `PUT me/password`) usando o padrão de erros de T020
- [X] T032 [US1] Criar `CompaniesController` em `backend/Pontua.API/Controllers/CompaniesController.cs` com `GET /api/companies`, `POST /api/companies`, `GET` e `PUT /api/companies/{companyId}` (`[Authorize]`)
- [X] T033 [P] [US1] Testes unitários de `AuthService` e `CompanyService` em `backend/Pontua.Tests/Domain/AuthServiceTests.cs` e `backend/Pontua.Tests/Domain/CompanyServiceTests.cs` (e-mail duplicado, login inválido, vínculo Google, empresa cria responsável + cargo padrão, isolamento entre empresas)

**Checkpoint**: MVP de contas e empresas funcional e testável sozinho.

---

## Phase 4: User Story 2 - Cargos, períodos e jornada de trabalho (Priority: P1)

**Goal**: o responsável cria cargos com jornada semanal ou diária (períodos com horário opcional, dias úteis, carga diária e semanal) versionada por vigência.

**Independent Test**: criar "Atendente" semanal e um cargo diário com sábado de 2 períodos sem horário; `GET .../positions/{id}` mostra os dias expandidos; membro comum recebe 403 ao criar cargo (quickstart passo 2).

- [X] T034 [P] [US2] Criar DTOs `ScheduleInput`, `ScheduleDayInput`, `SchedulePeriodInput`, `ScheduleInfo`, `ScheduleDayInfo`, `SchedulePeriodInfo` em `backend/Pontua.DTO/Schedules/` e `PositionInsertInfo`, `PositionUpdateInfo`, `PositionInfo` em `backend/Pontua.DTO/Positions/` conforme contracts/api.md › Positions
- [X] T035 [P] [US2] Criar `ScheduleInputValidator` em `backend/Pontua.Domain/Validators/ScheduleInputValidator.cs`: modo semanal exige `workDays`, `dailyMinutes` e `periods`; modo diário exige `days` com `dayOfWeek` distintos; ≥ 1 dia útil; 1–12 períodos por dia com nome ≤ 40; `expectedTime` crescente quando informado; `dailyMinutes` 1–1440; `weeklyMinutes` 1–10080; `effectiveFrom` não pode ser passado. E `PositionInsertInfoValidator`/`PositionUpdateInfoValidator` (nome ≤ 80)
- [X] T036 [US2] Criar `ScheduleFactory` em `backend/Pontua.Domain/Services/ScheduleFactory.cs` que converte `ScheduleInput` em `Schedule` + `ScheduleDay[]` + `SchedulePeriod[]` (semanal: `day_of_week` nulo nos períodos) e `Schedule` em `ScheduleInfo` sempre expandido por dia útil (depende de T034)
- [X] T037 [US2] Implementar `IPositionService`/`PositionService` em `backend/Pontua.Domain/Interfaces/IPositionService.cs` e `backend/Pontua.Domain/Services/PositionService.cs`: listar (com jornada vigente hoje e nº de membros ativos), obter com histórico de jornadas, criar com jornada (vigência = hoje), renomear (nome único por empresa → 409), salvar nova versão de jornada (mesma `effectiveFrom` futura substitui; passada → 422), excluir (422 com membros ativos; 409 com histórico) — operações de escrita com `RequireOwner` (depende de T036, T017)
- [X] T038 [US2] Refatorar `CompanyService` (T030) para criar o cargo "Responsável" usando `ScheduleFactory` em `backend/Pontua.Domain/Services/CompanyService.cs`
- [X] T039 [US2] Criar `PositionsController` em `backend/Pontua.API/Controllers/PositionsController.cs` com as 6 rotas de contracts/api.md › Positions
- [X] T040 [P] [US2] Testes unitários de `ScheduleInputValidator`, `ScheduleFactory` e `PositionService` em `backend/Pontua.Tests/Domain/PositionServiceTests.cs` (semanal/diário, jornada flexível, nova vigência futura, exclusão bloqueada)

**Checkpoint**: cargos e jornadas configuráveis; resolução de jornada usa dados reais.

---

## Phase 5: User Story 3 - Convite e entrada na empresa (Priority: P1)

**Goal**: o responsável gera links de convite com cargo; quem aceita vira membro ativo com o cargo e a jornada.

**Independent Test**: gerar convite para "Atendente", consultar o token sem autenticação, aceitar com outra conta, ver o membro na lista; aceitar de novo → 409; convite revogado → 422 (quickstart passo 3).

- [X] T041 [P] [US3] Criar DTOs `InvitationInsertInfo`, `InvitationInfo`, `InvitationPublicInfo` em `backend/Pontua.DTO/Invitations/` e `MemberInfo` (versão básica: id, usuário, status, isOwner, isManager, managedPositionIds, cargo, joinedAt, currentSchedule) em `backend/Pontua.DTO/Members/MemberInfo.cs`
- [X] T042 [P] [US3] Criar `InvitationInsertInfoValidator` (`positionId` obrigatório, `expiresInDays` 1–30) em `backend/Pontua.Domain/Validators/InvitationInsertInfoValidator.cs`
- [X] T043 [US3] Implementar `IInvitationService`/`InvitationService` em `backend/Pontua.Domain/Interfaces/IInvitationService.cs` e `backend/Pontua.Domain/Services/InvitationService.cs`: gerar token de 32 bytes base64url (`RandomNumberGenerator`), montar `url` com `App:FrontendBaseUrl` + `/convite/{token}`, listar com `DateRangeQuery` (por `created_at`) e filtro de situação, revogar, consulta pública, aceitar (ativo → 409; inativo → reativa com `active_since` = hoje e nova `member_positions`; novo → membro + `member_positions`; expirado/revogado → 422; incrementa `accepted_count`) (R-13) (depende de T041, T017)
- [X] T044 [US3] Criar `InvitationsController` em `backend/Pontua.API/Controllers/InvitationsController.cs` com as rotas de empresa (`GET`, `POST`, `revoke`) e as públicas `GET /api/invitations/{token}` (`[AllowAnonymous]`) e `POST /api/invitations/{token}/accept`
- [X] T045 [US3] Criar `IMemberService`/`MemberService` (consultas) em `backend/Pontua.Domain/Interfaces/IMemberService.cs` e `backend/Pontua.Domain/Services/MemberService.cs` com `ListAsync(status, positionId)` (escopo do gestor aplicado) e `GetMeAsync`, e `MembersController` com `GET .../members` e `GET .../members/me` em `backend/Pontua.API/Controllers/MembersController.cs`
- [X] T046 [P] [US3] Testes unitários de `InvitationService` em `backend/Pontua.Tests/Domain/InvitationServiceTests.cs` (aceite novo, duplicado, reativação, expirado, revogado, link montado)

**Checkpoint**: colaboradores entram na empresa pelo link.

---

## Phase 6: User Story 4 - Marcação de ponto (Priority: P1)

**Goal**: o membro registra marcações (normal e offline), consulta histórico por dia e resumo de horas filtrados por mês ou intervalo.

**Independent Test**: membro com jornada de 4 períodos marca 4 vezes num dia útil e vê os 4 períodos no histórico do mês; marcação < 60 s → 422; reenvio offline com o mesmo `clientId` → `duplicate` (quickstart passo 4).

- [X] T047 [P] [US4] Criar DTOs `PunchInfo`, `ReviewInfo`, `DayRecord`, `DayPeriodInfo`, `OfflinePunchBatchInfo`, `OfflinePunchItem`, `OfflineSyncResult`, `OfflineSyncItemResult` em `backend/Pontua.DTO/Punches/` e `HoursSummary`, `SummaryTotalsInfo`, `WeekSummaryInfo`, `DaySummaryInfo` em `backend/Pontua.DTO/Summary/` conforme contracts/api.md › Punches e Summary
- [X] T048 [P] [US4] Criar `OfflinePunchBatchInfoValidator` (1–50 itens, `clientId` não vazio e distinto no lote, `punchedAt` com offset) em `backend/Pontua.Domain/Validators/OfflinePunchBatchInfoValidator.cs`
- [X] T049 [US4] Implementar `IPunchService`/`PunchService` (parte 1) em `backend/Pontua.Domain/Interfaces/IPunchService.cs` e `backend/Pontua.Domain/Services/PunchService.cs`: `PunchAsync` (horário do servidor, `work_date` local, recusa < 60 s após a última normal/offline → 422, dia útil → `Valid` senão `Pending/OutsideWorkday`, transação com `INsrAllocator`, linha inicial em `punch_status_changes`, `periodName` calculado pelo `DayEvaluator`) e `SyncOfflineAsync` (idempotência por `(member_id, client_id)` → `duplicate`, `future` se > agora + 2 min, `too_old` antes do limite retroativo, `kind=Offline`, `Pending/Offline`, `received_at`) (R-10, R-11) (depende de T047, T012, T015, T016)
- [X] T050 [US4] Implementar consultas de histórico no `PunchService`: `GetDaysAsync(memberId, DateRangeQuery)` devolvendo `DayRecord[]` para todos os dias do intervalo (inclusive sem marcações) com períodos previstos, marcações de todos os status ordenadas, previsto/trabalhado/saldo e `hasPending`; `GetPunchAsync(punchId)` com `statusHistory`; permissões: o próprio ou `RequireCanSupervise` (depende de T049)
- [X] T051 [US4] Implementar `ISummaryService`/`SummaryService` em `backend/Pontua.Domain/Interfaces/ISummaryService.cs` e `backend/Pontua.Domain/Services/SummaryService.cs` com `HoursSummary` (totais, semanas seg–dom com `partial`, dias, `pendingPunches`) usando `ScheduleResolver` + `WorkHoursCalculator` (depende de T015, T016)
- [X] T052 [US4] Criar `PunchesController` em `backend/Pontua.API/Controllers/PunchesController.cs` com `POST .../punches`, `POST .../punches/offline`, `GET .../punches/me`, `GET .../members/{memberId}/punches`, `GET .../punches/{punchId}`
- [X] T053 [US4] Criar `SummaryController` em `backend/Pontua.API/Controllers/SummaryController.cs` com `GET .../summary/me` e `GET .../members/{memberId}/summary`
- [X] T054 [P] [US4] Testes unitários de `PunchService` (normal) em `backend/Pontua.Tests/Domain/PunchServiceTests.cs` (dia útil válido, fora do dia útil pendente, 60 s, offline: created/duplicate/future/too_old, período associado, membro inativo → 404)
- [X] T055 [P] [US4] Testes de integração `[Trait("Category","Integration")]` em `backend/Pontua.Tests/Integration/PunchIntegrationTests.cs` contra `PONTUA_TEST_DB`: 50 marcações concorrentes na mesma empresa geram NSR 1..50 sem lacunas; `UPDATE punched_at` e `DELETE` falham pelo trigger; reenvio offline concorrente não duplica

**Checkpoint**: controle de ponto funcional ponta a ponta (MVP de produto com US1–US4).

---

## Phase 7: User Story 5 - Marcação manual com justificativa (Priority: P2)

**Goal**: o membro inclui marcação esquecida ou corrige uma existente com justificativa; fica pendente; pode cancelar.

**Independent Test**: manual sem justificativa → 400; com justificativa para ontem → `manual/pending` e fora das horas; 31 dias atrás com limite 30 → 422; nova correção da mesma original cancela a anterior (quickstart passo 5).

- [X] T056 [P] [US5] Criar `ManualPunchInsertInfo` (`workDate`, `time`, `justification`, `replacesPunchId?`) em `backend/Pontua.DTO/Punches/ManualPunchInsertInfo.cs` e `ManualPunchInsertInfoValidator` (justificativa 5–500, data e hora obrigatórias) em `backend/Pontua.Domain/Validators/ManualPunchInsertInfoValidator.cs`
- [X] T057 [US5] Implementar no `PunchService` `CreateManualAsync`: instante via `CompanyClock.ToUtc`, recusa futuro e antes de `hoje − manual_retro_days` (422), `replacesPunchId` do próprio membro e `Valid`/`Approved` (senão 409), cancelamento automático (`Cancelled`, nota "auto: nova correção") da correção pendente anterior da mesma original na mesma transação, `kind=Manual`, `Pending/Manual`, NSR (FR-018, FR-018a, FR-019) em `backend/Pontua.Domain/Services/PunchService.cs`
- [X] T058 [US5] Implementar no `PunchService` `CancelAsync` (só o autor, só `Pending` com `kind=Manual`, senão 403/409; grava `punch_status_changes`) (FR-020) em `backend/Pontua.Domain/Services/PunchService.cs`
- [X] T059 [US5] Adicionar `POST .../punches/manual` e `POST .../punches/{punchId}/cancel` ao `backend/Pontua.API/Controllers/PunchesController.cs`
- [X] T060 [P] [US5] Testes unitários das marcações manuais em `backend/Pontua.Tests/Domain/ManualPunchTests.cs` (sem justificativa, futuro, limite retroativo, correção de outro membro, correção sobreposta cancela a anterior, cancelamento)

**Checkpoint**: esquecimentos corrigíveis, com trilha de auditoria.

---

## Phase 8: User Story 6 - Painel de pendências e aprovação (Priority: P2)

**Goal**: o responsável (todos) ou o gestor (seus cargos) vê membros sem marcação em dia útil e com pendências, e aprova/rejeita cada marcação.

**Independent Test**: com um membro sem marcação num dia útil e outro com manual pendente, o painel do dia lista os dois; aprovar a manual faz ela contar no resumo; membro comum → 403 (quickstart passo 6).

- [X] T061 [P] [US6] Criar `PendingPanelDay`, `PendingPanelMember` e `PanelQuery` (`type` all/missing/pending, `positionId`) em `backend/Pontua.DTO/Approvals/` e `ReviewInsertInfo` (`note` ≤ 500) com validador em `backend/Pontua.DTO/Punches/ReviewInsertInfo.cs` e `backend/Pontua.Domain/Validators/ReviewInsertInfoValidator.cs`
- [X] T062 [US6] Implementar `IApprovalService`/`ApprovalService` em `backend/Pontua.Domain/Interfaces/IApprovalService.cs` e `backend/Pontua.Domain/Services/ApprovalService.cs` — `GetPanelAsync`: escopo de membros pelo papel, 3 consultas (membros+cargos, jornadas, marcações por `(company_id, work_date)`), membro considerado no dia se `active_since ≤ D` e não desativado em D, situação `missing` (dia útil sem marcação efetiva) ou `pending`, agrupado por dia decrescente e membros por nome (R-12) (depende de T061, T015, T016, T017)
- [X] T063 [US6] Implementar no `ApprovalService` `ApproveAsync`/`RejectAsync`: `RequireCanSupervise(autor, work_date)`, gestor não analisa marcação própria (403), só `Pending` (409), aprovação de correção marca a original como `Superseded` na mesma transação (409 se a original não estiver mais `Valid`/`Approved`), `punch_status_changes` com autor, data e nota (FR-024, FR-025) em `backend/Pontua.Domain/Services/ApprovalService.cs`
- [X] T064 [US6] Criar `ApprovalsController` em `backend/Pontua.API/Controllers/ApprovalsController.cs` com `GET .../approvals`, `POST .../punches/{punchId}/approve` e `POST .../punches/{punchId}/reject`
- [X] T065 [P] [US6] Testes unitários de `ApprovalService` em `backend/Pontua.Tests/Domain/ApprovalServiceTests.cs` (missing/pending, filtro por tipo e cargo, escopo do gestor, autoaprovação de gestor negada, responsável aprova a própria, correção aprovada → original `Superseded`, já analisada → 409, membro desativado fora do painel)

**Checkpoint**: ciclo completo marcação → pendência → aprovação.

---

## Phase 9: User Story 7 - Gestão de membros e transferência de responsabilidade (Priority: P3)

**Goal**: o responsável altera cargo e jornada própria do membro, desativa/reativa, designa gestores por cargo e transfere a responsabilidade.

**Independent Test**: designar gestor do cargo "Atendente" e verificar o escopo no painel; transferir a responsabilidade e verificar que o antigo responsável recebe 403 em `PUT .../positions` (quickstart passo 7).

- [X] T066 [P] [US7] Criar `MemberPositionUpdateInfo` (`positionId`, `effectiveFrom?`), `ManagerUpdateInfo` (`isManager`, `positionIds`) e `TransferOwnershipInfo` (`memberId`) em `backend/Pontua.DTO/Members/` e `backend/Pontua.DTO/Companies/`, com validadores em `backend/Pontua.Domain/Validators/`; completar `MemberInfo` com `positionHistory`, `scheduleHistory` e `hasOwnSchedule`
- [X] T067 [US7] Implementar no `MemberService` `GetAsync` (detalhe com históricos; o próprio ou `RequireCanSupervise`), `ChangePositionAsync` (nova `member_positions`, vigência não passada), `SetOwnScheduleAsync` (versão de jornada do membro via `ScheduleFactory`), `ClearOwnScheduleAsync` (versão `inherits_position`), `DeactivateAsync` (422 para o responsável; limpa gestor e `manager_positions`), `ReactivateAsync` (`active_since` = hoje) e `SetManagerAsync` (cargos devem ser da empresa; `isManager=false` limpa) em `backend/Pontua.Domain/Services/MemberService.cs` (depende de T036, T045)
- [X] T068 [US7] Implementar `TransferOwnershipAsync` no `CompanyService` (alvo membro ativo, senão 422; alvo deixa de ser gestor e perde `manager_positions`; antigo responsável continua membro comum) em `backend/Pontua.Domain/Services/CompanyService.cs`
- [X] T069 [US7] Adicionar ao `MembersController` as rotas `GET .../members/{memberId}`, `PUT .../position`, `PUT`/`DELETE .../schedule`, `POST .../deactivate`, `POST .../reactivate`, `PUT .../manager` em `backend/Pontua.API/Controllers/MembersController.cs`, e `POST .../transfer-ownership` ao `backend/Pontua.API/Controllers/CompaniesController.cs`
- [X] T070 [P] [US7] Testes unitários em `backend/Pontua.Tests/Domain/MemberServiceTests.cs` (mudança de cargo com vigência preserva dias passados, jornada própria prevalece, desativar responsável → 422, desativado não marca ponto, designação de gestor, transferência)

**Checkpoint**: todas as histórias funcionais de forma independente.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: observabilidade, documentação e validação final.

- [X] T071 [P] Adicionar logs estruturados (`ILogger`) em `PunchService`, `ApprovalService`, `CompanyService.TransferOwnershipAsync` e `InvitationService.AcceptAsync` em `backend/Pontua.Domain/Services/` (companyId, memberId, punchId, nsr, status; nunca senha nem token)
- [X] T072 [P] Criar `backend/Pontua.API/Pontua.API.http` com o roteiro do quickstart.md (register, empresa, cargo, convite, aceite, marcações normal/offline/manual, painel, aprovação, gestor, transferência)
- [X] T073 [P] Adicionar comentários XML e `[ProducesResponseType]` nos controllers de `backend/Pontua.API/Controllers/` para o Swagger refletir contracts/api.md
- [X] T074 Revisar índices de `PontuaContext` contra as consultas do painel e do histórico (`(company_id, work_date)`, `(member_id, work_date)`, parcial de pendentes) e gerar migração de ajuste se necessário em `backend/Pontua.Infra/Migrations/` — revisado: os índices existentes cobrem painel, histórico e pendências; `has-pending-model-changes` sem diferenças; nenhuma migração nova
- [X] T075 Rodar `dotnet build` e `dotnet test --filter "Category!=Integration"` em `backend/` sem erros nem warnings novos, e executar o roteiro de validação de `specs/001-pontua-backend-core/quickstart.md` — build sem warnings e 264 testes unitários aprovados (3 de integração ignorados sem `PONTUA_TEST_DB`); **roteiro manual do quickstart pendente**: não há PostgreSQL local (docker proibido pelo Princípio II)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia todas as histórias**.
- **US1 (Phase 3)**: depende só da Foundational.
- **US2 (Phase 4)**: depende da Foundational; T038 refatora código de US1 (T030).
- **US3 (Phase 5)**: depende da Foundational; usa cargos (US2) para testar com cargo diferente de "Responsável", mas funciona com o cargo padrão.
- **US4 (Phase 6)**: depende da Foundational e de US1 (empresa e membro); testável só com o responsável.
- **US5 (Phase 7)**: depende de US4 (`PunchService`, `PunchesController`).
- **US6 (Phase 8)**: depende de US4; US5 fornece as marcações manuais do cenário, mas o painel funciona com marcações fora do dia útil e offline.
- **US7 (Phase 9)**: depende de US2 (`ScheduleFactory`) e US3 (`MemberService`).
- **Polish (Phase 10)**: depois das histórias desejadas.

### User Story Dependencies

```text
Foundational ─┬─ US1 ─┬─ US4 ─┬─ US5
              │       │       └─ US6
              ├─ US2 ─┤
              └─ US3 ─┴─ US7
```

### Within Each User Story

DTOs e validadores → serviços de domínio → controllers → testes da história. Cada serviço que
grava marcação usa a mesma transação para NSR, `punches` e `punch_status_changes`.

### Parallel Opportunities

- Setup: T003 e T004 em paralelo após T001/T002.
- Foundational: T005–T009 em paralelo; T014 e T018 em paralelo com a persistência (T010–T013); testes T021–T024 em paralelo após seus alvos.
- Dentro de cada história, as tarefas [P] de DTOs/validadores/AppServices e de testes.
- Após US1: US2 e US3 podem andar em paralelo; após US4: US5 e US6 em paralelo.

---

## Parallel Example: User Story 4

```text
# DTOs e validador juntos:
Task: "T047 [US4] Criar DTOs de Punches e Summary em backend/Pontua.DTO/Punches/ e backend/Pontua.DTO/Summary/"
Task: "T048 [US4] Criar OfflinePunchBatchInfoValidator em backend/Pontua.Domain/Validators/"

# Depois dos serviços, testes juntos:
Task: "T054 [US4] Testes unitários de PunchService em backend/Pontua.Tests/Domain/PunchServiceTests.cs"
Task: "T055 [US4] Testes de integração em backend/Pontua.Tests/Integration/PunchIntegrationTests.cs"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1): contas e empresas — validar sozinho.
3. Phase 6 (US4) logo em seguida, usando o cargo "Responsável" — entrega o ponto funcionando
   para o próprio responsável (**MVP de produto**).

### Incremental Delivery

US1 → US4 (MVP) → US2 (cargos reais) → US3 (convites, abre para equipes) → US5 (correções) →
US6 (painel e aprovação) → US7 (gestão e gestores) → Polish. Cada incremento é demonstrável
pelo passo correspondente do quickstart.md.

### Execução pelos agentes

Todas as fases são delegadas ao `dotnet-senior-developer` (uma chamada por fase ou por
história), com a sessão principal revisando o resultado e marcando as tarefas concluídas.

---

## Notes

- [P] = arquivos diferentes, sem dependência de tarefa pendente.
- Commitar ao fim de cada tarefa ou grupo lógico.
- Nunca escrever código que atualize colunas de `punches` além de `status` nem que exclua marcações — o trigger fará a operação falhar.
- Não executar `docker`/`docker compose` (Princípio II).
