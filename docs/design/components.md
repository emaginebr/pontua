# Pontua — Especificação de componentes

Tarefa T003 · direção [Expediente](./DESIGN_DIRECTION.md) · tokens [`tokens.css`](./tokens.css)
(classes Tailwind via [`tailwind-theme.css`](./tailwind-theme.css)) · telas em
[`screens/`](./screens/index.html).

Este documento é a especificação para o `frontend-react-developer` (T020+). Ele descreve
**props, estados, variantes, tokens e acessibilidade**; não contém `.tsx`. Os nomes de classe
citados são utilitários do Tailwind gerados pelo `@theme` (ex.: `bg-surface`, `text-muted`,
`rounded-card`). Os mockups usam classes próprias (`.btn`, `.badge`…) apenas para demonstração.

## 0. Regras comuns a todos os componentes

| Estado | Regra visual | Regra técnica |
|---|---|---|
| **Padrão** | conforme cada componente | — |
| **Hover** (só ponteiro fino) | fundo um passo acima (`surface` → `surface-3`; `primary` → `primary-hover`) | `@media (hover:hover)` — nunca depender de hover para revelar ação |
| **Foco** | anel `focus` 3 px + recuo 2 px (`outline`, não `box-shadow`, para aparecer no modo de alto contraste); sobre navy usar `focus-on-dark` | `:focus-visible`; ordem de foco = ordem visual |
| **Pressionado** | fundo dois passos acima (`primary-pressed`, `surface-3`) + `scale(0.98)` só em botões (remove com reduced-motion) | `:active` / `data-state` |
| **Desabilitado** | fundo `surface-2` (exceto botões `icon`: sem fundo, só ícone `text-disabled` — um círculo cinza parece "selecionado"), texto `text-disabled`, sem sombra, cursor `not-allowed`; **sempre** acompanhado de explicação visível perto quando o motivo não for óbvio (ex.: "Disponível com conexão") | `disabled` nativo; se precisar continuar focável para ler o motivo, `aria-disabled="true"` + `aria-describedby` |
| **Carregando** | spinner `LoaderCircle` 20 px girando no lugar do ícone; texto muda para gerúndio ("Registrando…"); largura não muda | `aria-busy="true"`; botão não reenvia; anúncio via toast ao concluir |
| **Erro** | borda `danger` 2 px + ícone `CircleAlert` + mensagem `danger` abaixo | `aria-invalid="true"` + `aria-describedby` → id da mensagem |

Outras regras:

- Alvo mínimo 44 × 44 px (`min-h-touch min-w-touch`); controles padrão 48 px (`h-control`).
- Todos os textos vêm de i18next (chaves em `pt-BR`); nada de texto fixo em componente.
- Horas/saldos: `tabular-nums`. Saldo negativo com "−" (U+2212), nunca hífen.
- Movimento: só `transition-[background-color,box-shadow,transform]` com `duration-(--pt-duration-fast)`;
  tudo some com `motion-reduce:`.
- Composição: Radix Dialog (modais/folhas), sonner (toasts), lucide-react (ícones). Nenhum outro
  kit de componentes é necessário; shadcn/ui pode servir de **referência de estrutura** para
  `Button`, `Dialog` e `Select`, mas os estilos vêm destes tokens.

---

## 1. Layout

### 1.1 AppShell

Casca de todas as rotas autenticadas com empresa ativa.

| Faixa | Estrutura |
|---|---|
| `< 1024 px` | `TopBar` (56 px, `surface`, sombra inferior `separator`) · `OfflineBanner`/`UpdatePrompt` (quando houver) · `<main>` rolável · `BottomNav` (64 px + safe-area, fixa) |
| `≥ 1024 px` | `SideNav` fixa à esquerda (264 px, `surface`, borda direita `separator`) · coluna de conteúdo com banners no topo e `<main>` com `max-w-content` centralizado, padding 24 px |

Props: `children`, `title` (título da tela, vira `h1` dentro do `<main>`; a TopBar mostra o nome
da empresa, não o título), `actions?` (botões do cabeçalho da tela).

Acessibilidade: link "Pular para o conteúdo" como primeiro foco (visível no foco); landmarks
`header`, `nav aria-label="Principal"`, `main id="conteudo"`; ao trocar de rota, foco vai para o
`h1` (tabIndex -1) e `document.title` = "{Tela} · Pontua".

