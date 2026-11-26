# API Contract: Pontua Backend v1

Base: `/api`. JSON em camelCase (`[JsonPropertyName]` em todos os DTOs). Instantes em ISO-8601
UTC (`2026-11-25T11:03:00Z`); datas `yyyy-MM-dd` e horários `HH:mm` sempre no **fuso da
empresa**. Durações em minutos inteiros. Enums como string (`"weekly"`, `"pending"`…).

**Autenticação**: `Authorization: Bearer {jwt}` em todos os endpoints, exceto os marcados com
🔓.

**Permissões** (por empresa): 👤 membro ativo · 👁 responsável ou gestor do cargo do membro alvo
· 👑 só o responsável. Usuário sem vínculo ativo com a empresa → **404**.

**Filtro de datas** (`DateRange`, FR-026): `?month=2026-11` **ou** `?start=2026-11-01&end=2026-11-15`
(inclusivos). Sem parâmetros → mês corrente. 400 se combinar os dois, `start > end` ou
intervalo > 366 dias.

**Envelope de erro** (toda resposta ≠ 2xx):

```json
{ "sucesso": false, "mensagem": "A justificativa é obrigatória.", "erros": [ { "campo": "justification", "mensagem": "..." } ] }
```

| Status | Quando |
|---|---|
| 400 | validação de entrada |
| 401 | não autenticado, token inválido/expirado, credenciais inválidas |
| 403 | membro sem permissão (não é responsável / não é gestor do cargo / gestor analisando a própria marcação) |
| 404 | recurso inexistente ou empresa sem vínculo ativo |
| 409 | conflito: e-mail em uso, já é membro, marcação não está pendente, cargo com histórico, original já substituída |
| 422 | regra de negócio: marcação < 60 s após a anterior, fora do limite retroativo, horário no futuro, convite expirado/revogado, desativar responsável, cargo com membros ativos |
| 500 | erro inesperado — `StatusCode(500, ex.Message)` (Princípio VII) |

---

## Auth

| Método | Rota | Descrição |
|---|---|---|
| 🔓 `POST` | `/api/auth/register` | `{ name, email, password }` (senha ≥ 8) → `201 AuthResult`; 409 e-mail em uso |
| 🔓 `POST` | `/api/auth/login` | `{ email, password }` → `200 AuthResult`; 401 `"E-mail ou senha inválidos."` |
| 🔓 `POST` | `/api/auth/google` | `{ idToken }` → `200 AuthResult` (`isNewUser` quando criado agora); 401 token inválido; 404 login com Google desabilitado (ver nota) |
| `GET` | `/api/auth/me` | `UserInfo` |
| `PUT` | `/api/auth/me` | `{ name }` → `UserInfo` |
| `PUT` | `/api/auth/me/password` | `{ currentPassword?, newPassword }` (`currentPassword` obrigatório se já houver senha) → 204 |

```json
// AuthResult
{ "token": "eyJ...", "expiresAt": "2026-11-25T23:00:00Z", "isNewUser": false, "user": { /* UserInfo */ } }
// UserInfo
{ "userId": 7, "name": "Ana Silva", "email": "ana@ex.com", "hasPassword": true, "hasGoogle": false }
```

**Nota — login com Google opcional**: o login com Google só fica habilitado quando `Google__ClientId`
(`Google:ClientId`) está configurado. Sem ele (ausente, vazio ou só espaços) a API sobe normalmente,
os demais endpoints de Auth funcionam e `POST /api/auth/google` responde **404** sem consultar o
Google (o PWA também esconde o botão quando `VITE_GOOGLE_CLIENT_ID` está vazio):

```json
{ "sucesso": false, "mensagem": "Login com Google não está habilitado neste ambiente.", "erros": [] }
```

---

## Companies

