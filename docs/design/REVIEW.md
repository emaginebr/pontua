# Pontua — Revisão visual (T070)

Feature `002-pontua-frontend-pwa` · revisão feita em 25/11/2026 por `ux-designer` contra a direção
[Expediente](./DESIGN_DIRECTION.md), [`components.md`](./components.md), [`tokens.css`](./tokens.css)
e os mockups em [`screens/`](./screens/index.html). Ambiente: homologação `http://localhost:8081`
(nginx + API em `/api`), Chrome 158 headless, 360 × 740 (DSF 2, toque) e 1280 × 800.

Destino: `frontend-react-developer` aplica em T071. Nada em `frontend/src` foi alterado aqui.

## Resumo

A implementação segue bem a direção: paleta, tipografia (Plus Jakarta Sans), painel navy do
relógio, botão de ponto dominante na zona do polegar (centro em ≈ 460 px de 740 no celular),
BottomNav/SideNav, contador âmbar de pendências, selos texto + ícone + cor, folhas inferiores no
celular e diálogos centrais no computador. **Nenhuma tela tem rolagem horizontal** (360 e 1280),
todos os `document.title` seguem "{Tela} · Pontua", `lang="pt-BR"`, e o Lighthouse dá 100 em
Acessibilidade nas duas telas medidas.

Os problemas se concentram em três frentes: (1) **marcações pendentes apresentadas como
concluídas** no painel do relógio e correções duplicadas no histórico (informação errada);
(2) um **bug global de borda** nos botões `secondary`/`reject`/`google`; (3) **densidade do
histórico no celular** (linhas espremidas, todos os dias abertos, grupos de folga ilegíveis).

| Severidade | Qtde |
|---|---|
| **Bloqueante** | 3 |
| **Importante** | 17 |
| **Ajuste fino** | 23 |

Dados de teste: empresa "Padaria Revisão" (id 4), responsável Ana Revisão, membro Bruno Carvalho
(cargo Atendente, semanal) e cargo Padeiro (diário); Bruno com 2 marcações normais hoje, 1
correção manual pendente (08:01 substituindo 19:03), 1 inclusão manual pendente (13:02) e
marcações manuais em 18–24/11 (aprovadas, 1 rejeitada, pendentes). Usuária Carla sem empresa para
`/bem-vindo` e convite logado.

Fora do escopo visual (registrado para não ser confundido com desvio):

- **Botão "Continuar com Google" ausente** em login/cadastro/convite: o build de homologação não
  tem `VITE_GOOGLE_CLIENT_ID`; o componente corretamente não renderiza. Validar com a variável.
- **Cartão "Instale o Pontua"** não aparece nas capturas porque a revisão gravou
  `pontua:install-dismissed` e o Chrome headless não dispara `beforeinstallprompt`.
- **Painel de aprovações vazio para 18–24/11**: as marcações manuais desses dias são anteriores à
  entrada do Bruno e à vigência do cargo (dias `isWorkDay=false`), e a API não as lista no painel.
  Comportamento de backend/dados, não de UI. As capturas de Aprovações usam as pendências de hoje.

---

## Achados por tela

Formato: **[ID] Severidade** — o que está errado → o que mudar (referência).

### Login e cadastro (`01-login-*`, `02-cadastro-*`, `02b-login-erro-*`)

- **[I-01] Importante** — Em 1280, o título "Entrar" e o subtítulo não ficam centralizados na
  coluna do formulário (o `h1` aparece deslocado ≈ 100 px à esquerda do centro e o subtítulo
  alinhado à esquerda), apesar do `text-center`. O `PageHeader` usa um contêiner flex em que o
  bloco de título não ocupa a largura toda. → No login (e no cadastro, ver I-02), o bloco de
  título deve ter `w-full` e `items-center`; ou não usar `PageHeader` nas telas públicas e
  renderizar `h1` + `p` centralizados direto (`login.html` §1).
- **[I-02] Importante** — Cadastro em 1280 tem o título "Criar conta" alinhado à esquerda,
  enquanto o login centraliza. → Centralizar título e subtítulo do cadastro igual ao login
  (`login.html` §3).
- O estado de erro (Notice "Corrija 2 campos…", borda 2 px `danger`, ícone + mensagem, foco no
  primeiro campo) está **exatamente** como `components.md` §7.1.

### Boas-vindas (`03-boas-vindas-*`)

Sem desvios. Cartões-botão, textos e largura em 1280 iguais a `welcome.html` §1.

### Ponto (`04-*`, `04b-*`, `04c-*`, `05-*`, `05b-*`)

- **[B-01] Bloqueante (informação errada)** — O painel do relógio trata marcações **pendentes**
  como feitas: Bruno tem Entrada 08:01 e Pausa 13:02 pendentes (manuais), mas o painel mostra `✓`
  verde nos 4 períodos, o texto "Jornada de hoje completa", o anel 100 % e "4 de 4 marcações
  feitas hoje" (`04-ponto-membro-360.png`). A lista "Marcações de hoje" logo abaixo diz
  "Pendente" — as duas partes da tela se contradizem. → Aplicar a regra agora explícita em
  `components.md` §2.1: período coberto só por pendente mostra `Hourglass` (`warning-solid`
  sobre o navy) no lugar do `Check`; texto "Jornada de hoje registrada · 2 pendentes" enquanto
  houver pendente; anel e "N de M" contam só `valid`/`approved`; fila offline usa `CloudUpload`.
