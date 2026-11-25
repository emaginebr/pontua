# T073 — Roteiro de validação manual (quickstart) · resultado

Feature `002-pontua-frontend-pwa` · executado em 25/11/2026 (quarta-feira, 19:58–20:10, horário de
Brasília) pelo `ux-designer`, contra a homologação `http://localhost:8081` (nginx + API em `/api`).

**Como foi executado:** Chrome 158 headless com Puppeteer, **pela interface**: cliques, digitação
e teclado de verdade, sem montar estado pela API nos passos testados. Foram usados dois contextos
de navegador separados, sem compartilhar armazenamento:

- **Responsável:** Rita Quickstart, 1280 × 800.
- **Membro convidado:** Marcos Atendente, 360 × 740, DSF 2, toque.

A API foi usada só para **conferir** resultados (duplicatas, status, períodos). Houve uma exceção
no passo 7: a API criou dois membros de apoio (Clara/Caixa e Paulo/Atendente), cada um com uma
pendência, para dar sentido ao teste "gestor vê só atendentes". O modo offline foi simulado com
CDP `Network.emulateNetworkConditions {offline:true}` na página e no service worker.

Evidências: [`quickstart/`](./quickstart/) (screenshots) e
[`quickstart/lighthouse/`](./quickstart/lighthouse/) (relatórios). Os scripts ficam no scratchpad
da sessão (`tools/qs*.mjs`).

## Resultado passo a passo

