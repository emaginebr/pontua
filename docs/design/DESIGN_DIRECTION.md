# Pontua — Direção visual "Expediente"

Tarefa T001 (e manifest de T005) · feature `002-pontua-frontend-pwa` · tokens em
[`tokens.css`](./tokens.css) (+ mapeamento Tailwind em [`tailwind-theme.css`](./tailwind-theme.css)) ·
componentes em [`components.md`](./components.md) · telas em [`screens/`](./screens/index.html) ·
índice de entregáveis em [`README.md`](./README.md).

## 1. Conceito

**Expediente** = um painel de relógio de ponto confiável, em azul-marinho, sobre um app claro e
arejado — com o verde da folha da logomarca marcando o que deu certo. A estrutura é a de um app
utilitário de uso diário (abrir, tocar, fechar); a personalidade vem da logo: o calendário azul
dá a moldura institucional, o relógio verde e a folha dão leveza e "dia em dia".

Três ideias guiam cada tela:

1. **Um polegar, um toque.** O botão de ponto é o maior elemento da tela principal (184 px no
   celular, 216 px no computador), fica na metade inferior — zona natural do polegar — e o
   registro leva no máximo 2 toques (botão → "Confirmar") (SC-001).
2. **O estado é lido, não adivinhado.** Toda situação (Pendente, Aprovada, Offline, Extra, saldo)
   tem **texto + ícone + cor**, nessa ordem de importância. A cor reforça, nunca carrega sozinha
   a informação (Princípio IX).
3. **Calmo e institucional.** Fundo claro azulado, cartões brancos, um único azul de ação, verde
   só para "deu certo". Sem gradientes chamativos (o único degradê é o painel do relógio, dentro
   da mesma família navy), sem glassmorphism, sem ilustrações genéricas.

Evitar: Inter/Roboto como fonte de marca, roxo, gradiente azul→roxo genérico, verde como cor de
botão primário (confunde com "aprovado"), cartões com borda colorida grossa, ícones preenchidos
misturados com ícones de traço, texto em caixa alta longo.

## 2. Logomarca e cores-semente

A logomarca (`docs/logomarca/logo.png`, 2172 × 724 px) tem: símbolo de calendário azul em degradê
com argolas, relógio verde com ponteiros navy, folha verde em dois tons, e a palavra "Pontua"
("Pont" navy, "ua" verde) com um traço verde abaixo.

| Papel na logo | Hex medido | Token de primitiva | Uso no app |
|---|---|---|---|
| "Pont", ponteiros | `#022B4D` | `--pt-logo-navy` | `--pt-brand-navy` (painel do relógio); base do texto `--pt-text` `#0A2540` |
| Calendário (topo) | `#015395` | `--pt-logo-blue` | `--pt-primary` `#0A5394` (ajustado: branco 7,84:1) |
| "ua" | `#158212` | `--pt-logo-green` | `--pt-brand-green` (marca); estados usam `--pt-success` `#11701A` |
| Folha clara / traço | `#4AAC08` | `--pt-logo-leaf` | só decorativo; sobre navy usa-se `--pt-brand-leaf` `#7ED957` |
| Folha escura | `#08771B` | `--pt-logo-green-dark` | referência para `--pt-success-solid` `#1A7F1F` |

### Escala de superfícies

```
bg #F3F6F9  →  surface #FFFFFF  →  surface-2 #EAF0F5  →  surface-3 #DCE5EE
(fundo)        (cartões, barras)    (segmented, read-only)  (hover/pressed)
brand-navy #022B4D → brand-navy-2 #0A4A80   (painel do relógio, degradê 160°)
```

### Cores de estado