- **[I-03] Importante** — Em 360 com a etiqueta "Sem conexão", a linha secundária do botão
  ("Extra · enviada depois") encosta e passa da borda interna do círculo (`05-ponto-offline-360.png`).
  → Na `PunchButton`, limitar o bloco de texto a `max-w-[136px]` (74 % do diâmetro útil de
  184 px), `text-wrap: balance`, e reduzir o `gap` vertical de 8 para 4 px quando a etiqueta
  offline estiver presente (`components.md` §2.2, `clock.html` §5).
- **[I-04] Importante** — Toast de marcação guardada offline usa ícone `Info` azul, sem a faixa
  de 4 px na cor do tipo, e o botão fechar do sonner tem ≈ 20 px no canto superior esquerdo
  (`05b-ponto-offline-fila-*.png`). → Tipo `offline`: ícone `CloudOff` em `offline`, faixa 4 px
  `offline` à esquerda; para todos os tipos, faixa 4 px na cor do tipo; botão `X` 44 × 44 px no
  canto superior **direito**, `aria-label="Fechar"` (`components.md` §8.3).
- **[I-05] Importante (Lighthouse CLS 0,105)** — A zona do botão de ponto desce ≈ 40 px quando
  os dados do dia chegam (o painel ganha a linha "Próxima…"/"Jornada…" e a faixa de períodos).
  → Reservar a altura final do painel no carregamento: o `LoadingState` do `ClockFace` deve
  ter as mesmas linhas (data, hora, linha de status 24 px, faixa de períodos 44 px), ou
  `min-h` igual no painel; meta CLS < 0,1.
- **[I-06] Importante (WCAG 2.5.3 Rótulo no nome)** — Dois nomes acessíveis não começam pelo
  texto visível: o `CompanySwitcher` ("Empresa ativa: Padaria Revisão, Responsável. Trocar de
  empresa" para o visível "Padaria Revisão / Responsável") e a `PunchButton` em espera
  ("Registrar ponto: aguarde 42 segundos" para o visível "Aguarde 42 s / para marcar de novo").
  → `comum:companySwitcher.label` = "{{name}}, {{role}}. Trocar de empresa";
  `ponto:button.waitLabel` = "Aguarde {{seconds}} s para marcar de novo".
- **[A-01] Ajuste fino** — "Próxima: Retorno · **prevista** 13:00" no painel e "Retorno ·
  **previsto** 13:00" no botão/lista. → Usar "previsto" em todos (`clock.html` §1).
- **[A-02] Ajuste fino** — Botão "Confirmar" da `PunchConfirm` sem o ícone `Check` à esquerda
  (`clock.html` §2). → Incluir `Check` 20 px.
- **[A-03] Ajuste fino** — "Esta semana" mostra "23/11–29/11". → "23–29 nov" (formato de
  intervalo curto, `clock.html` §1; DESIGN_DIRECTION §6).
- **[A-04] Ajuste fino** — Na `TopBar`, o link do símbolo (logo) tem 28 × 28 px de área de
  toque. → Envolver com `min-h-touch min-w-touch` (44 px) mantendo o símbolo em 28 px.
- **[A-05] Ajuste fino (verificar)** — Com a rede cortada após o carregamento, "Marcações de
  hoje" não exibe o `StaleDataNotice` "Sem conexão — dados de 25/11 às 19:22" (`clock.html` §5,
  `components.md` §9.2). Confirmar se o aviso aparece quando os dados vêm do cache; se não, incluir.

### Histórico (`06-*`, `06b-*`, `06c-*`, `06d-*`)

- **[B-02] Bloqueante (informação errada)** — No dia de hoje, a mesma correção pendente
  ("Original 19:03 → Correção pedida 08:01") aparece **duas vezes**, sob "Entrada" e sob
  "Retorno", e a inclusão pendente "Pausa 13:02" aparece **antes** de "Entrada"
  (`06-historico-1280.png`, também em `13-membro-detalhe-*`). Duas causas:
  1. **Backend** — `DayRecord.periods` e `PunchInfo.periodName` já contam as pendentes: a
     correção #29 ocupa "Entrada" e empurra a original #5 (19:03, ainda válida) para "Retorno".
     A original deveria continuar no período dela até a correção ser aprovada. Encaminhar ao
     `dotnet-senior-developer` (cálculo de períodos deve ignorar `pending` ou tratá-las à parte).
  2. **Frontend** — o `DayCard` renderiza o par original/correção a partir de cada linha que o
     referencia. → Renderizar cada par **uma vez**, na linha do período da **original**
     (`replacesPunchId`); ordenar as linhas por `sequence` do período e, para extras, pelo
     horário (`components.md` §3.3).
- **[I-07] Importante** — Em 360 a linha da marcação reserva uma coluna à direita para horário +
  menu, e o conteúdo fica com ≈ 160 px: os selos empilham um por linha, a justificativa vira
  uma coluna estreita e, no par original/correção, o menu `⋯` fica solto no meio da linha com um
  vão vazio acima e abaixo (`crops` de `06-historico-360.png`). → Layout da linha em grade:
  linha 1 = marcador · nome do período · horário · `⋯` (44 px); linhas seguintes (selos,
  original/correção, justificativa, "Analisada por…") ocupam **toda** a largura a partir da
  coluna do nome (`col-span` 2–4). Um único `⋯` por linha (o do par vai para o mesmo menu).
  (`history.html` §1, 360 px).