| # | Passo | Resultado | Evidência / valor medido |
|---|---|---|---|
| 1 | Cadastro → "Bem-vindo"; erro ao lado do campo; sair e entrar | ✅ passou | E-mail inválido + senha curta: Notice "Corrija 2 campos para continuar.", foco no 1º campo inválido, mensagem logo abaixo de cada campo (6 px do e-mail; 30 px da senha, abaixo da ajuda) ligada por `aria-describedby`. Com os dados certos, cai em `/bem-vindo` ("Olá, Rita"). "Sair da conta" → modal → `/entrar` com a sessão apagada. Senha errada → "E-mail ou senha inválidos."; senha certa → `/bem-vindo`. `01a-cadastro-erros`, `01b-bem-vindo`, `01c-login-senha-errada` |
| 2 | Criar empresa → ponto como "Responsável"; cargo semanal "Atendente"; cargo diário com "copiar de outro dia" | ⚠️ parcial | "Padaria Sol" criada → `/`, papel e cargo "Responsável". "Atendente" seg–sex, Entrada/Pausa/Retorno/Saída, 08:00/dia, 44:00/semana → "Cargo Atendente criado"; API: `weekly`, 2640 min, 480 min/dia. "Caixa" diário: Sábado ligado, "Copiar de outro dia" → Segunda → "Períodos de Segunda copiados para Sábado" (Sábado: 4 períodos · 08:00); salvo com 48 h/semana. O fluxo funciona, mas **em 1280 o painel do dia é ilegível**: o campo "Nome do período" tem 30 px (N-01, bloqueante). `02a`–`02f` |
| 3 | Convite para Atendente; copiar link; abrir sem sessão → criar conta → ponto como membro | ✅ passou | Modal "Convite criado" com "Copiar link" e "Compartilhar"; a área de transferência recebeu `http://localhost:8081/convite/DwjS…zKA`, com retorno "Link copiado". No 2º contexto, sem sessão: "Você foi convidado para Padaria Sol como Atendente". "Criar conta e aceitar" → `/cadastro` → `/convite/:token` → `/` em ≈ 6 s, cabeçalho "Padaria Sol · Membro". API: Marcos, cargo Atendente. `03a`–`03d` |
| 4 | 4 marcações; repetir < 1 min → aviso; offline → "1 aguardando envio" → online → "Offline · Pendente", indicador some; sem duplicata | ✅ passou | 20:00 Entrada, 20:01 Pausa, 20:02 Retorno, 20:03 Saída, cada uma com "Registrar ponto?" → Confirmar → toast "Marcação registrada às hh:mm · Período". Repetir logo depois: o botão vira "Aguarde 60 s / para marcar de novo" (desabilitado, nome acessível "Aguarde 60 s para marcar de novo"). Uma 2ª aba do mesmo usuário também mostra a espera. A API recusa a 2ª marcação seguida com 422 "Aguarde pelo menos 1 minuto…". Offline: etiqueta "Sem conexão", diálogo com aviso, toast `CloudOff` "Marcação guardada…", indicador "1 aguardando envio", linha "Extra · Aguardando envio", aviso "Sem conexão — dados de…". Online: o indicador some em 0,5 s, toast "1 marcação enviada. Ficam pendentes de aprovação.", linha "Extra · Offline · Pendente". API: 5 marcações, 1 `offline`, nenhum `punchedAt` repetido. `04a`–`04f` |
| 5 | Histórico: trocar mês; filtro avançado; incluir manual de ontem → "Manual · Pendente", saldo igual; datas antes da entrada bloqueadas; cancelar pedido | ⚠️ parcial | Novembro → "Outubro de 2026" → Novembro. Filtro 20/11–25/11 → "Período personalizado 20/11 – 25/11/2026"; "Limpar" volta ao mês. **"Ontem" não pode ser testado**: o membro entrou hoje, então o campo Data tem `min=max=2026-11-25`, com a ajuda "Só a data de hoje está disponível.", e digitar 24/11 dá "Escolha uma data entre 25/11 e hoje." (isso confirma o bloqueio antes da entrada). A inclusão foi feita **hoje 07:30**: "Pedido enviado", linha "Manual · Pendente", saldo −07:58 antes e depois. Pedido 07:45 → `⋯` → "Cancelar pedido" → confirmação → "Pedido cancelado", linha riscada "Cancelada"; API `cancelled`. Problema visto: a inclusão pendente 07:30 virou "Entrada" e empurrou as válidas — 20:00 apareceu como "Pausa" e a Saída 20:03 como "Extra" (N-02). `05a`–`05h` |
| 6 | Aprovações: contador; aprovar (sem recarregar); rejeitar com motivo; membro vê quem e motivo | ✅ passou | SideNav "Aprovações, 2 pendências". Aprovar a extra offline 20:04 → toast "Marcação aprovada", contador 1, linha "Aprovada por Rita Quickstart em 25/11 às 20:05", sem recarregar (marcador em `window` preservado). Rejeitar 07:35 com motivo → "Marcação rejeitada", contador some, "Rejeitada por … · Motivo: "Horário não confere com a abertura da loja."". O motivo é opcional, como na spec: a 07:30 foi rejeitada com o campo vazio. Membro em `/historico`: "Analisada por Rita Quickstart em 25/11 às 20:06 · Motivo: "…"". Problema visto: depois de rejeitar, as outras linhas do dia continuam com o período antigo ("Pausa 20:00") até recarregar (N-02). `06a`–`06e` |
| 7 | Gestor de Atendente vê só atendentes; transferir responsabilidade → antigo perde configuração | ✅ passou | Membros → Marcos → "Tornar gestor" → "Marcos é gestor" + Atendente → "Marcos agora é gestor". O painel do Marcos (360) mostra só Paulo (Atendente), sem Clara (Caixa); filtro de cargo só com "Atendente"; aba "Aprovações" com "1". Configurações → Novo responsável Marcos → modal com consequências → digitar "Marcos Atendente" → "Transferir" → "Responsabilidade transferida para Marcos Atendente". Rita: SideNav "Membro", sem "Aprovações"; hub da Empresa sem "Configurar"; `/empresa/configuracoes` direto → redireciona para `/`. Marcos: "Responsável" com os 4 atalhos de configuração. `07a`–`07g` |
| 8 | PWA: instalável, SW ativo; casca offline com últimos dados e aviso; Lighthouse | ✅ passou | `Page.getInstallabilityErrors` = **[]** em `/entrar` e `/` (perfil normal; nos contextos anônimos do Puppeteer o único erro é `in-incognito`, esperado). Manifest sem erros, SW `activated` e controlando `/`. Recarregar `/` com página **e** SW offline: a casca abre ("Ponto · Pontua") com "Sem conexão. Você ainda pode registrar o ponto.", "Horário de Brasília · sem conexão", as marcações do dia e "Sem conexão — dados de 25/11 às 20:07.". O Histórico, nunca aberto nesse contexto, mostra corretamente "Sem conexão e sem dados guardados desta tela". Lighthouse: tabela abaixo. `08a`, `08b` |
| 9 | Só teclado; zoom 200%; 320 px sem rolagem horizontal | ⚠️ parcial | Tab na tela de ponto (1280), nesta ordem: "Pular para o conteúdo" → logo → seletor de empresa → Ponto → Histórico → Empresa → conta → **Registrar ponto** → "Histórico". Ordem igual à visual, todos com anel `outline` 3 px laranja. O skip link leva o foco para `main`. Enter abre "Registrar ponto?" com foco em "Confirmar" e o Tab fica preso no diálogo (Fechar → Cancelar → Confirmar); Esc fecha. **Falha:** ao fechar (Esc ou Cancelar), o foco vai para o `body` em vez de voltar ao botão; o mesmo acontece no "Incluir marcação" (N-03). Login só com teclado: Tab → e-mail → senha → Enter → `/`. **320 px:** 20 de 20 rotas OK, `scrollWidth` = `clientWidth` = 320. **200 %** (1280 × 800 → 640 × 400 CSS): 20 de 20 OK, `scrollWidth` = 640. `09a`–`09c`, `09-w320-*`, `09-zoom200-*` |

