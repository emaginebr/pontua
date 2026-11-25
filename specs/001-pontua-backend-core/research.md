# Research: Pontua — Núcleo do Backend

**Feature**: `001-pontua-backend-core` | **Date**: 2026-11-25

Decisões técnicas da Fase 0. Nenhum item da Technical Context ficou como NEEDS CLARIFICATION.

---

## R-01 — Runtime e estrutura da solução

- **Decision**: C# 12 / .NET 8 (`net8.0`), compilado com o SDK 9.0.309 instalado. Solução
  `backend/Pontua.sln` com as camadas da skill `dotnet-architecture`: `Pontua.DTO`,
  `Pontua.Domain`, `Pontua.Infra.Interfaces`, `Pontua.Infra`, `Pontua.Application`,
  `Pontua.API` e `Pontua.Tests`.
- **Rationale**: Princípios I e II da constituição; mesmo layout do Finami, o que permite
  reaproveitar padrões e skills.
- **Alternatives considered**: .NET 9 (fora da stack fixa); minimal APIs sem camadas (viola o
  Princípio I).

## R-02 — Autenticação

- **Decision**: JWT Bearer HMAC-SHA256 emitido pela própria API (`POST /api/auth/register`,
  `/login`, `/google`). Senhas com `PasswordHasher<User>` (Microsoft.Extensions.Identity.Core).
  Login Google por ID token validado no backend com `Google.Apis.Auth`
  (`GoogleJsonWebSignature.ValidateAsync`, `aud` = `Google__ClientId`, e-mail verificado). Conta
  Google com o mesmo e-mail de uma conta existente é vinculada a ela. Expiração do token: 12 h.
- **Rationale**: Princípio VI. Para um app de ponto usado diariamente, 12 h cobre o turno sem
  exigir refresh token nesta versão.
- **Alternatives considered**: refresh token (adiado; o PWA faz novo login ao expirar);
  ASP.NET Identity completo (estrutura de tabelas incompatível com o Princípio V).

## R-03 — Multiempresa e autorização

- **Decision**: banco único com `company_id` em todas as tabelas de empresa (sem banco por
  tenant). Rotas aninhadas `/api/companies/{companyId}/...`. Um serviço de domínio
  `CompanyAccessPolicy` resolve, por requisição, o `AccessContext` do usuário na empresa:
  `MemberId`, `IsOwner`, `IsActive`, `ManagedPositionIds`. Cada service chama
  `RequireOwner()`, `RequireMember()` ou `RequireCanSupervise(memberId)`.
  Usuário sem vínculo ativo recebe **404** (não revela a existência da empresa); membro sem
  permissão recebe **403**.
- **Rationale**: um usuário pertence a várias empresas (FR-007), então o tenant não pode estar
  fixo no token; a skill `dotnet-multi-tenant` (banco por tenant) é exagerada para o volume
  previsto.
- **Alternatives considered**: claim de empresa no JWT (exige novo token a cada troca de
  empresa); header `X-Company-Id` (menos explícito que a rota).

## R-04 — Imutabilidade das marcações (Portaria 671, FR-022a)

- **Decision**: em três camadas:
  1. **Domínio**: a entidade `Punch` não expõe setters públicos; o único método de mudança é
     `ChangeStatus(...)`.
  2. **Repositório**: `IPunchRepository` só tem `InsertAsync` e `UpdateStatusAsync` (sem
     `Update` genérico nem `Delete`).
  3. **Banco**: trigger PL/pgSQL `punches_immutable` (criado via `migrationBuilder.Sql`) que
     rejeita `DELETE` e qualquer `UPDATE` que altere colunas além de `status`.
  Toda mudança de status grava uma linha em `punch_status_changes` (de, para, quem, quando,
  observação).
- **Rationale**: garante a preservação mesmo contra erros de código ou acesso direto ao banco,
  que é a exigência da portaria para REP-P.
- **Alternatives considered**: só regra de aplicação (frágil); tabela append-only também para
  o status (complica as consultas do painel sem ganho real, já que o histórico existe).

## R-05 — NSR sequencial sem lacunas (FR-022b)

- **Decision**: coluna `companies.last_nsr bigint`. Na mesma transação do `INSERT` da
  marcação: `UPDATE companies SET last_nsr = last_nsr + 1 WHERE company_id = @id RETURNING
  last_nsr`. O lock de linha serializa as marcações da empresa; um rollback desfaz o
  incremento, sem lacunas. Índice único `(company_id, nsr)`.
- **Rationale**: sequences do PostgreSQL não garantem ausência de lacunas. O lock por empresa
  é aceitável: as marcações de uma empresa são esparsas (picos de dezenas por minuto).
- **Alternatives considered**: `SEQUENCE` por empresa (gera lacunas em rollback);
  `MAX(nsr)+1` (condição de corrida).