- **[I-08] Importante** — Dias de folga consecutivos são agrupados listando cada data: o
  último cartão vira um parágrafo de 17 datas ("ter, 17 de nov · seg, 16 de nov · …").
  → Rótulo de intervalo: "1–17 nov · Folga" (2 dias: "dom, 23 nov · sáb, 22 nov" como no
  mockup; 3+ dias: intervalo) (`history.html` §1, cartão "dom, 23 nov · sáb, 22 nov").
- **[I-09] Importante** — Em < 1024 todos os `DayCard` vêm abertos; o histórico de novembro
  chega a ≈ 5 800 px de altura em 360 e o detalhe de membro a ≈ 6 500 px. → Em < 1024, abrir
  por padrão só "Hoje", dias com pendência e dias úteis sem marcação; os demais recolhidos
  (cabeçalho com resumo, `aria-expanded`) (`components.md` §3.3; `history.html` §1).
- **[I-10] (mesmo defeito de I-16, não contado)** — O botão "Incluir marcação" (secondary)
  aparece sem borda, parecendo um cartão branco.
- **[A-06] Ajuste fino** — "Original **19:03** [Original]" repete a palavra (rótulo + selo).
  → Manter só o selo `Original` ao lado do horário; o rótulo acima vira desnecessário.
- **[A-07] Ajuste fino** — Linhas de extra manual mostram três selos ([+ Extra] [Manual]
  [Pendente]), e o nome da linha já é "Extra". → Seguir a regra corrigida em
  `components.md` §3.1: sem selo "Extra" quando já houver selo de tipo (máx. 2 selos).
- **[A-08] Ajuste fino** — Datas "ter, 24 **de** nov" e semanas "16/11–22/11". → "ter, 24 nov"
  e "16–22 nov" (DESIGN_DIRECTION §6; `history.html`).
- **[A-09] Ajuste fino** — Botões só-ícone desabilitados (`>` do próximo mês, `↑` do primeiro
  período, `↓` do último) ganham círculo `surface-2`, que lê como "selecionado". → Variante
  `icon` desabilitada sem fundo, só ícone `text-disabled` (regra adicionada em
  `components.md` §0).
- `06c-historico-dia-aberto-*` ficou igual a `06-historico-*` porque todos os dias já vêm
  abertos (ver I-09).

### Aprovações (`07-*`, `07b-*`)

- **[I-11] (mesmo defeito de I-16, não contado)** — "Rejeitar" aparece como bloco branco **sem** a borda 1 px `danger`
  (`components.md` §5.2), perdendo o reforço visual ao lado do "Aprovar" verde. Ver causa
  global em **I-16**.
- **[A-10] Ajuste fino** — Subtítulo "2 pendências · **0 dia útil** sem marcação". → Com zero,
  "nenhum dia útil sem marcação" (ou omitir o trecho); plural "2 dias úteis sem marcação".
- **[A-11] Ajuste fino** — No `SegmentedControl` em 360, "Sem marcação" quebra em duas linhas e
  a opção fica mais alta que as outras. → `px-2` e `text-body-sm` nas opções abaixo de 400 px,
  ou rótulo "Sem marcação" com `white-space: nowrap` e as 3 opções em `grid-cols-[auto_auto_auto]`.
- Cartão do membro, faixa `warning-soft` nas pendentes, "Correção de 19:03", "Pedida em…",
  botões 50/50 no celular e à direita no computador, contador "2" na navegação: conforme
  `approvals.html` §1. A posição "Retorno 19:03" da original decorre do backend (B-02, item 1).

### Empresa e cargos (`08-*`, `08b-*`)

- **[A-12] Ajuste fino** — "0 membro" no cargo Padeiro. → "Nenhum membro" (i18next com
  `_zero`), e "1 membro"/"2 membros".

### Editor de cargo — semanal e diário (`09-*`, `09b-*`, `09c-*`)

- **[I-12] Importante** — O rótulo "Previsto (opcional)" quebra em duas linhas e o campo de
  horário fica ≈ 20 px abaixo do campo "Nome do período" na mesma linha, nas duas larguras.
  → Rótulo só "Previsto" (o cabeçalho do grupo já diz "Horário previsto é opcional", como no
  mockup) e `items-end` na linha (`position-editor.html` §1).
- **[I-13] Importante** — Em ≥ 1024, os botões `↑ ↓ 🗑` ficam numa linha própria abaixo dos
  campos, dobrando a altura de cada período. → Em `lg:`, colocá-los à direita do campo
  "Previsto", na mesma linha (`position-editor.html` §1, 1280 px); abaixo de 1024 continuam
  abaixo.
- **[I-14] Importante** — Modo diário em 1280 usa o mesmo acordeão do celular. → Em `lg:`,
  lista vertical dos 7 dias à esquerda (abas verticais, com switch e resumo) e o painel do dia
  selecionado à direita (`components.md` §6.1 "Modo diário"; `position-editor.html` §2, 1280).
- **[A-13] Ajuste fino** — Resumo "Seg–Sex · 4 marcações · 44 / h/semana" quebra entre o número
  e a unidade. → `44 h/semana` (espaço não separável) em `ScheduleSummary`.
- **[A-14] Ajuste fino** — Switch do dia (modo diário) sem rótulo visível "Dia útil". → Texto
  `caption` "Dia útil" à esquerda do switch (`components.md` §6.1).
- **[A-15] Ajuste fino** — Novo cargo não mostra "Vale a partir de" (item 6 de §6.1). → Exibir
  com padrão hoje, como na edição.