**Resumo:** 6 ✅ · 3 ⚠️ · 0 ❌. Nenhum passo bloqueou o roteiro.

## Lighthouse (mobile, Lighthouse 13.6, Chrome 158, 4G simulado)

O Lighthouse 12 ou mais novo não tem mais a categoria PWA; a instalabilidade foi medida pelo CDP
(passo 8). Os relatórios foram gerados com SW e caches limpos antes de cada medição.

| Página | Desempenho | Acessibilidade | Boas práticas | SEO | CLS | TBT | Instalável |
|---|---|---|---|---|---|---|---|
| `/entrar` | **100** | **100** | **100** | **100** | 0,001 | 20 ms | sim (0 erros) |
| `/` ponto (logado) | **100** | **100** | **100** | **100** | **0** | 30 ms | sim (0 erros) |

Outras métricas de `/`: FCP 0,6 s · LCP 0,6 s · SI 0,6 s. Em `/entrar` o FCP/LCP saiu "0,0 s",
efeito do Lantern quando a página é preparada na mesma aba; leia como indicativo.

Auditorias reprovadas que não pesam na nota:

- `label-content-name-mismatch` em `/`: 3 nós (seletor de empresa, "Registrar ponto: Extra",
  "Aprovações, 2 pendências"). Ver I-06 na verificação v2 do `REVIEW.md`.
- `render-blocking-insight`: o CSS bloqueia ≈ 150 ms. Aceitável.

Comparado com a T070: `/` foi de 97/100/96/92 para **100/100/100/100**, e CLS de 0,105 para 0.

## Falhas e pendências