| Método | Rota | Descrição | Perm. |
|---|---|---|---|
| `GET` | `/api/companies` | empresas do usuário (membro ativo) → `CompanySummary[]` | autenticado |
| `POST` | `/api/companies` | `{ name, document?, timeZone? }` → `201 CompanyInfo`; criador vira responsável e membro (FR-004), com o cargo inicial "Responsável" (ver nota) | autenticado |
| `GET` | `/api/companies/{companyId}` | `CompanyInfo` | 👤 |
| `PUT` | `/api/companies/{companyId}` | `{ name, document?, timeZone, manualRetroDays }` → `CompanyInfo` | 👑 |
| `POST` | `/api/companies/{companyId}/transfer-ownership` | `{ memberId }` → `CompanyInfo` (FR-006); alvo deve ser membro ativo; se era gestor, perde a designação | 👑 |

**Nota — responsável sem cargo**: ao criar a empresa, o sistema cria automaticamente o cargo
`"Responsável"` com jornada semanal padrão (seg–sex, Entrada 08:00, Pausa 12:00, Retorno 13:00,
Saída 17:00; 8 h/dia; 40 h/semana) e o atribui ao criador, para que ele possa marcar ponto de
imediato. O cargo é editável como qualquer outro.

```json
// CompanySummary
{ "companyId": 3, "name": "Padaria Sol", "isOwner": true, "isManager": false, "memberId": 12, "positionName": "Responsável" }
// CompanyInfo
{ "companyId": 3, "name": "Padaria Sol", "document": "12345678000190", "timeZone": "America/Sao_Paulo",
  "manualRetroDays": 30, "owner": { "memberId": 12, "userId": 7, "name": "Ana Silva" },
  "myAccess": { "memberId": 12, "isOwner": true, "isManager": false, "managedPositionIds": [] },
  "createdAt": "..." }
```

---

## Positions (cargos) e jornadas

| Método | Rota | Descrição | Perm. |
|---|---|---|---|
| `GET` | `/api/companies/{companyId}/positions` | `PositionInfo[]` (com jornada vigente hoje e nº de membros ativos) | 👤 |
| `POST` | `/api/companies/{companyId}/positions` | `{ name, schedule: ScheduleInput }` → `201 PositionInfo` | 👑 |
| `GET` | `/api/companies/{companyId}/positions/{positionId}` | `PositionInfo` + `scheduleHistory: ScheduleInfo[]` | 👤 |
| `PUT` | `/api/companies/{companyId}/positions/{positionId}` | `{ name }` → `PositionInfo` | 👑 |
| `PUT` | `/api/companies/{companyId}/positions/{positionId}/schedule` | `ScheduleInput` → `ScheduleInfo` (nova versão; FR-012) | 👑 |
| `DELETE` | `/api/companies/{companyId}/positions/{positionId}` | 204; 422 com membros ativos; 409 com histórico | 👑 |

```json
// ScheduleInput — modo semanal (FR-009/010)
{
  "mode": "weekly",
  "effectiveFrom": "2026-12-01",          // opcional; padrão hoje; não pode ser passado
  "weeklyMinutes": 2640,                  // 44 h
  "workDays": [1, 2, 3, 4, 5],            // 0 = domingo
  "dailyMinutes": 528,                    // só no modo semanal
  "periods": [                            // só no modo semanal
    { "name": "Entrada", "expectedTime": "08:00" },
    { "name": "Pausa",   "expectedTime": "12:00" },
    { "name": "Retorno", "expectedTime": "13:00" },
    { "name": "Saída",   "expectedTime": "17:48" }
  ]
}
// ScheduleInput — modo diário
{
  "mode": "daily",
  "weeklyMinutes": 2640,
  "days": [
    { "dayOfWeek": 1, "dailyMinutes": 480, "periods": [ { "name": "Entrada", "expectedTime": "08:00" }, { "name": "Saída", "expectedTime": null } ] },
    { "dayOfWeek": 6, "dailyMinutes": 240, "periods": [ { "name": "Entrada", "expectedTime": "08:00" }, { "name": "Saída", "expectedTime": "12:00" } ] }
  ]
}
// ScheduleInfo
{ "scheduleId": 9, "mode": "weekly", "effectiveFrom": "2026-12-01", "weeklyMinutes": 2640,
  "days": [ { "dayOfWeek": 1, "dailyMinutes": 528, "periods": [ { "sequence": 1, "name": "Entrada", "expectedTime": "08:00" } ] } ] }
// PositionInfo
{ "positionId": 4, "name": "Atendente", "activeMembers": 6, "currentSchedule": { /* ScheduleInfo */ } }
```