## R-06 — Fuso horário e data de trabalho

- **Decision**: instantes gravados em UTC (`timestamp without time zone`, ValueConverter que
  força `DateTimeKind.Utc`). Cada marcação grava também `work_date` (`date`), calculada no fuso
  da empresa (`companies.time_zone`, ID IANA, padrão `America/Sao_Paulo`) no momento do
  registro. Conversões via `TimeZoneInfo.FindSystemTimeZoneById` (o .NET 8 aceita IDs IANA no
  Windows via ICU). Filtros de data recebem `yyyy-MM-dd` interpretado no fuso da empresa.
- **Rationale**: Princípio V (sem timezone na coluna); `work_date` evita recalcular o dia em
  toda consulta e congela o dia mesmo se o fuso da empresa mudar.
- **Alternatives considered**: `timestamptz` (viola o Princípio V); gravar só o horário local
  (perde o instante absoluto).

## R-07 — Associação de marcações a períodos (FR-010a, FR-016)

- **Decision**: o período **não é gravado** na marcação; ele é calculado na leitura pelo
  `DayEvaluator`: as marcações *efetivas* do dia (status `Valid`, `Approved` ou `Pending`,
  excluindo marcações substituídas por correção aprovada) são ordenadas pelo horário e
  associadas aos períodos da jornada vigente na ordem; as que sobram são "extra". A resposta do
  registro de ponto já devolve o nome do período calculado.
- **Rationale**: marcações manuais podem ser inseridas no meio do dia e correções mudam o
  horário; gravar o período criaria dados inconsistentes numa tabela imutável.
- **Alternatives considered**: gravar o período no registro (fica errado após inclusões
  manuais e não pode ser corrigido por causa da imutabilidade).
- **Atualização (achados B-02 e N-02 da revisão do app)**: a associação passa a separar as
  marcações que contam das pendências, para que uma pendência nunca mude o período de uma
  marcação que conta:
  1. **Marcações que contam** (`Valid`, `Approved`) são associadas aos períodos **somente entre
     si**, por ordem de horário; as que sobram são "extra". `DayRecord.periods[].punchId` reflete
     só essa associação.
  2. **Inclusões pendentes** (`Pending` sem `replacesPunchId`: manuais, offline pendentes e fora
     do dia útil) recebem um `periodName` **hipotético** — o período que ocupariam se todas as
     pendências do dia fossem aprovadas, calculado ordenando juntas as que contam e as inclusões
     pendentes. O rótulo vale só para a própria pendente e não altera os das que contam. Num dia
     só com pendentes, elas ficam rotuladas pela ordem entre si. Aprovada a inclusão, ela passa a
     contar e os rótulos se reorganizam pela regra 1.
  3. **Correções pendentes** (`Pending` com `replacesPunchId`) não ocupam período (nem hipotético):
     a original continua no seu lugar até a análise e a correção recebe o **mesmo período** da
     original (se a original não estiver no mesmo dia, a correção fica sem período até ser
     aprovada). Com a correção aprovada, a original vira `Superseded` e sai, e a correção
     `Approved` entra pela ordem de horário; correções canceladas ou rejeitadas não entram.

  Horas trabalhadas (só `Valid`/`Approved`, R-09), `missing` e `hasPending` não mudam. A regra
  vale para todos os usos do `DayEvaluator`: `PunchInfo.periodName`, `DayRecord.periods[].punchId`
  e o painel de aprovações. Motivo: antes, a correção pendente ocupava um período a mais e
  empurrava as seguintes (B-02), e uma inclusão pendente anterior às válidas deslocava os
  períodos delas — ex.: válidas 08:00, 12:00, 13:00, 20:03 + inclusão pendente 07:30 fazia a
  Saída das 20:03 virar "extra" (N-02).

## R-08 — Jornadas com vigência (FR-009 a FR-012)

- **Decision**: tabela `schedules` versionada por `effective_from` (date), pertencente a um
  cargo **ou** a um membro (check constraint: exatamente um). Alterar uma jornada = inserir
  nova versão (nunca editar uma versão já vigente; versões com `effective_from` futuro podem ser
  substituídas). Uma versão de membro com `inherits_position = true` encerra a jornada própria e
  volta à do cargo. Cargo do membro também é versionado em `member_positions`
  (`effective_from`). Resolução para (membro, data D):
  1. versão de membro mais recente com `effective_from ≤ D`; se existir e não herdar, usa-a;
  2. senão, cargo do membro em D (`member_positions`) → versão do cargo mais recente com
     `effective_from ≤ D`.
  Dias trabalhados e carga diária ficam em `schedule_days`; períodos em `schedule_periods`
  (`day_of_week` nulo no modo semanal).
- **Rationale**: FR-012 exige que dias passados continuem avaliados pela jornada da época.
- **Alternatives considered**: guardar a jornada como JSON (dificulta validação e consultas);
  editar no lugar e manter log (a avaliação histórica teria de reconstruir o log).