#### TopBar (< 1024 px)

`[símbolo 28 px] [CompanySwitcher (flex-1)] [botão Conta 44 px, ícone UserRound, aria-label "Minha conta"]`

#### BottomNav (< 1024 px)

- Até 4 destinos, largura igual, 64 px de altura; ícone 24 px sobre rótulo `caption`.
- Destinos: **Ponto** (`Clock`, `/`) · **Histórico** (`History`) · **Aprovações**
  (`ClipboardCheck`, só responsável/gestor) · **Empresa** (`Building2`). Membro comum vê 3 destinos.
- Ativo: ícone e texto `primary`, "pílula" `primary-soft` de 56 × 32 px atrás do ícone, peso 700;
  `aria-current="page"`. Inativo: `text-muted`.
- `padding-bottom: env(safe-area-inset-bottom)`; o `<main>` recebe `padding-bottom` igual à altura
  da barra para nada ficar escondido.

#### SideNav (≥ 1024 px)

Ordem: `logo.png` (altura 36 px, link para `/`) → `CompanySwitcher` (largura total) → destinos
(itens de 48 px, ícone 20 + rótulo `body-sm` 600, ativo `bg-primary-soft text-primary` com barra
de 3 px `primary` à esquerda) → espaço → `InstallAppButton` (variante discreta) → item "Minha conta"
com nome e e-mail do usuário.

#### PendingCounter (contador de pendências)

- Pílula `warning-solid` com número `brand-navy` 12 px/700, mínimo 20 × 20 px, borda 2 px
  `surface` (separa do ícone). No BottomNav fica no canto superior direito do ícone; no SideNav,
  à direita do rótulo. "99+" acima de 99. Some quando 0.
- Texto acessível: o link recebe `aria-label="Aprovações, 3 pendências"` (singular "1 pendência");
  o número visual fica `aria-hidden`. Quando o número muda, não anunciar (evitar ruído) — o toast
  da aprovação já anuncia.

#### CompanySwitcher

- Botão 44 px: nome da empresa (`title-sm`, quebra em até 2 linhas, nunca corta) + papel em
  `caption text-muted` ("Responsável", "Gestor", "Membro") + `ChevronsUpDown`.
- Abre `Modal` (folha no celular) "Trocar de empresa": lista de empresas como `radio` (linha de
  56 px, nome + papel, `Check` na ativa), botão secundário "Criar empresa" e link "Tenho um convite".
- Com fila offline de outra empresa: linha mostra `CloudUpload` + "1 aguardando envio".
- Com 1 empresa só: continua sendo botão (abre a folha com "Criar empresa"), nunca texto estático.

### 1.2 PageHeader

`h1` `title-lg` + subtítulo opcional `body-sm text-muted` + ações à direita (≥ 1024) ou abaixo
(< 1024, botões largura total). Em telas de detalhe, botão "Voltar" (`ChevronLeft` + texto) acima
do título.

---

## 2. Ponto

### 2.1 ClockPanel

Cartão `rounded-xl` com degradê `brand-navy → brand-navy-2` (160°), texto branco, classe `on-dark`
(foco `focus-on-dark`).

Conteúdo: data longa (`body-sm on-dark-muted`, "terça-feira, 25 de novembro") → hora `text-clock`
`tabular-nums` ("08:42", segundos **não** exibidos, evita anúncio e movimento) → linha "Próxima:
**Retorno** · previsto 13:00" (`body` 600) → fuso da empresa em `caption on-dark-muted` quando
diferente do aparelho ("Horário de Brasília").

- A hora mostrada é a do servidor (`serverOffset`); o elemento é `<time>` com `aria-live="off"`
  (não anunciar a cada minuto).
- Sem jornada para o dia: "Hoje não é dia útil para você" no lugar de "Próxima".
- Todas marcadas: "Jornada de hoje completa" + `CircleCheck` `brand-leaf`. "Marcada" = marcação
  que conta (`valid`/`approved`). Período coberto só por marcação **pendente** mostra `Hourglass`
  (`warning-solid` sobre o navy) no lugar do `Check`, e enquanto houver pendente o texto é
  "Jornada de hoje registrada · 2 pendentes" (nunca "completa"); o mesmo vale para o anel e para
  "N de M marcações feitas hoje" (pendentes não contam). Fila offline: `CloudUpload`.
  (Regra explicitada na revisão T070.)