`ScheduleInfo.days` vem sempre expandido por dia útil, nos dois modos.

---

## Members

| Método | Rota | Descrição | Perm. |
|---|---|---|---|
| `GET` | `/api/companies/{companyId}/members?status=active\|inactive\|all&positionId=` | `MemberInfo[]` (gestor vê só os membros dos seus cargos) | 👁 |
| `GET` | `/api/companies/{companyId}/members/me` | `MemberInfo` do chamador, com jornada vigente | 👤 |
| `GET` | `/api/companies/{companyId}/members/{memberId}` | `MemberInfo` + `positionHistory` + `scheduleHistory` | 👁 ou o próprio |
| `PUT` | `/api/companies/{companyId}/members/{memberId}/position` | `{ positionId, effectiveFrom? }` → `MemberInfo` (FR-012) | 👑 |
| `PUT` | `/api/companies/{companyId}/members/{memberId}/schedule` | `ScheduleInput` (jornada/dias úteis próprios, FR-011) → `ScheduleInfo` | 👑 |
| `DELETE` | `/api/companies/{companyId}/members/{memberId}/schedule?effectiveFrom=` | volta à jornada do cargo (versão `inheritsPosition`) → 204 | 👑 |
| `POST` | `/api/companies/{companyId}/members/{memberId}/deactivate` | 204; 422 se for o responsável | 👑 |
| `POST` | `/api/companies/{companyId}/members/{memberId}/reactivate` | 204 | 👑 |
| `PUT` | `/api/companies/{companyId}/members/{memberId}/manager` | `{ isManager, positionIds: [] }` → `MemberInfo` (FR-022c); `isManager=false` limpa os cargos | 👑 |

```json
// MemberInfo
{ "memberId": 15, "userId": 22, "name": "João Lima", "email": "joao@ex.com", "status": "active",
  "isOwner": false, "isManager": true, "managedPositionIds": [4],
  "position": { "positionId": 4, "name": "Atendente" }, "hasOwnSchedule": false,
  "joinedAt": "...", "currentSchedule": { /* ScheduleInfo */ } }
```

---

## Invitations

| Método | Rota | Descrição | Perm. |
|---|---|---|---|
| `GET` | `/api/companies/{companyId}/invitations?{DateRange}&status=active\|expired\|revoked` | `InvitationInfo[]` | 👑 |
| `POST` | `/api/companies/{companyId}/invitations` | `{ positionId, expiresInDays? }` (1–30, padrão 7) → `201 InvitationInfo` | 👑 |
| `POST` | `/api/companies/{companyId}/invitations/{invitationId}/revoke` | 204 | 👑 |
| 🔓 `GET` | `/api/invitations/{token}` | `{ companyName, positionName, status, expiresAt }`; 404 token inexistente | público |
| `POST` | `/api/invitations/{token}/accept` | → `CompanySummary` (FR-014); 422 expirado/revogado; 409 já é membro ativo | autenticado |

```json
// InvitationInfo
{ "invitationId": 5, "position": { "positionId": 4, "name": "Atendente" }, "token": "q3...",
  "url": "https://pontua.site/convite/q3...", "status": "active", "expiresAt": "...",
  "acceptedCount": 3, "createdBy": "Ana Silva", "createdAt": "..." }
```

---

## Punches (marcações)

| Método | Rota | Descrição | Perm. |
|---|---|---|---|
| `POST` | `/api/companies/{companyId}/punches` | sem corpo; marcação normal com horário do servidor → `201 PunchInfo` (FR-016/017/021) | 👤 |
| `POST` | `/api/companies/{companyId}/punches/offline` | `{ items: [ { clientId, punchedAt } ] }` (1–50) → `200 OfflineSyncResult` (FR-017a) | 👤 |
| `POST` | `/api/companies/{companyId}/punches/manual` | `{ workDate, time, justification, replacesPunchId? }` → `201 PunchInfo` (FR-018/018a/019) | 👤 |
| `POST` | `/api/companies/{companyId}/punches/{punchId}/cancel` | 204; só o autor, só `pending` manual (FR-020) | 👤 |
| `GET` | `/api/companies/{companyId}/punches/me?{DateRange}` | `DayRecord[]` do chamador (histórico por dia) | 👤 |
| `GET` | `/api/companies/{companyId}/members/{memberId}/punches?{DateRange}` | `DayRecord[]` do membro (FR-028) | 👁 ou o próprio |
| `GET` | `/api/companies/{companyId}/punches/{punchId}` | `PunchInfo` + `statusHistory` | 👁 ou o autor |