| ID | Severidade | Onde | Observado | Esperado |
|---|---|---|---|---|
| N-01 | **Bloqueante** | Editor de cargo, modo diário, 1024–1439 px (passo 2) | O painel do dia tem 72 px (1024) / 328 px (1280); o campo "Nome do período" fica com 30 px e o rótulo vira uma letra por linha. Não dá para ler nem editar os nomes. | Linha do período empilhada (como no celular) enquanto o painel tiver < 560 px (container query); lista de dias mais estreita em `lg:`. |
| N-02 | **Importante** | Backend (cálculo de períodos) + Aprovações (passos 5 e 6) | Uma inclusão manual pendente (07:30) vira "Entrada" e empurra as válidas: 20:00 aparece como "Pausa" e a Saída válida 20:03 como "Extra". As horas não mudam. No painel de Aprovações, depois de rejeitar, as outras linhas mantêm o período errado até recarregar. | Períodos das válidas calculados só com válidas/aprovadas; a pendente fica no período que teria se aprovada, sem deslocar as demais. O painel recarrega o dia após aprovar ou rejeitar. |
| N-03 | **Importante** | `Modal` global (passo 9) | Ao fechar com Esc, Cancelar ou `X`, o foco vai para o `body`. | Foco volta ao gatilho (`components.md` §8.1; WCAG 2.4.3). |
| N-04 | **Importante** | Tela de ponto, "Marcações de hoje" | A correção pendente aparece como linha solta com o mesmo nome de período da original ("Pausa 08:01" + "Pausa 19:49"). | Par original/correção numa linha, como no histórico. |
| N-05 | Menor | Histórico, semanas/resumo | "trabalhado 0 minuto de 0 minuto previstos". | "0 minutos" (chaves `_zero`). |
| N-06 | Menor | Editor diário 360 | O resumo "4 períodos · 07:00" quebra com o "4" sozinho. | Sem quebra entre número e unidade. |
| I-06 | Menor | Nomes acessíveis | O Lighthouse ainda reprova `label-content-name-mismatch` (pontuação/ordem). | Nome = texto visível + complemento, sem pontuação intermediária. |

Limitação de dados (não é defeito): "incluir manual de **ontem**" não pode ser feito com contas
criadas no dia do teste. O app bloqueia corretamente datas antes da entrada. Para cobrir o caso
literal, repetir o passo 5 com um membro que tenha entrado pelo menos 1 dia antes.

## Verificação v2 da revisão T070