| Estado | Texto/ícone | Fundo suave | Ícone lucide | Exemplo |
|---|---|---|---|---|
| Ação primária | `primary #0A5394` | `primary-soft #E3EEF8` | — | botão "Registrar ponto", links |
| Sucesso / Aprovada / saldo + | `success #11701A` | `success-soft #E5F3E3` | `CircleCheck` | "Aprovada", "+01:15" |
| Pendente / fora do dia útil | `warning #8A4B00` | `warning-soft #FFF1D6` | `Hourglass` | "Pendente", aviso de sábado |
| Erro / Rejeitada / saldo − | `danger #B42318` | `danger-soft #FDECEA` | `CircleX` | "Rejeitada", "−00:30" |
| Offline / fila | `offline #4B4F9E` | `offline-soft #ECECF9` | `CloudOff` / `CloudUpload` | "Offline", "2 aguardando envio" |
| Neutro (Cancelada, Substituída, Extra, Inativo) | `neutral #4A5A6A` | `neutral-soft #EDF1F5` | `Ban` / `Undo2` / `Plus` | "Cancelada" |
| Contador de pendências | `brand-navy` sobre `warning-solid #F0A202` | — | — | "3" na aba Aprovações |
| Foco | anel `focus #C2410C` (3 px + 2 px de recuo); sobre navy `#FDBA74` | | | |

Razões de contraste completas no fim de [`tokens.css`](./tokens.css). Resumo: texto principal
≥ 12,2:1 em qualquer superfície; secundário ≥ 5,77:1; cores de estado como texto ≥ 4,91:1; bordas
de controle ≥ 3,11:1; foco ≥ 4,07:1. `brand-green` como texto **só** sobre `bg`/`surface`.

### Regras de uso de cor

- **Azul `primary`** = a única cor de ação (botão cheio, link, aba ativa, item ativo do menu).
- **Verde** = algo confirmado (marcação registrada, aprovada, saldo positivo) e o anel de
  progresso do dia. Nunca como botão primário — exceção: o botão "Aprovar" do painel, que é
  verde **com ícone `Check` e texto**, lado a lado com "Rejeitar".
- **Âmbar** = espera de decisão (Pendente, marcação fora do dia útil, contador).
- **Vermelho** = erro, recusa, saldo negativo **sempre com "−" (U+2212)**, ações destrutivas.
- **Índigo `offline`** = qualquer coisa ligada à falta de conexão (selo Offline, fila).
- Saldos: `+hh:mm` em `success`, `−hh:mm` em `danger`, `00:00` em `text-muted`. O sinal é sempre
  escrito; o leitor de tela recebe "mais 1 hora e 15 minutos" via `aria-label`.

## 3. Tipografia

**Plus Jakarta Sans** (Google Fonts, licença OFL, variável 200–800) — geométrica e arredondada como
o letreiro "Pontua", mas mais aberta e legível em tamanhos pequenos; acentos do português bem
desenhados. Self-host com `@fontsource-variable/plus-jakarta-sans` (fica no precache do service
worker, então funciona offline). Fallback: `system-ui`.

| Token | Tamanho / altura | Peso | Uso |
|---|---|---|---|
| `clock` | 56 px / 1 (72 px ≥ 1024) | 750 | hora atual no painel, `tabular-nums` |
| `display` | 32 / 40 | 750 | totais do mês (trabalhado/saldo) |
| `title-lg` | 24 / 32 | 700 | `h1` da tela |
| `title` | 20 / 28 | 700 | `h2` de seção, título de modal |
| `title-sm` | 17 / 24 | 650 | `h3`, título de cartão, nome do membro |
| `body` | 16 / 24 | 450 | texto corrido, campos |
| `body-sm` | 14 / 20 | 500 | linhas de lista, descrições |
| `caption` | 13 / 18 | 550 | metadados, selos (mínimo do app) |
| `label` | 14 / 20 | 650 | rótulos de campo |
| `button` | 16 / 24 | 650 | botões |
| `punch` | 20 / 24 | 750 | rótulo do botão de ponto |

Regras: todo número de hora/saldo usa `font-variant-numeric: tabular-nums` (horários alinhados em
coluna, relógio não "pula"); títulos e relógio com `letter-spacing: -0.02em`; dias da semana em
caixa alta curta ("SEG") com `0.06em`; tamanhos em `rem` (o zoom e a fonte do sistema escalam);
nunca abaixo de 13 px.

## 4. Iconografia

**lucide-react**, traço 2 px (1,75 px a partir de 24 px de exibição), tamanho padrão 20 px em
listas e 24 px na navegação, sempre em `currentColor`. Ícone decorativo ao lado de texto →
`aria-hidden="true"`; botão só com ícone → `aria-label` em português.