### Convites e convite público (`10-*`, `11-*`, `11b-*`)

- **[I-15] Importante** — Ao abrir `/convite/:token`, o `h1` "Você foi convidado…" aparece com o
  anel de foco laranja (foco programático no `h1` com `tabIndex=-1`). A origem é a regra base
  que eu mesmo especifiquei em `tailwind-theme.css` (incluía `[tabindex]`) — **corrigida** nesta
  revisão. → Copiar o bloco `@layer base` atualizado de `docs/design/tailwind-theme.css` para
  `frontend/src/styles/theme.css` (exclui `[tabindex="-1"]` e zera `outline` no foco dele).
- **[A-16] Ajuste fino** — O convite público mostra "Criar conta e aceitar" como botão, enquanto
  `invite.html` §1 traz o cadastro curto (Nome, E-mail, Senha) na própria página. Se o botão
  leva a `/cadastro`, é um passo a mais no fluxo do convidado. → Preferir o formulário inline;
  se mantiver o botão, garantir retorno automático ao convite após o cadastro.
- **[A-17] Ajuste fino** — Cartão do convite tem ≈ 48 px de vão abaixo de "Convite válido até…".
  → Padding uniforme 24 px.
- **[A-18] Ajuste fino** — Textos "0 aceitou" / "1 aceitou". → "Ninguém aceitou ainda",
  "1 pessoa aceitou", "2 pessoas aceitaram" (`invite.html` §3 usa "2 aceitaram").

### Membros e detalhe (`12-*`, `13-*`)

- **[B-03] Bloqueante (informação cortada)** — Em 360 os nomes são cortados com reticências
  ("Ana Revis…", "Bruno Carval…"); "(você)" some. Viola o princípio 5 da direção (sem
  `text-overflow` em informação) e impede distinguir pessoas com nomes parecidos. → Nome com
  quebra de linha (`break-words`, sem `truncate`); em < 1024 o `RoleBadge` vai para a linha do
  cargo, abaixo do nome; "· desde dd/mm/aaaa" vira linha própria `caption` (`members.html` §1).
- **[I-16] Importante (global)** — Botões `secondary`, `reject` e `google` são renderizados sem
  borda (`border-color: transparent`): "Convidar", "Incluir marcação", "Rejeitar", "Transferir"…
  Causa: `BASE` em `components/buttonStyles.ts` tem `border border-transparent`, as variantes
  acrescentam `border-border`/`border-danger`, e `cn` não resolve conflito de classes — na CSS
  gerada `border-transparent` vence. → Tirar `border-transparent` do `BASE` (deixar só `border`)
  e colocá-lo nas variantes sem borda (`primary`, `tertiary`, `danger`, `danger-ghost`,
  `success`, `icon`); ou usar `tailwind-merge` em `cn` com as cores do tema registradas.
- **[I-17] Importante** — Em 1280 a lista ocupa toda a largura e o detalhe é outra página; o
  design pede tabela com colunas Nome · Cargo · Papel · Desde · Situação (`components.md` §11
  MemberRow) ou lista + detalhe lado a lado (`members.html` §1, 1280). → Implementar a tabela
  em `lg:` (mínimo); lista + detalhe é desejável.
- **[A-19] Ajuste fino** — SideNav: o item da conta mostra "Minha conta" + e-mail cortado com
  reticências. → Nome do usuário (`body-sm` 600) + e-mail `caption` com `break-all`, em até 2
  linhas (`components.md` §1.1 SideNav).
- Detalhe de membro (1280) com "Ações" e "Histórico de cargo e jornada" na coluna direita ficou
  **melhor** que o mockup (ver abaixo). Em 360 as ações só aparecem depois de todos os dias —
  resolvido junto com I-09.

### Configurações da empresa (`14-*`)