### 2.2 PunchButton (botão de ponto)

O elemento dominante da tela.

| Propriedade | Valor |
|---|---|
| Forma | círculo `size-punch` (184 px; 216 px ≥ 1024), `bg-primary`, `shadow-punch` |
| Conteúdo | ícone `Clock` 40 px + "Registrar ponto" (`text-punch`) + linha `caption` com o período ("Retorno") |
| Anel de progresso | SVG ao redor (8 px, `brand-green` sobre fundo claro): arco = marcações feitas / previstas; decorativo (`aria-hidden`) — o progresso também está escrito na lista do dia |
| Posição | centralizado, na metade inferior da área visível acima da BottomNav (≈ 120–320 px acima da borda inferior em 360 × 740); no desktop, centralizado **abaixo** do painel do relógio, na coluna esquerda (como em `screens/clock.html`; texto corrigido na revisão T070) |
| Rótulo acessível | `aria-label="Registrar ponto: Retorno"` (ou "Registrar ponto: marcação extra") |

Estados:

| Estado | Visual | Comportamento |
|---|---|---|
| Padrão | como acima | toque → `ConfirmModal` de registro |
| Hora prevista (±10 min) | halo verde pulsante (`animate-punch-pulse`) | sem pulso com reduced-motion |
| Hover / pressionado | `primary-hover` / `primary-pressed` + `scale(0.97)` | — |
| Foco | anel `focus` 3 px com recuo 4 px (fora do anel de progresso) | — |
| Carregando | spinner no lugar do ícone, "Registrando…" | `aria-busy`; ignora toques |
| Aguarde (< 1 min da última) | `surface-2` com borda `border`, texto `text` "Aguarde 42 s" + `caption` "para marcar de novo" | `aria-disabled` + contagem atualizada no texto a cada 5 s (não a cada segundo); explicação em `aria-describedby` |
| Offline | igual ao padrão + selo `CloudOff` "Sem conexão" no topo do botão; linha abaixo: "Será guardada e enviada depois" | registra na fila; toast "Marcação guardada…" |
| Fora do dia útil | igual ao padrão; aviso âmbar `Notice` acima do botão | confirmação inclui o aviso |
| Sem permissão / sem cargo | não renderiza; `EmptyState` explica | — |

Toque com `?acao=registrar` (atalho do PWA) abre a confirmação direto.

### 2.3 PunchConfirm (variante de ConfirmModal)

Título "Registrar ponto?" · corpo: hora grande (`display`, `tabular-nums`) + "Período: **Retorno**"
(ou "Marcação extra") · aviso âmbar quando fora do dia útil · aviso índigo quando offline ·
botões: **"Confirmar"** primário (largura total, 56 px, recebe o foco inicial) e "Cancelar"
secundário. Ao confirmar: fecha, toast de sucesso "Retorno registrado às 13:02" (`CircleCheck`)
e a lista do dia ganha a linha nova com destaque `success-soft` por 2 s (sem animação com
reduced-motion).

### 2.4 TodayTimeline (marcações de hoje)

Lista ordenada (`<ol>`) dos períodos do dia: cada linha 56 px = marcador (círculo 12 px: cheio
`success` se marcado, contorno `border` se previsto, `warning` se pendente) + nome do período
(`body` 600) + previsto (`caption text-muted` "previsto 13:00") + horário marcado à direita
(`title-sm tabular-nums`) + `PunchBadge` quando houver tipo/status. Marcações extras entram na
ordem cronológica com nome "Extra". Linha da próxima marcação: fundo `primary-soft` + texto
"Próxima". Itens da fila offline aparecem com selo "Aguardando envio".

---

## 3. Marcações e dias

### 3.1 PunchBadge

Selo de 24 px de altura, `rounded-sm`, padding 0 8 px, ícone 14 px + `caption` 600, fundo `*-soft`
e texto/ícone na cor do estado. Combina **tipo** + **status** em até dois selos lado a lado
(tipo primeiro).