| Conceito | Ícone | Conceito | Ícone |
|---|---|---|---|
| Ponto (aba e botão) | `Clock` | Histórico | `History` |
| Aprovações | `ClipboardCheck` | Empresa | `Building2` |
| Conta | `UserRound` | Seletor de empresa | `ChevronsUpDown` |
| Pendente | `Hourglass` | Aprovada / Registrada | `CircleCheck` |
| Rejeitada | `CircleX` | Cancelada | `Ban` |
| Substituída | `Undo2` | Manual | `PenLine` |
| Offline / sem conexão | `CloudOff` | Aguardando envio | `CloudUpload` |
| Extra | `Plus` | Sem marcação em dia útil | `CalendarX` |
| Filtro avançado | `SlidersHorizontal` | Mês anterior/próximo | `ChevronLeft` / `ChevronRight` |
| Cargos | `Briefcase` | Membros | `Users` |
| Convites | `UserPlus` | Compartilhar / copiar | `Share2` / `Copy` |
| Responsável | `Crown` | Gestor | `ShieldCheck` |
| Transferir | `ArrowLeftRight` | Instalar app | `Download` |
| Nova versão | `RefreshCw` | Aviso | `TriangleAlert` |

## 5. Uso da logomarca

Arquivos gerados em `frontend/public/` (T005) a partir de `docs/logomarca/logo.png` — **não** de
`logo-transparente.png`, que tem resíduos verdes de recorte ao redor de "ua".

| Arquivo | Uso |
|---|---|
| `logo.png` (1086 × 297, fundo transparente) | login, convite, `/bem-vindo`, topo do menu lateral. Altura de exibição 32–40 px (menu) e 48–56 px (login). **Só sobre fundo claro** (`bg`/`surface`): "Pont" é navy e some sobre escuro. |
| `logo-symbol.png` (512, transparente; face do calendário opaca) | barra superior no celular (28 px), estados vazios, splash. |
| `icon-*.png`, `apple-touch-icon.png`, `favicon.*` | PWA e navegador (ver §8). |

- Área de respiro mínima: a altura da argola do calendário (≈ 12 % da altura do símbolo) em volta.
- Não recolorir, não aplicar sombra, não colocar sobre o painel navy nem sobre foto.
- Não existe versão monocromática/negativa oficial; se for necessária (ex.: impressão), pedir
  ao `ux-designer` uma vetorização da marca.
- `alt="Pontua"` na logo; quando o nome "Pontua" já estiver escrito ao lado, `alt=""`.

## 6. Tom de voz

Português do Brasil, frases curtas, verbo no início, tratamento por "você". Fala como um colega
de RH organizado — nunca como sistema.

| Situação | Sim | Não |
|---|---|---|
| Botão de ponto | "Registrar ponto" | "Bater ponto agora!", "Submit" |
| Confirmação | "Entrada registrada às 08:02" | "Operação realizada com sucesso" |
| Offline | "Sem conexão. Sua marcação foi guardada e será enviada quando a internet voltar." | "Erro de rede" |
| Fora do dia útil | "Hoje não é dia útil para você. A marcação ficará pendente de aprovação." | "Atenção: dia inválido" |
| Erro de campo | "Informe um e-mail válido." | "Campo inválido" |
| Vazio | "Nenhuma pendência neste mês." | "Sem dados" |
| Destrutivo | "Transferir responsabilidade" + consequência explícita | "Tem certeza?" |

Regras: horários sempre `HH:mm` 24 h; datas "seg, 24 nov" em listas e "24/11/2026" em campos;
durações `hh:mm` ("08:48"); saldo com sinal; números de quantidade por extenso só até "um"
("1 aguardando envio", "2 aguardando envio"); sem pontos de exclamação, sem emojis.

## 7. Princípios mobile-first

1. **Zona do polegar.** No celular (360 px, referência) o que importa fica no terço inferior: o
   botão de ponto, a barra de navegação (64 px + `safe-area-inset-bottom`) e as ações primárias de
   formulários (botão de largura total no rodapé do conteúdo).