- **[I-18] Importante** — Em 360 o `select` de fuso corta o texto da opção ("Brasília — SP, RJ,
  MG, ES, Sul, G("). → Rótulos curtos nas opções ("Brasília (UTC−3)") e a lista de estados no
  texto de ajuda abaixo do campo (`settings.html` §3 usa "Horário de Brasília (GMT−3)").
- "Transferir responsabilidade" deveria ser botão com contorno `danger` (`settings.html` §3);
  hoje aparece sem borda — mesma causa de I-16.
- **[A-20] Ajuste fino** — Campo "CNPJ ou CPF" sem placeholder. → `00.000.000/0000-00`
  (`settings.html` §3).

### Minha conta (`15-*`)

- **[I-19] Importante** — Em 360 o e-mail no campo somente leitura é cortado
  ("ana.revisao+1795644212394@exan"). → Exibir o e-mail como texto (`<p>` com `break-all`,
  fundo `surface-2`, `rounded-md`, padding 12 × 14 px), não como `input` (`components.md` §7.1
  "Somente leitura").
- **[A-21] Ajuste fino** — Em 1280 os campos se estendem por ≈ 920 px. → Limitar a coluna do
  formulário a `max-w-[560px]`.

### Trocar de empresa (`16-*`)

Sem desvios relevantes. Radio com `Check`, "Criar empresa" e "Tenho um convite" conforme
`components.md` §1.1 CompanySwitcher.

---

## Contagem final

Lista canônica para T071:

| ID | Sev. | Tela | Resumo |
|---|---|---|---|
| B-01 | Bloqueante | Ponto | Pendentes mostradas como feitas no painel, anel e "N de M" |
| B-02 | Bloqueante | Histórico / Detalhe | Correção duplicada em 2 períodos; ordem errada (+ ajuste de backend) |
| B-03 | Bloqueante | Membros | Nomes cortados com reticências em 360 |
| I-01 | Importante | Login | Título/subtítulo descentralizados em 1280 |
| I-02 | Importante | Cadastro | Título alinhado à esquerda (inconsistente com login) |
| I-03 | Importante | Ponto offline | Texto do botão encosta na borda do círculo em 360 |
| I-04 | Importante | Toasts | Ícone/faixa do tipo errados; fechar 20 px |
| I-05 | Importante | Ponto | CLS 0,105 ao carregar |
| I-06 | Importante | Ponto / TopBar | Nome acessível não começa pelo texto visível (2.5.3) |
| I-07 | Importante | Histórico 360 | Linha espremida, selos empilhados, `⋯` solto |
| I-08 | Importante | Histórico | Grupo de folgas vira parágrafo de datas |
| I-09 | Importante | Histórico / Detalhe 360 | Todos os dias abertos por padrão |
| I-12 | Importante | Editor de cargo | "Previsto (opcional)" desalinha os campos |
| I-13 | Importante | Editor de cargo 1280 | Ações ↑↓🗑 em linha própria |
| I-14 | Importante | Editor diário 1280 | Acordeão no lugar de abas verticais |
| I-15 | Importante | Convite | Anel de foco no `h1` (doc corrigido) |
| I-16 | Importante | Global | Botões secondary/reject/google sem borda |
| I-17 | Importante | Membros 1280 | Sem tabela / lista + detalhe |
| I-18 | Importante | Configurações | Select de fuso corta o rótulo em 360 |
| I-19 | Importante | Conta | E-mail somente leitura cortado em 360 |
| A-01…A-19 | Ajuste fino | várias | conforme as seções acima |
| A-20 | Ajuste fino | Configurações | Placeholder do CNPJ |
| A-21 | Ajuste fino | Conta 1280 | Largura máx. do formulário 560 px |
| A-22 | Ajuste fino | Logos | `width`/`height` intrínsecos nas `<img>` (Lighthouse) |
| A-23 | Ajuste fino | PWA/SEO | `public/robots.txt` (Lighthouse SEO) |

I-10 ("Incluir marcação") e I-11 ("Rejeitar") são o mesmo defeito de I-16 e **não** entram na conta; ao corrigir I-16, conferir os dois.
Totais: **3 Bloqueantes · 17 Importantes · 23 Ajustes finos.**

---

## O que ficou melhor que o mockup

- **Filtro avançado em 360**: as duas datas cabem lado a lado sem cortar; no meu mockup
  (`history.html` §2) o campo "Data final" vaza da folha. Mantido como referência.
- **Detalhe de membro em 1280**: "Ações" e "Histórico de cargo e jornada" na coluna direita,
  junto do resumo e das semanas — mais fácil de achar do que no mockup.
- **Histórico**: "Analisada por Ana Revisão em 25/11 às 19:04 · Motivo: …" sob cada marcação
  analisada, e horário rejeitado riscado — mais transparente que o mockup.
- **Offline**: legenda do relógio "Horário de Brasília · sem conexão", linha "Extra ·
  Aguardando envio" com destaque e a explicação "Ao reconectar…" logo abaixo da lista; botão em
  espera ("Aguarde 60 s") também offline.
- **Aprovações**: metadados "Correção de 19:03" / "Pedida em 25/11 às 19:21" e o link "Ver
  histórico de Bruno Carvalho" no rodapé do cartão.
- **Cargos**: resumo "Seg–Sáb · 4 marcações (Sáb: 2) · 40 h/semana" e "Versões da jornada" no
  editor.
- **Convites**: filtro "Situação" na própria tela.

## Correções feitas nos documentos de design

| Arquivo | Correção |
|---|---|
| `tailwind-theme.css` (`@layer base`) | Regra de foco não se aplica mais a `[tabindex="-1"]` (headings com foco programático); `[tabindex="-1"]:focus { outline: none }`. Origem de I-15. |
| `components.md` §0 | Botão `icon` desabilitado sem fundo (A-09). |
| `components.md` §2.1 | Regra explícita para pendentes no painel do relógio, anel e "N de M" (B-01). |
| `components.md` §2.2 | Posição do botão de ponto no desktop: abaixo do painel (o texto dizia "à direita da hora", o mockup sempre mostrou abaixo; o app seguiu o mockup). |
| `components.md` §3.1 | Selo "Extra" só sem outro selo de tipo — máximo de dois selos (A-07). |
| `components.md` §4.2 | Filtros de Situação e Cargo das Aprovações ficam na tela (como no mockup e no app), não no modal; regra para datas lado a lado. |

Erros conhecidos nos mockups, não corrigidos nos HTML: `history.html` §2 (campo "Data final"
vazando em 360) e `invite.html` §1 ("Convite de Mariana Costa" — a API pública do convite não
devolve quem convidou; o app está certo em não mostrar).

---

## Lighthouse (mobile, Lighthouse 13.6, Chrome 158)

O Lighthouse 12+ **removeu a categoria PWA**. A instalabilidade foi verificada direto no Chrome
via DevTools Protocol (`Page.getInstallabilityErrors`) e pelo manifest servido.

| Página | Desempenho | Acessibilidade | Boas práticas | SEO | Instalável |
|---|---|---|---|---|---|
| `/entrar` (frio, sem cache) | **100** | **100** | **100** | **92** | sim — 0 erros; SW ativo |
| `/` ponto, logado (Ana) | **97** | **100** | **96** | **92** | sim — 0 erros; SW ativo |

Métricas `/entrar` (frio, 4G simulado): FCP 0,8 s · LCP 0,8 s · TBT 20 ms · CLS 0,001 · SI 0,8 s.
Métricas `/` (logado): TBT 20–50 ms · **CLS 0,105** · SI 0,4 s. FCP/LCP saíram "0,0 s" porque a
sessão precisa ser injetada na mesma aba antes da medição (artefato do Lantern); tratar o 97 como
indicativo e o CLS como real.

Manifest: `name`/`short_name` "Pontua", `display: standalone`, `theme_color #FFFFFF`,
`background_color #F3F6F9`, `lang pt-BR`, ícones `any` + `maskable` 192/512, atalho "Registrar
ponto" — igual a DESIGN_DIRECTION §8.

Auditorias reprovadas (viram itens de T071):

- `cumulative-layout-shift` / `layout-shifts` (ponto) → **I-05**.
- `label-content-name-mismatch` (ponto) → **I-06**. Não pesa na nota, mas é WCAG 2.5.3 (A).
- `image-aspect-ratio` (ponto) e `unsized-images` (`/entrar`): `<img>` da logo com só `height`
  (ou sem dimensões). → **[A-22] Ajuste fino**: colocar `width`/`height` intrínsecos
  (`logo.png` 1086 × 297 ou o `.webp` gerado) além das classes `h-9 w-auto`.
- `robots-txt` (SEO 92): `/robots.txt` devolve o `index.html` (fallback de SPA do nginx). → **[A-23] Ajuste fino**: criar
  `frontend/public/robots.txt` (`User-agent: *` / `Allow: /`).
- `render-blocking-insight`: CSS único de 13 KB bloqueia ≈ 150 ms — aceitável; sem ação.

Relatórios completos: [`review/lighthouse/entrar-mobile.html`](./review/lighthouse/entrar-mobile.html)
e [`review/lighthouse/ponto-mobile.html`](./review/lighthouse/ponto-mobile.html) (execução com o
service worker já ativo; a execução fria de `/entrar` está resumida acima).

---

## Screenshots

Pasta [`review/`](./review/) — 60 PNG, cada tela em `-360.png` (DSF 2) e `-1280.png`. No celular,
a altura da janela foi ajustada à página para que a BottomNav fixa apareça no rodapé; os arquivos
`-dobra.png` mostram só a primeira dobra (360 × 740 / 1280 × 800) da tela de ponto.

| Arquivo | Conteúdo |
|---|---|
| `01-login`, `02b-login-erro`, `02-cadastro` | Login, login com erros, cadastro |
| `03-boas-vindas` | `/bem-vindo` (Carla, sem empresa) |
| `04-ponto-membro(-dobra)` | Ponto do membro com 2 pendentes (B-01) |
| `04b-ponto-responsavel(-dobra)` | Ponto da responsável, 2 de 4, contador "2" |
| `04c-ponto-confirmar` | Folha / diálogo "Registrar ponto?" |
| `05-ponto-offline`, `05b-ponto-offline-fila` | Sem conexão; marcação na fila + toast + espera |
| `06-historico`, `06c-historico-dia-aberto` | Histórico de novembro |
| `06b-historico-filtro`, `06d-historico-incluir` | Filtro avançado aberto; incluir marcação |
| `07-aprovacoes`, `07b-aprovacoes-filtro` | Painel como responsável; filtro avançado |
| `08-empresa`, `08b-cargos` | Hub da empresa; lista de cargos |
| `09-cargo-semanal`, `09b-cargo-diario`, `09c-cargo-novo` | Editor de cargo |
| `10-convites`, `11-convite-publico`, `11b-convite-logado` | Convites; página pública sem e com sessão |
| `12-membros`, `13-membro-detalhe` | Membros; detalhe do Bruno |
| `14-configuracoes`, `15-conta`, `16-trocar-empresa` | Configurações; conta; seletor de empresa |

---

## Verificação (v2)

Refeita em 25/11/2026 pelo `ux-designer` contra o build de homologação com T071 aplicado e a
correção de servidor do B-02 (`http://localhost:8081`, Chrome headless via Puppeteer, 360 × 740
DSF 2 com toque e 1280 × 800). Dados novos: empresa "Padaria Revisão" (seed v2) com Bruno tendo 2
marcações normais, 1 correção pendente (08:01 → 19:49) e 1 inclusão pendente (13:02) hoje; mais a
empresa "Padaria Sol" criada pela interface no roteiro do quickstart
([`review/QUICKSTART_RESULT.md`](./review/QUICKSTART_RESULT.md)). Capturas em
[`review/v2/`](./review/v2/) — mesmos nomes da v1 e os novos `02c-cadastro-erro`,
`06e-historico-botoes`, `07b-aprovacoes-rejeitar`, `09d-cargo-novo-diario`, `09e-cargo-diario-1440`,
`17-toast-sucesso` (360), `17b-ponto-espera`, `17c-toast-sucesso` (1280). Nenhuma tela tem rolagem
horizontal em 360 e 1280 (`scrollWidth` = `clientWidth` nas 66 capturas).

Legenda: ✅ resolvido · ⚠️ parcial · ❌ não resolvido.

| ID | Situação | Observação |
|---|---|---|
| B-01 | ✅ | Período só com pendente mostra `Hourglass` âmbar; anel e "2 de 4" contam só válidas; com a jornada fechada: "Jornada de hoje registrada · 1 pendente"; fila offline com `CloudUpload` (`04-ponto-membro-360-dobra`, `05b`, `17b`). |
| B-02 | ✅ (v3) | Histórico: o par Original 19:49 → Correção pedida 08:01 aparece **uma vez**, na linha do período da original (`06-historico-*`). **v3:** uma inclusão pendente não desloca mais as válidas (N-02 ✅), e a tela de ponto mostra o par original/correção numa linha só (N-04 ✅) — ver [Reverificação (v3)](./review/QUICKSTART_RESULT.md#reverificação-v3). |
| B-03 | ✅ | Nomes completos com quebra, "(você)" visível, papel na linha do cargo, "desde" em linha própria; nenhum elemento com `text-overflow` cortando texto (`12-membros-360`). |
| I-01 | ✅ | Centro do `h1` = centro do formulário (934 px em 1280; 180 px em 360); subtítulo `text-align: center`. |
| I-02 | ✅ | Cadastro centralizado como o login. |
| I-03 | ✅ | Em 360 offline, "Saída · enviada depois" fica a 24 px das bordas internas do círculo de 184 px (`05-ponto-offline-360`). |
| I-04 | ✅ | Toast offline com `CloudOff` e faixa de 4 px `offline`; sucesso com faixa `success`; fechar 44 × 44 no canto superior direito, `aria-label="Fechar"` (`05b`, `17`, `17c`). |
| I-05 | ✅ | Lighthouse mobile na tela de ponto: CLS **0** (antes 0,105). |
| I-06 | ✅ (v3) | Os nomes acessíveis começam pelo texto visível (WCAG 2.5.3). Na v2 o Lighthouse ainda reprovava `label-content-name-mismatch` em 3 nós. **v3:** Lighthouse mobile em `/` como responsável e como membro → 100/100/100/100, auditoria **não aplicável** (nenhum nó divergente) e nenhuma auditoria de acessibilidade reprovada (`review/v3/lighthouse/`). |
| I-07 | ✅ | Linha em grade: nome · horário · `⋯`; selos, par original/correção e justificativa na largura toda; um `⋯` por linha (`06-historico-360`). |
| I-08 | ✅ | "1–24 nov · Folga". |
| I-09 | ✅ | Em 360 só "Hoje" vem aberto; histórico com 1 318 px de altura (antes ≈ 5 800). |
| I-12 | ✅ | Rótulo "Previsto"; nome e horário alinhados na mesma linha (360 e 1280). |
| I-13 | ✅ | No modo semanal em 1280, ↑ ↓ 🗑 ficam à direita do campo "Previsto" (`09-cargo-semanal-1280`). Ver N-01 para o modo diário. |
| I-14 | ✅ (v3) | Na v2 o painel do dia quebrava entre 1024 e 1439 px (N-01). **v3:** com o menu lateral visível, o campo "Nome do período" tem 172 px (1024, lista em cima e painel embaixo), 280 px (1280, dias em grade de 2 colunas e painel embaixo) e 324 px (1440, lista à esquerda e painel à direita); em 360 tem 130 px. Rótulo em 1 linha, sem cortes nem sobreposições (`review/v3/N01-cargo-diario-*`). |
| I-15 | ✅ | `h1` do convite recebe o foco sem anel (`outline: none`). |
| I-16 | ✅ | Bordas certas: "Convidar"/"Incluir marcação"/"Copiar de outro dia" `border` cinza; "Rejeitar" e "Transferir responsabilidade" `danger` 1 px. |
| I-17 | ✅ | Em 1280, tabela Nome · Cargo · Papel · Desde · Situação. |
| I-18 | ✅ | Opções curtas "Brasília (UTC−3)"; estados no texto de ajuda. |
| I-19 | ✅ | E-mail como texto (`span`), sem corte. |
| A-01 | ✅ | "previsto" em todos os lugares. |
| A-02 | ✅ | "Confirmar" com `Check`. |
| A-03 | ✅ | "23–29 nov". |
| A-04 | ✅ | Link do símbolo na TopBar com 44 × 44. |
| A-05 | ✅ | "Sem conexão — dados de 25/11 às 19:53." aparece offline. |
| A-06 | ✅ | Só o selo "Original" ao lado do horário. |
| A-07 | ✅ | Extra offline com 2 selos (Offline · Pendente); extra normal só com "+ Extra". |
| A-08 | ✅ | "qua, 25 nov", "16–22 nov". |
| A-09 | ✅ | Ícones desabilitados sem fundo (`Próximo mês`, `↑` do 1º período). |
| A-10 | ✅ | "nenhum dia útil sem marcação" / "1 dia útil sem marcação". |
| A-11 | ✅ | "Sem marcação" numa linha em 360. |
| A-12 | ✅ | "Nenhum membro" / "1 membro". |
| A-13 | ✅ | "44 h/semana" sem quebra entre número e unidade. |
| A-14 | ✅ | Texto "Dia útil" visível ao lado do switch nas duas larguras; nome acessível "Segunda é dia útil" contém o texto visível. O dev marcou como parcial, mas o pedido da revisão está atendido. |
| A-15 | ⚠️ aceito | Novo cargo mostra "Vale a partir de" somente leitura com hoje e a ajuda "Cargos novos valem a partir de hoje. Para agendar outra data, edite a jornada depois de criar o cargo." Fica aceitável no MVP porque o texto é verdadeiro e o fluxo alternativo existe; quando o backend aceitar `effectiveFrom` na criação, liberar o campo. |
| A-16 | ⚠️ aceito | Manteve o botão "Criar conta e aceitar" → `/cadastro`, mas o retorno é automático: no quickstart o convidado foi de `/cadastro` → `/convite/:token` → `/` já como membro, sem clique extra (≈ 6 s). Aceitável. |
| A-17 | ✅ | Cartão do convite com padding uniforme. |
| A-18 | ✅ | "Ninguém aceitou ainda" / "1 pessoa aceitou". |
| A-19 | ✅ | SideNav com nome + e-mail quebrando (`break-all`) em 2 linhas. |
| A-20 | ✅ | Placeholder `00.000.000/0000-00`. |
| A-21 | ✅ | Formulário da conta com 510 px em 1280. |
| A-22 | ✅ | `<img>` das logos com `width`/`height` (527 × 144; 28 × 28). |
| A-23 | ✅ | `/robots.txt` servido; SEO 100. |

**Contagem v2:** ✅ **38** · ⚠️ **4** (B-02, I-06, A-15 aceito, A-16 aceito) · ❌ **1** (I-14).

**Contagem após a v3:** ✅ **41** · ⚠️ **2** (A-15 aceito, A-16 aceito) · ❌ **0**.

### Novos achados (v2 + roteiro do quickstart)

- **[N-01] Bloqueante (regressão de I-13/I-14)** — Editor de cargo no modo **diário** entre 1024
  e ≈ 1439 px: o painel do dia é estreito demais para a linha "nome · previsto · ↑ ↓ 🗑", o
  campo do nome encolhe a 30 px (1280) e o rótulo "Nome do período" vira uma letra por linha; em
  1024 o painel tem 72 px. Impossível ler ou editar os nomes dos períodos. → No painel do dia,
  usar o layout empilhado do celular (ações abaixo) até o painel ter ≥ 560 px — de preferência
  com container query (`@container` no painel, `@[560px]:` na linha do período) em vez de `lg:`
  da viewport; e lista de dias com `w-60` (240 px) em `lg:` e 280 px só em `xl:`.
- **[N-02] Importante (backend, continuação do B-02)** — Uma **inclusão** manual pendente ainda
  entra no cálculo de períodos: com 4 válidas (20:00–20:03) e uma inclusão pendente 07:30, a API
  devolve 07:30 como "Entrada", 20:00 válida como "Pausa", … e a Saída válida 20:03 como **Extra**
  (histórico, Aprovações e tela de ponto). As horas não mudam. → `dotnet-senior-developer`:
  períodos das válidas calculados só com `valid`/`approved`; a pendente recebe o período que
  *teria* se aprovada, sem empurrar as demais. No front, o painel de Aprovações atualiza só a
  marcação analisada: após rejeitar, as outras linhas continuam com o período antigo até recarregar
  (a API já devolvia Entrada 20:00) → recarregar o dia do membro após aprovar/rejeitar.
- **[N-03] Importante (WCAG 2.4.3)** — Ao fechar qualquer `Modal` (Esc, "Cancelar" ou `X`), o foco
  vai para o `body` em vez de voltar ao gatilho (verificado no "Registrar ponto?" e no "Incluir
  marcação", 360 e 1280). `components.md` §8.1 pede "foco volta ao gatilho". → Guardar o elemento
  ativo ao abrir e devolvê-lo em `onCloseAutoFocus` do `ModalContent` (sem `preventDefault`).
- **[N-04] Importante** — "Marcações de hoje" na tela de ponto lista a correção pendente como linha
  própria com o mesmo nome do período ("Pausa 08:01 Manual Pendente" no topo e "Pausa 19:49 Válida"
  abaixo) (`04-ponto-membro-*`, `05b`). → Mesmo tratamento do histórico: par original/correção
  numa linha só, ou a correção com o texto "Correção de 19:49".
- **[N-05] Ajuste fino** — "trabalhado 0 minuto de 0 minuto previstos" e "0 minuto" no resumo
  (pt-BR trata 0 como `one`). → Chaves `_zero` em `historico:duration` ("0 minutos" ou "nada").
- **[N-06] Ajuste fino** — No acordeão diário em 360 o resumo "4 períodos · 07:00" quebra deixando
  o "4" sozinho na primeira linha. → `text-wrap: balance` ou `whitespace-nowrap` em cada parte.

Totais dos novos: **1 Bloqueante · 3 Importantes · 2 Ajustes finos.**

**Situação na v3** ([Reverificação (v3)](./review/QUICKSTART_RESULT.md#reverificação-v3)): N-01 ✅ ·
N-02 ✅ · N-03 ✅ (11 de 11 fechamentos devolvem o foco ao gatilho) · N-04 ✅ · N-05 ✅ · N-06 ✅.

- **[N-07] Ajuste fino (novo na v3)** — Editor diário em ≥ 1440 px: na lista estreita de dias
  (116 px por item), o resumo "4 períodos · 07:00" quebra e "· 07:00" começa a 2ª linha pelo
  separador (`review/v3/N01-cargo-diario-1440-lista-dias`). → Pôr separador e carga num `span`
  `whitespace-nowrap`, ou mostrar a carga em linha própria sem "·".