Detalhe item a item em [`../REVIEW.md` › "Verificação (v2)"](../REVIEW.md#verificação-v2):

| | ✅ resolvido | ⚠️ parcial | ❌ não resolvido |
|---|---|---|---|
| Bloqueantes (3) | 2 | 1 (B-02) | 0 |
| Importantes (17) | 15 | 1 (I-06) | 1 (I-14 → regressão N-01) |
| Ajustes finos (23) | 21 | 2 (A-15, A-16, ambos aceitáveis) | 0 |
| **Total (43)** | **38** | **4** | **1** |

## Reverificação (v3)

Executada em 25/11/2026, das 20:29 às 20:40 (horário de Brasília), pelo `ux-designer`, contra a
homologação `http://localhost:8081`, já com as correções de frontend e backend para N-01 a N-06 e
I-06. Usei o mesmo Chrome 158 headless com Puppeteer da T073. Para ter um cenário controlado, criei
pela API a empresa "Mercado V3" com 3 pessoas:

- **Olga Verifica**, responsável.
- **Davi Válidas**, Atendente: 4 inclusões manuais aprovadas (08:00, 12:00, 13:00, 20:03), que
  contam como válidas, mais 1 inclusão pendente às 07:30.
- **Eva Correção**, Atendente: 1 marcação real às 20:30, um pedido de correção pendente para
  08:01 e uma inclusão pendente às 07:00.

Os passos verificados foram feitos pela interface. Evidências em [`v3/`](./v3/) e
[`v3/lighthouse/`](./v3/lighthouse/).

| Item | Resultado | Evidência / valor medido |
|---|---|---|
| **N-01 / I-14** editor diário | ✅ resolvido | Menu lateral visível (264 px) em 1024, 1280 e 1440. Medidas por largura: **1024**: lista de dias em cima, painel do dia com 368 px, campo "Nome do período" com **172 px**. **1280**: dias em grade de 2 colunas, painel com 624 px, campo com **280 px**, ações ↑ ↓ 🗑 na mesma linha. **1440**: lista de dias à esquerda e painel à direita (520 px), campo com **324 px**. **360**: acordeão, campo com **130 px**, ações abaixo. Nas 4 larguras: rótulo "Nome do período" em 1 linha, nenhum controle fora do painel, 0 sobreposições, nenhum elemento cortado, `scrollWidth` = viewport. `N01-cargo-diario-{1024,1280,1440,360}`, `N01-cargo-diario-360-segunda-aberta` |
| **N-02** períodos com inclusão pendente | ✅ resolvido | Davi, antes de aprovar. **Histórico:** 07:30 "Entrada · Manual · Pendente" (hipotético) e depois Entrada 08:00 · Pausa 12:00 · Retorno 13:00 · Saída 20:03, todas aprovadas. **Painel de Aprovações:** a mesma sequência; a API devolve a mesma coisa. Ao clicar em "Aprovar Entrada 07:30 de Davi Válidas" aparece o toast "Marcação aprovada" e, **sem recarregar** (o marcador `window.__v3marker` continuou na página), as linhas do Davi passam a Entrada 07:30 · Pausa 08:00 · Retorno 12:00 · Saída 13:00 · **Extra 20:03**. O contador cai de 3 para 2. O histórico do membro mostra o mesmo resultado. `N02a`–`N02e` |
| **N-03** foco ao fechar modal | ✅ resolvido | Fiz 11 aberturas e fechamentos em 4 modais: "Registrar ponto?" (Esc, Cancelar, X), "Filtro avançado" em Aprovações (Esc, X; esse modal não tem Cancelar, tem Limpar/Aplicar) e em Histórico (Esc), e "Rejeitar marcação?" (Esc, Cancelar, X). Abri pelo teclado e também pelo mouse. Nos **11 de 11** casos, `document.activeElement` voltou ao botão que abriu o modal. Exemplos: "Registrar ponto Entrada · previsto 08:00", "Filtro avançado", "Rejeitar Entrada 07:00 de Eva Correção". Quando o modal é fechado pelo teclado, o anel de foco aparece (`:focus-visible`). `N03-rejeitar-aberto`, `N03-rejeitar-fechado-foco-no-gatilho` |
| **N-04** correção na tela de ponto | ✅ resolvido | Eva, em "Marcações de hoje": uma única linha "Entrada · previsto 08:00 · **20:30 Original** › / Correção pedida **08:01** Manual · Pendente". A inclusão 07:00 fica em linha própria e a Pausa aparece como "Próxima". Mesmo resultado em 360 e 1280. `N04-ponto-correcao-{360,1280}` |
| **N-05** plurais com zero | ✅ resolvido | Histórico (Davi e Olga, 360 e 1280): "trabalhado **0 minutos** de **0 minutos** previstos". A busca por `0 minuto|hora|dia|pendência|marcação|pessoa|período` no singular não encontrou nada em Histórico, Ponto e Cargos. `N05-historico-semanas-1280` |
| **N-06** resumo do dia em 360 | ✅ resolvido | "4 períodos · 07:00" fica em 1 linha (`white-space: nowrap` nas partes). Observação nova (ajuste fino, **N-07**): em **1440**, a lista de dias tem 116 px por item e o "· 07:00" desce para a 2ª linha começando pelo separador. `N01-cargo-diario-1440-lista-dias` |
| **I-06** Lighthouse mobile, ponto logado | ✅ resolvido | Lighthouse 13.6 em `/` como responsável (Olga, com seletor de empresa e "Aprovações" com pendências) e como membro (Davi): **100 / 100 / 100 / 100** nos dois. CLS 0,002 / 0; TBT 40 / 20 ms. `label-content-name-mismatch` = **não aplicável**: nenhum nó tem `aria-label` divergente; o botão de ponto passou a usar o texto visível como nome. Nenhuma auditoria de acessibilidade reprovada. `v3/lighthouse/ponto-owner.html`, `ponto-davi.html` |
| Regressão 320 px | ✅ sem regressão | **20 de 20** rotas com `scrollWidth` = `clientWidth` = 320: públicas, ponto, histórico e detalhe, aprovações, empresa, membros e detalhe, cargos (novo, semanal, diário), convites, configurações, conta, nova empresa, boas-vindas. `R320*` |

**Resumo v3:** 8 ✅ · 0 ⚠️ · 0 ❌. **Não sobra nenhum bloqueante nem importante.** O único achado novo
é N-07 (ajuste fino, cosmético): no editor diário em ≥ 1440 px, o resumo de cada dia na lista
estreita quebra antes de "· 07:00". → Pôr o separador e a carga num `span` com `whitespace-nowrap`,
ou mostrar a carga em linha própria sem o "·".