```json
// PunchInfo
{ "punchId": 881, "nsr": 1042, "memberId": 15, "kind": "normal" /* normal|manual|offline */,
  "punchedAt": "2026-11-25T11:02:41Z", "workDate": "2026-11-25", "localTime": "08:02",
  "receivedAt": "2026-11-25T11:02:41Z", "status": "valid" /* valid|pending|approved|rejected|cancelled|superseded */,
  "pendingReason": null /* manual|outsideWorkday|offline */, "justification": null,
  "replacesPunchId": null, "periodName": "Entrada" /* calculado; null = extra */,
  "countsAsWorked": true,
  "review": null /* { "by": "Ana Silva", "at": "...", "note": "..." } */ }
// OfflineSyncResult
{ "items": [ { "clientId": "8f1c...", "result": "created" /* created|duplicate|future|too_old */, "punch": { /* PunchInfo */ } } ] }
// DayRecord
{ "date": "2026-11-25", "isWorkDay": true, "expectedMinutes": 528, "workedMinutes": 530,
  "balanceMinutes": 2, "incomplete": false, "hasPending": false,
  "periods": [ { "sequence": 1, "name": "Entrada", "expectedTime": "08:00", "punchId": 881 } ],
  "punches": [ /* PunchInfo[] — inclui todos os status, ordenados por horário */ ] }
```

Dias sem nenhuma marcação aparecem em `DayRecord[]` (com `punches: []`), para que o frontend
mostre o calendário completo do período.

---

## Approvals (painel do responsável/gestor)

| Método | Rota | Descrição | Perm. |
|---|---|---|---|
| `GET` | `/api/companies/{companyId}/approvals?{DateRange}&type=all\|missing\|pending&positionId=` | `PendingPanelDay[]` (FR-023) | 👁 (escopo pelos cargos do gestor) |
| `POST` | `/api/companies/{companyId}/punches/{punchId}/approve` | `{ note? }` → `PunchInfo` (FR-024) | 👁; 403 se for a própria marcação de um gestor |
| `POST` | `/api/companies/{companyId}/punches/{punchId}/reject` | `{ note? }` → `PunchInfo` | 👁; idem |

```json
// PendingPanelDay
{ "date": "2026-11-24",
  "members": [
    { "memberId": 15, "name": "João Lima", "position": "Atendente",
      "situation": "pending" /* missing|pending */, "isWorkDay": true,
      "punches": [ /* PunchInfo[] do dia, todos os status, com justification e pendingReason */ ] }
  ] }
```

Ordenação: dias decrescentes; dentro do dia, membros por nome.

---

## Summary (resumo de horas — FR-027)

| Método | Rota | Descrição | Perm. |
|---|---|---|---|
| `GET` | `/api/companies/{companyId}/summary/me?{DateRange}` | `HoursSummary` do chamador | 👤 |
| `GET` | `/api/companies/{companyId}/members/{memberId}/summary?{DateRange}` | `HoursSummary` do membro | 👁 ou o próprio |

```json
// HoursSummary
{ "start": "2026-11-01", "end": "2026-11-30",
  "totals": { "workedMinutes": 9420, "expectedMinutes": 9504, "balanceMinutes": -84, "pendingPunches": 2 },
  "weeks": [ { "weekStart": "2026-10-27", "from": "2026-11-01", "to": "2026-11-02", "partial": true,
               "workedMinutes": 0, "expectedMinutes": 0, "balanceMinutes": 0 } ],
  "days": [ { "date": "2026-11-03", "isWorkDay": true, "workedMinutes": 530, "expectedMinutes": 528,
              "balanceMinutes": 2, "incomplete": false } ] }
```

---

## Health

`🔓 GET /health` → `200 Healthy` (inclui verificação do PostgreSQL).