2. **Botão de ponto dominante.** Círculo de 184 px, azul `primary`, sombra `shadow-punch`, anel
   de progresso verde (`brand-leaf` sobre o painel, `brand-green` sobre o claro) mostrando
   quantos períodos do dia já foram marcados. Nada mais na tela tem metade desse tamanho.
3. **Uma coluna < 1024 px, duas colunas ≥ 1024 px.** No computador o menu vira lateral (264 px,
   branco) e as telas usam o espaço extra para colocar lado a lado o que no celular fica empilhado
   (relógio + marcações de hoje; lista de membros + detalhe; resumo + dias).
4. **Alvos ≥ 44 × 44 px**, 8 px de espaço entre alvos vizinhos; botões padrão com 48 px de altura.
5. **Sem rolagem horizontal de 320 px a 1280 px+, e com zoom de 200 %.** Tabelas viram listas de
   cartões abaixo de 1024 px; textos quebram, não cortam (sem `text-overflow` em informação).
6. **Feedback imediato e anunciado.** Toda ação responde em ≤ 100 ms (estado pressionado/
   carregando) e o resultado é anunciado por `aria-live` (toast sonner).
7. **Movimento mínimo.** Transições de 120–320 ms; o único movimento contínuo é o halo pulsante do
   botão de ponto na hora prevista, removido com `prefers-reduced-motion`.
8. **Tema claro apenas.** O app segue sempre o tema claro (`color-scheme: light`): o uso é
   diurno e muitas vezes ao ar livre (sol direto), a logomarca é desenhada para fundo claro e o
   escopo da versão exclui modo escuro manual. Um tema escuro pode ser adicionado depois só
   trocando os valores semânticos de `tokens.css`.

## 8. PWA — manifest e ícones (T005)

| Campo do manifest | Valor | Origem |
|---|---|---|
| `name` / `short_name` | "Pontua" / "Pontua" | — |
| `description` | "Registre seu ponto e acompanhe suas horas." | tom de voz |
| `lang` | `pt-BR` | — |
| `display` | `standalone` | R-14 |
| `theme_color` | **`#FFFFFF`** | `--pt-surface` (barra superior e barra inferior são brancas) |
| `background_color` | **`#F3F6F9`** | `--pt-bg` (splash sem "piscar" ao abrir) |
| `<meta name="theme-color">` | `#FFFFFF` | igual ao manifest |
| ícones `any` | `icon-any-192.png`, `icon-any-512.png` (símbolo em quadrado branco arredondado, transparente fora) | logo.png |
| ícones `maskable` | `icon-maskable-192.png`, `icon-maskable-512.png` (fundo branco sangrado, símbolo dentro do círculo seguro de 80 %) | logo.png |
| `apple-touch-icon` | `apple-touch-icon.png` (180, fundo branco opaco) | logo.png |
| favicon | `favicon.ico` (16/32/48), `favicon.svg`, `favicon-32.png` | logo.png |
| atalho "Registrar ponto" | `shortcut-punch-96.png`, `url: "/?acao=registrar"` | R-14 |
| Open Graph | `og-image.png` (1200 × 630) | logo + tagline |

`favicon.svg` envolve um PNG de 96 px (não há vetor-mestre da logomarca); para um SVG vetorial
real é preciso vetorizar a marca.

## 9. Referências rápidas para o frontend

- Breakpoint único de navegação: `lg` (1024 px). Abaixo: barra superior (56 px) + barra inferior;
  acima: menu lateral fixo + conteúdo com `max-w-content` (1120 px).
- Padding lateral: 16 px (< 1024) / 24 px (≥ 1024). Espaço entre seções: 24 px; entre cartões:
  12 px.
- Cartões: `surface`, `rounded-card` (16 px), `shadow-sm`, borda `separator` 1 px.
- Modais: Radix Dialog; no celular viram folha inferior (`rounded-sheet` no topo, largura total);
  ≥ 1024 viram diálogo central de até 480 px.
- Toasts (sonner): topo-centro no celular (não cobre o botão de ponto nem a barra inferior),
  canto inferior direito no computador.