| Entrada (`kind`, `status`, `periodName`) | Selo(s) |
|---|---|
| `normal`, `valid` | nenhum selo (a linha mostra `CircleCheck` `success` 16 px com texto oculto "Válida") |
| `manual` | [`PenLine` Manual · `primary`/`primary-soft`] |
| `offline` | [`CloudOff` Offline · `offline`/`offline-soft`] |
| `pending` | [`Hourglass` Pendente · `warning`/`warning-soft`] |
| `approved` | [`CircleCheck` Aprovada · `success`/`success-soft`] |
| `rejected` | [`CircleX` Rejeitada · `danger`/`danger-soft`] |
| `cancelled` | [`Ban` Cancelada · `neutral`/`neutral-soft`] — horário riscado (`line-through`) e `text-muted` |
| `superseded` | [`Undo2` Substituída · `neutral`/`neutral-soft`] — horário riscado |
| `periodName == null` | o nome do período vira "Extra"; o selo [`Plus` Extra · `neutral`] só aparece quando a marcação **não** tem outro selo de tipo (manual/offline), para manter o máximo de dois selos (regra esclarecida na revisão T070) |
| fila local `waiting` | [`CloudUpload` Aguardando envio · `offline`] |
| fila local `rejected` | [`TriangleAlert` Recusada · `danger`] + motivo na linha |
| `pendingReason == outsideWorkday` | Pendente + `caption` "Fora do dia útil" na linha |

Exemplos de leitura completa: "Manual · Pendente", "Offline · Pendente", "Manual · Aprovada".
Acessibilidade: o selo é texto real (não `title`), então o leitor lê "Saída, 17:04, Manual,
Pendente". Nunca usar só o ícone.

### 3.2 HoursBalance

Exibe saldo `±hh:mm` com sinal sempre visível: positivo `success` "+01:15", negativo `danger`
"−00:30", zero `text-muted` "00:00". Tamanhos: `display` (totais), `title-sm` (dia). `aria-label`
"Saldo: mais 1 hora e 15 minutos" / "menos 30 minutos".

### 3.3 DayCard

Cartão do dia no histórico e no detalhe de membro.

- **Cabeçalho** (botão de 56 px que expande/recolhe em < 1024; sempre aberto ≥ 1024): data
  "seg, 24 nov" (`title-sm`) + resumo à direita "08:48 / 08:00" + `HoursBalance` do dia.
  `aria-expanded`.
- **Corpo**: lista dos períodos previstos com a marcação de cada um (mesma linha da
  `TodayTimeline`), marcações extras e pedidos manuais. Correção pendente mostra **original e
  correção lado a lado**: original com horário riscado e selo "Substituída" quando aprovada, ou
  "Original" (`neutral`) enquanto a correção está pendente; correção com "Manual · Pendente".
- **Ações** (rodapé, botões terciários 44 px): "Incluir marcação" (`Plus`), por linha um menu
  "Mais ações" (`Ellipsis`, `aria-label="Ações da marcação Saída 17:04"`) com "Corrigir horário",
  "Cancelar pedido" (só pendente próprio), "Ver detalhes".
- **Variantes**:
  - *Dia útil sem marcação*: faixa esquerda 4 px `danger` + selo [`CalendarX` Sem marcação ·
    `danger`] no cabeçalho + texto "Nenhuma marcação neste dia útil" + ação "Incluir marcação".
  - *Fim de semana / folga*: cabeçalho `text-muted`, "Folga", recolhido, sem saldo.
  - *Hoje*: selo `primary` "Hoje".
  - *Fora do limite manual*: ação "Incluir marcação" não aparece (as datas também ficam bloqueadas
    no seletor).

### 3.4 HoursSummary (totais)

Grade de 3 métricas: Trabalhado · Previsto · Saldo (`display` tabular, rótulo `caption
text-muted`). < 1024: cartão de largura total no topo, 3 colunas iguais (quebra para 1 coluna
com zoom 200 %). ≥ 1024: cartão fixo (sticky) na coluna lateral direita, com a lista de
**semanas** abaixo (linha por semana "17–23 nov · 44:10 / 44:00 · +00:10"). Aviso `caption`
"Marcações pendentes não entram no total."

### 3.5 ManualPunchForm (folha "Incluir marcação" / "Corrigir horário")