## R-09 — Cálculo de horas e saldos (FR-027)

- **Decision**: `WorkHoursCalculator` (domínio, puro e testável):
  - **Dia**: marcações que contam (`Valid`, `Approved`) ordenadas; pares consecutivos
    (1ª–2ª, 3ª–4ª…) formam intervalos trabalhados. Número ímpar → dia marcado como
    `incomplete` e a última marcação sem par é ignorada no total. Carga prevista do dia = carga
    diária da jornada se for dia útil, senão 0. Saldo = trabalhado − previsto.
  - **Semana**: semanas de segunda a domingo. Semana inteira dentro do filtro → previsto = carga
    semanal da jornada vigente no primeiro dia útil da semana; semana cortada pelo filtro →
    soma das cargas diárias dos dias dentro do filtro.
  - Valores em minutos inteiros.
- **Rationale**: regra simples, determinística e coerente com o par Entrada/Saída do exemplo
  do usuário.
- **Alternatives considered**: tolerâncias de 5/10 minutos da CLT e horas extras (fora de
  escopo; banco de horas é feature futura).
- **Atualização (revisão pós-US4)**: o previsto de um dia (`expectedMinutes` no resumo e no
  `DayRecord` do histórico) passa a ser **0** nos dias **posteriores a hoje** (no fuso da empresa)
  e nos dias em que o membro **não estava ativo** — antes de `active_since` ou a partir da data
  local de `deactivated_at` (mesma regra de atividade do painel, data-model.md › members). Esses
  dias também nunca são `missing`; `isWorkDay` continua refletindo a jornada, para o calendário.
  Na semana: semana inteira dentro do filtro, toda ela no passado/hoje **e** com o membro ativo
  todos os dias → previsto = carga semanal (`weeklyMinutes`) da jornada vigente no primeiro dia
  útil; caso contrário (semana cortada pelo filtro, semana corrente ainda não encerrada, ingresso
  ou desativação no meio da semana) → soma das cargas diárias dos dias que contam. O total do
  período continua sendo a soma do previsto das semanas. Motivo: o saldo não pode ficar negativo
  por dias que ainda não aconteceram nem por dias em que a pessoa não pertencia à empresa.

## R-10 — Marcação offline (FR-017a)

- **Decision**: `POST /api/companies/{id}/punches/offline` recebe um lote de até 50 itens
  `{ clientId (uuid), punchedAt (instante do aparelho, ISO-8601 com offset) }`. Índice único
  `(member_id, client_id)`: um reenvio devolve a marcação existente com `duplicate: true`
  (idempotente). Regras: `punchedAt` > agora + 2 min → recusado (`future`); anterior ao limite
  retroativo da empresa → recusado (`too_old`). Gravado com `kind = Offline`,
  `status = Pending`, `pending_reason = Offline`, `received_at` = agora. A resposta traz o
  resultado por item.
- **Rationale**: o PWA guarda a fila no IndexedDB e envia tudo quando a conexão volta; lote
  reduz o número de requisições; a tolerância de 2 min evita recusar por pequena diferença de
  relógio.
- **Alternatives considered**: um item por requisição (mais chamadas no reconectar); sem
  idempotência (duplicaria em reenvios após timeout).

## R-11 — Regras de marcação normal e manual

- **Decision**:
  - **Normal** (`POST .../punches`): sem corpo; horário = agora no servidor. Recusa (422) se a
    última marcação normal ou offline do membro na empresa foi há menos de 60 s (FR-021). Dia
    útil (pela jornada vigente) → `Valid`; senão → `Pending` com `pending_reason =
    OutsideWorkday`.
  - **Manual** (`POST .../punches/manual`): `{ workDate, time, justification,
    replacesPunchId? }`. Instante montado no fuso da empresa; recusa se no futuro ou antes de
    `hoje − manual_retro_days`. Justificativa obrigatória (5–500 caracteres). `replacesPunchId`
    deve ser do próprio membro, com status `Valid` ou `Approved`. Se já existe correção
    `Pending` para a mesma original, ela vira `Cancelled` (auto) na mesma transação.
  - **Aprovação de correção**: a correção vira `Approved` e a original vira `Superseded`
    (novo status, fora das horas, mantida consultável — SC-007).
- **Rationale**: atende FR-016 a FR-021 e a nota de edge case sobre correções sobrepostas.
  `Superseded` é um refinamento do FR-022: a spec diz que a correção "substitui" a original, e
  isso precisa ser representado no status sem apagar nada.
- **Alternatives considered**: marcar a original como `Rejected` (semântica errada; o membro
  veria uma rejeição que não houve).

## R-12 — Painel de pendências (FR-023, SC-006)

- **Decision**: `PendingPanelService` monta o resultado em memória a partir de 3 consultas
  indexadas: membros visíveis (por escopo do responsável/gestor), versões de jornada e cargo
  dos membros, e marcações do intervalo (`company_id, work_date`). Para cada (membro, dia) em
  que o membro estava ativo: inclui se (dia útil **e** nenhuma marcação não cancelada/rejeitada)
  → `missing`, ou se houver alguma marcação `Pending` → `pending`. Resultado agrupado por dia,
  com nome do membro, cargo e todas as marcações do dia.
- **Rationale**: 100 membros × 31 dias ≈ 3.100 avaliações e ~9.000 marcações — trivial em
  memória; evita SQL complexo de calendário.
- **Alternatives considered**: `generate_series` em SQL (mais difícil de manter e testar).

## R-13 — Convites

- **Decision**: token aleatório de 32 bytes em base64url (43 caracteres), gravado em claro com
  índice único (o responsável precisa recopiar o link na listagem). Reutilizável até
  `expires_at` (padrão 7 dias, máx. 30) ou `revoked_at`. Contador `accepted_count`. Endpoint
  público `GET /api/invitations/{token}` devolve só nome da empresa, cargo e situação. Aceite
  (`POST /api/invitations/{token}/accept`, autenticado): membro ativo → 409 sem alterar nada;
  membro inativo → reativado com o cargo do convite; senão → novo membro. O link do frontend é
  montado pela API com `App__FrontendBaseUrl` (`{base}/convite/{token}`).
- **Rationale**: convite não é credencial de conta, apenas de entrada numa empresa e
  revogável; guardar hash impediria mostrar o link de novo.
- **Alternatives considered**: hash do token (impede reexibir); convite de uso único
  (decidido na spec: reutilizável).

## R-14 — Filtro de datas (FR-026)

- **Decision**: objeto `DateRangeQuery` comum a todas as listagens: `?month=yyyy-MM` **ou**
  `?start=yyyy-MM-dd&end=yyyy-MM-dd` (inclusivos). Sem parâmetros → mês corrente no fuso da
  empresa. Validação: não combinar `month` com `start/end`; `start ≤ end`; no máximo 366 dias →
  400 com mensagem clara.
- **Rationale**: o frontend filtra por mês por padrão e tem o filtro avançado por data.
- **Alternatives considered**: só intervalo (o frontend teria de calcular o fim do mês).

## R-15 — Validação, erros e logs

- **Decision**: FluentValidation para os DTOs de entrada (skill `dotnet-fluent-validation`).
  Exceções de domínio tipadas (`ValidationException`, `NotFoundException`,
  `ForbiddenException`, `ConflictException`, `BusinessRuleException`) mapeadas no controller
  para 400/404/403/409/422 com envelope `{ sucesso, mensagem, erros }`; o `catch (Exception)`
  final retorna `StatusCode(500, ex.Message)` (Princípio VII). Logs estruturados com
  `ILogger` (registro de ponto, aprovações, transferência de responsabilidade) e health check
  em `/health`.
- **Rationale**: Princípio VII e observabilidade mínima pedida na clarificação.
- **Alternatives considered**: middleware global de exceção (o Princípio VII pede o try/catch
  no controller).

## R-16a — Cargo inicial do responsável

- **Decision**: ao criar a empresa, o sistema cria o cargo "Responsável" com uma jornada semanal
  padrão (seg–sex, Entrada 08:00 / Pausa 12:00 / Retorno 13:00 / Saída 17:00, 8 h/dia,
  40 h/semana) e o atribui ao criador.
- **Rationale**: todo membro precisa de cargo e jornada (spec: "o usuário na empresa deverá ter
  um cargo e um horário de trabalho"); sem isso o responsável não conseguiria marcar ponto nem
  aparecer no painel até configurar um cargo.
- **Alternatives considered**: cargo nulo para o responsável (exigiria tratar "sem jornada" em
  todo cálculo); exigir o cargo no cadastro da empresa (fluxo inicial mais longo).

## R-16 — Testes

- **Decision**: projeto `Pontua.Tests` com xUnit + Moq + FluentAssertions (skill
  `dotnet-test`). Unidade: `WorkHoursCalculator`, `DayEvaluator`, `ScheduleResolver`,
  `CompanyAccessPolicy`, `PunchService`, `ApprovalService`, `InvitationService`,
  `DateRangeQuery`. Integração (`[Trait("Category","Integration")]`, opcional, contra PostgreSQL
  real configurado em `PONTUA_TEST_DB`): NSR sem lacunas sob concorrência, trigger de
  imutabilidade, idempotência offline.
- **Rationale**: NSR e trigger só podem ser verificados num PostgreSQL real; o resto é lógica
  pura.
- **Alternatives considered**: Testcontainers (exige Docker, proibido localmente pela
  constituição).