Campos: Data (`input type="date"` com `min`/`max` calculados — R-13; datas fora do intervalo
ficam desabilitadas no seletor nativo e, se digitadas, erro "Escolha uma data entre 26/10 e
hoje."), Horário (`type="time"`, erro "O horário não pode estar no futuro."), Justificativa
(`textarea`, obrigatória, contador "0/500", erro "Explique o motivo da marcação."). Em "Corrigir
horário" aparece acima o bloco somente leitura "Original: Saída · 17:04". Rodapé: "Enviar pedido"
primário + "Cancelar". Nota `caption`: "O pedido fica pendente até o responsável aprovar e não
conta nas horas antes disso."

---

## 4. Filtros

### 4.1 PeriodFilter

Barra de 48 px: botão `ChevronLeft` (44 px, `aria-label="Mês anterior"`) · rótulo central do
período (`title-sm`, "Novembro de 2026"; com intervalo: "01/11 – 15/11/2026") · `ChevronRight`
(`aria-label="Próximo mês"`; desabilitado no mês corrente quando o futuro não faz sentido) · botão
"Filtro avançado" (`SlidersHorizontal` + texto a partir de 400 px; abaixo disso só o ícone, com
`aria-label="Filtro avançado"`, para o rótulo do mês caber em uma linha). Com intervalo ativo, o botão vira chip `primary-soft` "Período personalizado" com `X`
(`aria-label="Limpar filtro avançado"`) que volta ao mês corrente. O rótulo central é
`aria-live="polite"` para anunciar a troca.

### 4.2 AdvancedFilterModal

Título "Filtro avançado" · campos "Data inicial" e "Data final" (`type="date"`) lado a lado
≥ 360 px · atalhos em chips: "Esta semana", "Semana passada", "Últimos 30 dias" · erros:
"A data final deve ser depois da inicial.", "O período máximo é de 366 dias." · botões
"Aplicar" (primário) e "Limpar" (terciário). Em Aprovações, os filtros de **Situação**
(segmented: Todas · Pendências · Sem marcação) e **Cargo** (`Select`) ficam **na própria tela**,
logo abaixo do `PeriodFilter` (como em `screens/approvals.html`), e não dentro do modal (texto
corrigido na revisão T070). Datas lado a lado a partir de 360 px só se cada campo tiver
≥ 150 px úteis; abaixo disso, empilhadas.

### 4.3 SegmentedControl

Grupo de `radio` estilizado: trilho `surface-2` `rounded-md`, opção 44 px, selecionada `surface`
com `shadow-sm` e texto `text` 650; não selecionada `text-muted`. Usado em: modo semanal/diário,
ativos/inativos, situação no painel. `role="radiogroup"` + `aria-label`.

---

## 5. Aprovações

### 5.1 ApprovalDayGroup

Cabeçalho grudado (`sticky`, `z-sticky`, fundo `bg`) "Segunda, 24 de novembro" + contagem
"3 pessoas". Itens: `ApprovalMemberCard`.

### 5.2 ApprovalMemberCard

Cartão: avatar de iniciais 40 px (`primary-soft`/`primary`) + nome (`title-sm`) + cargo
(`caption text-muted`) + selo de situação: [`CalendarX` Sem marcação · `danger`] ou
[`Hourglass` 2 pendências · `warning`]. Corpo: todas as marcações do dia (linhas da
`TodayTimeline` compactas), cada marcação pendente com justificativa em bloco `surface-2`
(`body-sm`, itálico não) e ações por marcação:

- **Aprovar**: botão `success-solid`, texto branco, `Check` + "Aprovar", 44 px.
- **Rejeitar**: botão secundário com borda `danger` e texto `danger`, `X` + "Rejeitar", 44 px.
- `aria-label` completo: "Aprovar Saída 17:04 de Ana Souza".
- < 1024: os dois botões dividem a largura (50 %/50 %) abaixo da justificativa; ≥ 1024: à direita
  da linha.
- Após aprovar: a linha troca para selo "Aprovada" na hora (otimista), botões somem, toast
  "Marcação aprovada". Se outra pessoa já analisou (409): toast de aviso "Esta marcação já foi
  analisada por Carlos." e a linha atualiza.
- Gestor vendo a própria marcação: sem botões, `caption` "Você não pode aprovar a própria
  marcação."

### 5.3 RejectModal

ConfirmModal com `textarea` "Motivo (opcional)" e botão destrutivo "Rejeitar marcação".

---

## 6. Jornada

### 6.1 ScheduleEditor

Formulário do cargo (`/empresa/cargos/novo` e `/:id`).

1. **Nome do cargo** (`TextField`, obrigatório).
2. **Modo** (`SegmentedControl`): "Igual todos os dias" (semanal) · "Diferente por dia" (diário).
   Texto de ajuda abaixo explicando o modo.
3. **Dias úteis** (só semanal): 7 `checkbox` estilizados como botões de 48 px de altura com a
   sigla (SEG…DOM) — em linha a partir de 460 px; abaixo disso em 2 linhas (4 + 3) para cada
   botão manter ≥ 44 px de largura; marcado = `bg-primary text-on-primary` + `Check` 14 px no canto (não só cor);
   `fieldset`/`legend` "Dias úteis". Erro "Escolha pelo menos um dia útil."
4. **Períodos**: lista ordenada de linhas: número (1–n) · campo "Nome do período" (obrigatório,
   placeholder "Ex.: Entrada") · campo "Previsto" (`type="time"`, opcional) · botões 44 px
   `ArrowUp`/`ArrowDown` ("Mover Pausa para cima") e `Trash2` ("Remover Pausa"). Arrastar é
   opcional e nunca o único meio. Botão terciário "+ Adicionar período". Erros no lugar exato:
   "Dê um nome ao período.", "O horário deve ser depois de Pausa (12:00)."
5. **Carga**: "Carga diária" e "Carga semanal" (`hh:mm`), lado a lado.
6. **Vigência**: "Vale a partir de" (`type="date"`, padrão hoje).
7. **Resumo** (cartão `primary-soft`, `aria-live="polite"`): "Seg–Sex · 4 marcações · 44 h/semana".
8. Rodapé: "Salvar cargo" (primário) · "Excluir cargo" (terciário `danger`, só edição).

**Modo diário**: no lugar de "Dias úteis" aparece a lista dos 7 dias, cada um um painel recolhível
(`DayScheduleRow`): cabeçalho com switch "Dia útil" + resumo ("4 períodos · 08:00"); corpo com a
mesma lista de períodos e "Carga do dia". Ação por dia "Copiar de outro dia" (`Copy`) → menu com
os dias configurados → copia períodos e carga e anuncia "Períodos de Segunda copiados para Sábado".
≥ 1024: os dias ficam em lista vertical à esquerda (abas verticais) e o dia selecionado à direita.

Erros de envio do servidor (`erros[campo]`) mapeiam para o campo correspondente; erro sem campo
vai para um `Notice` `danger` no topo do formulário com foco movido para ele.

### 6.2 PositionCard (lista de cargos)

Nome (`title-sm`) + resumo da jornada (`body-sm text-muted`) + "5 membros" + `ChevronRight`.
Linha inteira é o link (56 px+).

---

## 7. Formulários

### 7.1 TextField / Select / Textarea

- Rótulo `label` acima (sempre visível; placeholder nunca substitui rótulo), campo 48 px,
  `surface`, borda 1 px `border`, `rounded-md`, padding 12 px 14 px, texto `body`.
- Ajuda: `caption text-muted` abaixo, ligada por `aria-describedby`.
- Erro: borda 2 px `danger`, ícone `CircleAlert` 16 px + mensagem `body-sm danger` abaixo
  (`id` ligado por `aria-describedby`), `aria-invalid`. Mensagem aparece ao sair do campo ou ao
  enviar; no envio, foco vai para o primeiro campo com erro e um `Notice` no topo lista
  "Corrija 2 campos para continuar." com links para eles.
- Senha: botão `Eye`/`EyeOff` 44 px dentro do campo ("Mostrar senha"/"Ocultar senha").
- Obrigatório: rótulo sem asterisco; opcionais marcados "(opcional)".
- Somente leitura: fundo `surface-2`, sem borda forte.
- `autocomplete` correto (`email`, `current-password`, `new-password`, `name`, `organization`).

### 7.2 Button

| Variante | Visual | Uso |
|---|---|---|
| `primary` | `bg-primary text-on-primary`, 48 px, `rounded-md`, `text-button` | ação principal da tela (1 por contexto) |
| `secondary` | `surface`, borda 1 px `border`, texto `primary` | ação alternativa |
| `tertiary` | sem fundo, texto `primary`, sublinhado no hover | ação de baixa ênfase, "Cancelar" |
| `danger` | `bg-danger` texto branco | confirmação destrutiva dentro de modal |
| `danger-ghost` | sem fundo, texto `danger` | "Excluir cargo", "Desativar" |
| `success` | `bg-success-solid` texto branco | só "Aprovar" |
| `google` | `surface`, borda `border`, logo G colorido + "Continuar com Google" | login/cadastro |
| `icon` | 44 × 44, `rounded-full`, `aria-label` obrigatório | voltar, mais ações, setas |

Tamanhos: `md` 48 px (padrão), `sm` 44 px (listas densas), `lg` 56 px (confirmar ponto). Largura
total (`w-full`) no celular para a ação principal de formulários.

### 7.3 Notice (aviso inline)

Bloco `rounded-md` padding 12 px, ícone 20 px + texto `body-sm`; variantes `info` (`primary-soft`,
`Info`), `warning` (`warning-soft`, `TriangleAlert`), `danger` (`danger-soft`, `CircleAlert`),
`offline` (`offline-soft`, `CloudOff`), `success`. `role="status"` (ou `alert` para danger após
envio).

---

## 8. Sobreposições (Radix Dialog)

### 8.1 Modal / Sheet

- < 1024: **folha inferior** — largura total, `rounded-t-sheet`, alça decorativa 36 × 4 px,
  altura máx. 90 dvh com rolagem interna, rodapé de ações fixo, `padding-bottom` safe-area;
  entra com `animate-sheet-in`.
- ≥ 1024: diálogo central 480 px (640 px para ScheduleEditor/filtros com 2 colunas),
  `rounded-xl`, `shadow-lg`.
- Scrim `bg-scrim`. Foco preso; `Esc` e botão `X` (44 px, `aria-label="Fechar"`) fecham; foco
  volta ao gatilho. `Dialog.Title` sempre presente (pode ser visualmente igual ao cabeçalho).

### 8.2 ConfirmModal

Props: `title`, `description`, `confirmLabel`, `cancelLabel` ("Cancelar"), `tone`
(`primary`|`danger`), `requireText?` (digitar o nome para confirmar — só transferência),
`children?` (avisos), `onConfirm` (promise → estado carregando no botão).
Ordem dos botões: confirmar em cima/à direita, largura total no celular. Foco inicial: no botão
**Cancelar** quando `tone="danger"`; no **Confirmar** quando `primary`.

Usos: registrar ponto (`PunchConfirm`), rejeitar (com motivo), desativar membro, cancelar pedido,
revogar convite, transferir responsabilidade (`danger` + lista de consequências + campo
"Digite o nome do novo responsável para confirmar").

### 8.3 Toasts (sonner)

- Posição: `top-center` < 1024 (não cobre o botão de ponto nem a BottomNav), `bottom-right` ≥ 1024;
  `z-toast`; largura máx. 420 px.
- Visual: `surface`, `shadow-lg`, `rounded-lg`, faixa de 4 px à esquerda na cor do tipo + ícone
  (`CircleCheck` success, `CircleAlert` danger, `TriangleAlert` warning, `CloudOff` offline,
  `Info` info) + título `body-sm` 650 + descrição opcional `caption`.
- Duração: 4 s (sucesso/info), 6 s (aviso), erros ficam até fechar (botão `X` 44 px). Pausa no
  hover/foco. Região `aria-live="polite"` (erros: `assertive`).
- Textos: "Entrada registrada às 08:02", "Marcação guardada. Será enviada quando a conexão
  voltar.", "Marcação aprovada", "Link copiado".

---

## 9. Offline e PWA

### 9.1 OfflineBanner

Faixa logo abaixo da TopBar (no SideNav layout, no topo da coluna de conteúdo), `bg-banner-offline`,
texto branco `body-sm`, 44 px mín., ícone `CloudOff`: "**Sem conexão.** Você ainda pode registrar o
ponto." Aparece após 2 s offline (R-08), `role="status"`. Ao reconectar, vira por 3 s
`success-soft`/`success` "Conexão restabelecida" e some.

### 9.2 StaleDataNotice

`Notice` `offline` no topo do conteúdo de telas com cache: "Sem conexão — dados de 25/11 às 07:58."
Ações que precisam de servidor ficam desabilitadas com `caption` "Disponível com conexão" ao lado
(nunca escondidas, para não "sumir" funcionalidade).

### 9.3 OfflineQueueIndicator

- Na tela de ponto, entre o botão e a lista: pílula `offline-soft`/`offline` 44 px com
  `CloudUpload` + "**2** aguardando envio" (singular "1 aguardando envio"). `role="status"`.
  Enviando: `LoaderCircle` + "Enviando 2 marcações…". Concluído: some e toast "2 marcações
  enviadas. Ficam pendentes de aprovação."
- Na TopBar/SideNav: ponto índigo de 8 px no ícone "Ponto" + texto oculto "2 aguardando envio".
- **Marcação offline recusada**: `Notice` `danger` persistente na tela de ponto, **abaixo** do botão
  (nunca acima, para não tirá-lo da zona do polegar): `TriangleAlert`
  "Uma marcação feita sem conexão foi recusada" + detalhe "25/11 às 07:58 — horário fora do
  limite permitido." (`too_old`) ou "— horário no futuro." (`future`) + botão "Entendi"
  (dispensa e remove da fila).

### 9.4 UpdatePrompt

Cartão fixo acima da BottomNav (< 1024) / canto inferior esquerdo da coluna de conteúdo (≥ 1024),
`surface`, `shadow-lg`, `rounded-lg`: `RefreshCw` + "Nova versão disponível" + botões "Atualizar"
(primário sm) e "Depois" (terciário). `role="status"`, não rouba foco. Nunca aparece com a
`PunchConfirm` aberta.

### 9.5 InstallAppButton (+ folha iOS)

- Variante `card` (em `/conta` e `/bem-vindo`): cartão com `logo-symbol` 40 px + "Instale o Pontua"
  + "Abra direto da tela inicial, em tela cheia." + botão "Instalar app" (`Download`). Botão
  "Agora não" grava `pontua:install-dismissed`.
- Variante `nav` (SideNav): item discreto "Instalar app".
- Com `beforeinstallprompt`: chama o prompt nativo. Já instalado (`display-mode: standalone`):
  não renderiza.
- **iOS Safari**: abre folha "Instalar no iPhone": passos numerados com ícones — 1. Toque em
  **Compartilhar** (`Share` ícone iOS: quadrado com seta) na barra do Safari; 2. Escolha
  **Adicionar à Tela de Início** (`SquarePlus`); 3. Toque em **Adicionar**. Botão "Entendi".

---

## 10. Estados de conteúdo (FR-006)

### 10.1 LoadingState

Skeleton com a forma do conteúdo (linhas 16 px `surface-2` → `surface-3`), sem shimmer com
reduced-motion. `aria-busy="true"` no contêiner + texto oculto "Carregando…". Exibir após
300 ms (evita piscar). Botões em ação usam o estado "carregando" do Button.

### 10.2 EmptyState

Centralizado, padding 32 px: ícone lucide 40 px em círculo 72 px `primary-soft` → título
`title-sm` → texto `body-sm text-muted` → ação opcional (botão secundário). Exemplos:
"Nenhuma pendência neste mês." (`ClipboardCheck`), "Nenhuma marcação neste período." (`History`)
com "Incluir marcação", "Nenhum convite neste mês." com "Gerar convite".

### 10.3 ErrorState

Igual ao Empty, ícone `TriangleAlert` em círculo `danger-soft`, título "Não foi
possível carregar", texto com a `mensagem` da API ou "Verifique sua conexão e tente de novo.",
botão secundário "Tentar de novo" (`RefreshCw`). `role="alert"`.

---

## 11. Diversos

| Componente | Especificação |
|---|---|
| **Avatar** | iniciais (2 letras) `caption` 700, 40 px (lista) / 56 px (detalhe), `primary-soft`/`primary`; inativo `neutral-soft`/`neutral`. `aria-hidden` (o nome está ao lado). |
| **RoleBadge** | [`Crown` Responsável · `primary`], [`ShieldCheck` Gestor · `success`], [Membro · `neutral`], [Inativo · `neutral`, `Ban`]. |
| **InvitationRow** | cargo (`title-sm`) + selo de situação [Ativo `success` / Expirado `neutral` / Revogado `danger`] + "Vale até 02/12" + "2 aceitaram" + ações `Share2` "Compartilhar", `Copy` "Copiar link", "Revogar" (danger-ghost). |
| **ShareInvite** | após gerar: cartão `primary-soft` com o link em campo somente leitura (fonte mono, quebra) + "Compartilhar" (Web Share API; oculto sem suporte) + "Copiar link" (vira "Copiado" com `Check` por 2 s, `aria-live`). |
| **MemberRow** | Avatar + nome + cargo + RoleBadge + `ChevronRight`; ≥ 1024 em tabela com colunas Nome · Cargo · Papel · Desde · Situação. |
| **SkipLink** | "Pular para o conteúdo", visível só no foco, topo-esquerda, `bg-primary` texto branco. |
