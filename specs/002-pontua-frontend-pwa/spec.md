# Feature Specification: Pontua — App PWA (Frontend)

**Feature Branch**: `002-pontua-frontend-pwa`
**Created**: 2026-11-25
**Status**: Draft
**Input**: User description: "O Pontua será um App PWA para controle de ponto eletrônico, agora
implemente o frontend: use o agente ux-designer para criar o layout; backend em .NET já
implementado; frontend em React como App PWA, focado em mobile mas funcionando nos dois, na
pasta frontend. Cadastro de empresas; cargo e horário de trabalho por usuário; horários diários
ou semanais; períodos por cargo (Entrada, Pausa, Retorno, Saída) livres; dias úteis com
marcação fora deles sujeita a aprovação; quem cria a empresa vira responsável; transferência
nas configurações; cargos, períodos e carga horária semanal; link de convite com cargo; ao
aceitar já marca ponto; marcação esquecida/alterada com justificativa como 'marcação manual' e
aprovação do responsável; tela do responsável com usuários sem marcação em dia útil ou com
marcação manual, com aprovação de cada marcação; filtro por data em todas as telas (por mês,
com filtro avançado por data específica)."

## Escopo desta feature

Esta feature entrega a **interface do usuário** do Pontua: um aplicativo instalável (PWA),
pensado primeiro para celular e que também funciona bem em computador. Todas as regras de
negócio já existem no backend (feature `001-pontua-backend-core`); o app as apresenta e as
opera, sem criar regras novas. O layout e a identidade visual são definidos antes da
implementação das telas, a partir da logomarca existente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar no app e escolher a empresa (Priority: P1)

A pessoa abre o Pontua no celular, cria a conta (e-mail e senha ou Google) ou entra, e pode
instalar o app na tela inicial. Se pertence a mais de uma empresa, escolhe em qual está
trabalhando; se não pertence a nenhuma, vê as opções "Criar empresa" ou "Tenho um convite".

**Why this priority**: é a porta de entrada; nenhuma outra tela é acessível sem ela.

**Independent Test**: criar conta pelo app, sair, entrar de novo e trocar entre duas empresas,
vendo o nome da empresa ativa sempre visível.

**Acceptance Scenarios**:

1. **Given** uma pessoa sem conta, **When** ela preenche nome, e-mail e senha válidos,
   **Then** a conta é criada e ela entra no app sem precisar fazer login de novo.
2. **Given** dados inválidos (e-mail mal formado, senha curta), **When** ela tenta enviar,
   **Then** cada campo com problema mostra a mensagem ao lado do próprio campo.
3. **Given** um usuário com duas empresas, **When** ele entra, **Then** vê a última empresa
   usada já selecionada e pode trocar por um seletor sempre acessível.
4. **Given** um usuário sem empresa, **When** ele entra, **Then** vê as opções de criar
   empresa ou colar/abrir um link de convite.
5. **Given** a sessão expirou, **When** o usuário faz qualquer ação, **Then** volta para a
   tela de entrada com aviso e, depois de entrar, retorna para onde estava.
6. **Given** um navegador compatível, **When** o usuário acessa o app, **Then** recebe a
   opção de instalá-lo na tela inicial e, instalado, o app abre em tela cheia com ícone próprio.

---

### User Story 2 - Bater o ponto (Priority: P1)

Na tela principal, o membro vê a data e a hora atuais, o próximo período esperado (ex.:
"Próxima: Retorno — previsto 13:00"), as marcações já feitas hoje e um botão grande para
registrar o ponto. Sem conexão, a marcação fica guardada no aparelho e é enviada sozinha
quando a internet voltar.

**Why this priority**: é a função central do produto e a ação mais frequente.

**Independent Test**: com conexão, registrar quatro marcações e vê-las listadas com os nomes
dos períodos; desligar a internet, registrar mais uma, religar e vê-la sincronizada como
pendente de aprovação.

**Acceptance Scenarios**:

1. **Given** um membro num dia útil, **When** ele toca em "Registrar ponto" e confirma,
   **Then** vê a confirmação com horário e período ("Entrada registrada às 08:02") e a
   marcação aparece na lista do dia.
2. **Given** um dia fora dos dias úteis do membro, **When** ele abre a tela, **Then** vê um
   aviso de que a marcação ficará pendente de aprovação, e a marcação feita aparece como
   "Pendente".
3. **Given** que o membro marcou há menos de 1 minuto, **When** tenta marcar de novo,
   **Then** o app explica que é preciso aguardar e não registra duplicado.
4. **Given** o aparelho sem conexão, **When** o membro registra o ponto, **Then** o app
   confirma que a marcação foi guardada e será enviada, e mostra um indicador de "aguardando
   envio" com a quantidade.
5. **Given** marcações guardadas offline, **When** a conexão volta (com o app aberto ou na
   próxima abertura), **Then** elas são enviadas automaticamente, aparecem como "Pendente —
   sincronizada offline" e o indicador some; reenvios não geram duplicatas.
6. **Given** o membro já fez todas as marcações previstas, **When** registra outra, **Then**
   ela aparece como "Extra".

---

### User Story 3 - Configurar a empresa: criar empresa, cargos e jornadas (Priority: P1)

Qualquer usuário cria uma empresa e vira o responsável. Nas configurações, o responsável cria
cargos e define a jornada de cada um: dias úteis, períodos com nomes livres e horário previsto
opcional, carga diária e semanal, no modo semanal (igual todos os dias) ou diário (por dia da
semana), escolhendo a partir de quando a mudança vale.

**Why this priority**: sem empresa e cargos não há equipe nem referência para o ponto.

**Independent Test**: criar uma empresa, criar o cargo "Atendente" com 4 períodos de segunda a
sexta e um cargo com sábado diferente, e conferir o resumo visual da jornada de cada cargo.

**Acceptance Scenarios**:

1. **Given** um usuário, **When** ele cria a empresa informando o nome, **Then** entra nela
   como responsável e já pode bater o ponto com o cargo inicial "Responsável".
2. **Given** o responsável, **When** cria um cargo no modo semanal marcando os dias úteis,
   adicionando, renomeando, reordenando e removendo períodos e informando cargas diária e
   semanal, **Then** o cargo é salvo e a jornada aparece resumida (ex.: "Seg–Sex · 4
   marcações · 44 h/semana").
3. **Given** o modo diário, **When** o responsável configura cada dia com períodos e carga
   próprios, **Then** a jornada é salva com as diferenças por dia; o app oferece "copiar de
   outro dia" para agilizar.
4. **Given** uma configuração inválida (nenhum dia útil, horários fora de ordem, período sem
   nome), **When** o responsável tenta salvar, **Then** o app aponta o problema no lugar exato.
5. **Given** um membro que não é responsável, **When** ele navega, **Then** não vê as opções
   de configuração da empresa.
6. **Given** um cargo com membros ativos ou com histórico, **When** o responsável tenta
   excluí-lo, **Then** o app explica por que não é possível e sugere renomear.

---

### User Story 4 - Convidar e entrar por convite (Priority: P1)

O responsável gera um link de convite escolhendo o cargo e a validade, e o compartilha pelos
apps do celular (WhatsApp, e-mail etc.) ou copia. Quem abre o link vê o nome da empresa e o
cargo, entra ou cria a conta e aceita — caindo direto na tela de bater ponto.

**Why this priority**: é o caminho para a equipe entrar; sem ele o produto é de uma pessoa só.

**Independent Test**: gerar convite, abrir o link em outro aparelho sem conta, criar a conta,
aceitar e registrar a primeira marcação.

**Acceptance Scenarios**:

1. **Given** o responsável, **When** gera um convite para "Atendente" com validade de 7 dias,
   **Then** pode compartilhar o link pelo menu nativo do aparelho ou copiá-lo.
2. **Given** um link válido aberto por quem não está logado, **When** a pessoa abre o link,
   **Then** vê "Você foi convidado para Padaria Sol como Atendente", cria a conta ou entra, e
   o convite é aceito sem precisar abrir o link de novo.
3. **Given** um link expirado ou revogado, **When** alguém o abre, **Then** vê uma mensagem
   clara e a orientação de pedir um novo convite.
4. **Given** quem já é membro, **When** abre o link, **Then** o app informa que ele já faz
   parte da empresa e abre a empresa.
5. **Given** o responsável, **When** abre a lista de convites (filtrada por mês), **Then** vê
   situação, cargo, validade e quantas pessoas aceitaram, e pode revogar ou recopiar o link.

---

### User Story 5 - Histórico, resumo e marcação manual (Priority: P2)

O membro consulta seu histórico do mês, dia a dia, com as marcações, horas trabalhadas,
previstas e saldo, e pode trocar de mês ou usar o filtro avançado com datas específicas. Num
dia em que esqueceu de marcar, inclui uma marcação manual; numa marcação errada, pede a
correção — sempre com justificativa. Vê o status de cada pedido e pode cancelar os pendentes.

**Why this priority**: torna o ponto confiável e corrigível, mas o ponto já funciona sem isso.

**Independent Test**: abrir o histórico do mês, incluir uma Saída esquecida de ontem com
justificativa, ver o dia com o selo "Manual · Pendente" e o saldo inalterado; cancelar o pedido.

**Acceptance Scenarios**:

1. **Given** o membro, **When** abre o histórico, **Then** vê o mês corrente com todos os
   dias, as marcações de cada dia com o período e o status, e o total do mês (trabalhado,
   previsto e saldo); dias úteis sem marcação ficam destacados.
2. **Given** o filtro, **When** o membro troca o mês ou escolhe um intervalo no filtro
   avançado, **Then** a lista e os totais refletem só o período escolhido.
3. **Given** um dia passado dentro do limite permitido, **When** o membro inclui uma
   marcação manual com horário e justificativa, **Then** ela aparece como "Manual · Pendente"
   e não entra no total de horas.
4. **Given** uma marcação existente, **When** o membro escolhe "Corrigir horário", **Then**
   informa o novo horário e a justificativa, e o dia mostra a marcação original e a correção
   pendente lado a lado.
5. **Given** datas fora do limite (futuro, antes do limite de dias da empresa ou antes da
   entrada do membro), **When** o membro escolhe a data, **Then** essas datas não podem ser
   selecionadas.
6. **Given** um pedido pendente, **When** o membro o cancela, **Then** ele passa a
   "Cancelado"; pedidos aprovados ou rejeitados mostram quem analisou, quando e o motivo.

---

### User Story 6 - Painel de aprovações (Priority: P2)

O responsável (todos os membros) ou o gestor (membros dos seus cargos) abre o painel e vê,
por dia, quem não marcou em dia útil e quem tem marcações pendentes, com o nome e todas as
marcações do dia, e aprova ou rejeita cada uma. Um contador de pendências fica visível na
navegação.

**Why this priority**: fecha o ciclo da marcação manual; depende das histórias anteriores.

**Independent Test**: com um membro sem marcação ontem e outro com uma manual pendente, abrir
o painel do mês, aprovar a manual e ver o contador e a lista atualizarem.

**Acceptance Scenarios**:

1. **Given** o responsável, **When** abre o painel, **Then** vê o mês corrente agrupado por
   dia (mais recente primeiro), cada membro com nome, cargo, situação ("Sem marcação" ou
   "Pendências") e as marcações do dia com tipo, horário, status e justificativa.
2. **Given** o painel, **When** filtra por situação, cargo, mês ou intervalo, **Then** a
   lista mostra só o que corresponde.
3. **Given** uma marcação pendente, **When** o responsável toca em "Aprovar", **Then** ela
   vira "Aprovada" na hora, sem recarregar a tela; em "Rejeitar", pode informar um motivo.
4. **Given** uma marcação que outra pessoa já analisou, **When** o responsável tenta
   aprovar, **Then** o app avisa e atualiza a situação.
5. **Given** um gestor, **When** abre o painel, **Then** vê só os membros dos cargos
   atribuídos a ele e não vê botões de aprovação nas próprias marcações.
6. **Given** um membro comum, **When** navega, **Then** não vê o painel.

---

### User Story 7 - Configurações: membros, gestores e transferência (Priority: P3)

Nas configurações, o responsável vê os membros, muda o cargo de alguém (a partir de uma
data), define jornada própria para um membro, desativa e reativa membros, designa gestores por
cargo, edita os dados da empresa (nome, documento, fuso, limite de dias para marcação manual) e
transfere a responsabilidade para outro membro.

**Why this priority**: necessário para operar no dia a dia, mas o fluxo principal funciona sem.

**Independent Test**: designar um gestor para "Atendente", transferir a responsabilidade para
ele e verificar que as opções de configuração somem para o antigo responsável.

**Acceptance Scenarios**:

1. **Given** o responsável, **When** abre "Membros", **Then** vê ativos e inativos com cargo,
   papel (responsável, gestor, membro) e pode abrir o detalhe de cada um com histórico e
   resumo de horas do mês.
2. **Given** um membro, **When** o responsável troca o cargo escolhendo a data de início,
   **Then** o detalhe passa a mostrar o novo cargo a partir daquela data.
3. **Given** o responsável, **When** transfere a responsabilidade, **Then** o app pede
   confirmação explícita, explica as consequências e, após confirmar, o antigo responsável
   perde o acesso às configurações imediatamente.
4. **Given** o responsável, **When** tenta desativar a si mesmo, **Then** o app explica que é
   preciso transferir a responsabilidade antes.
5. **Given** um membro gestor, **When** o responsável escolhe os cargos que ele supervisiona,
   **Then** o membro passa a ver o painel restrito a esses cargos.

---

### Edge Cases

- Aparelho sem conexão ao abrir o app: as telas já visitadas mostram os últimos dados
  conhecidos com aviso "Sem conexão — dados de [data/hora]"; ações que exigem servidor (exceto
  bater ponto) ficam desabilitadas com explicação.
- Marcações offline recusadas pelo servidor (horário no futuro, fora do limite): o app avisa
  o membro e remove da fila, mostrando o motivo.
- Relógio do aparelho muito diferente do servidor: a tela principal mostra o horário oficial
  (do servidor) quando disponível.
- App aberto em duas abas ou aparelhos: a fila offline é por aparelho; reenvios não duplicam.
- Troca de empresa com marcações offline pendentes: cada marcação fica ligada à empresa em
  que foi feita e é enviada para ela.
- Lista longa no painel (muitos membros e dias): a tela continua fluida e permite rolar e
  filtrar sem travar.
- Usuário removido (desativado) de uma empresa enquanto usa o app: na próxima ação o app
  informa e volta ao seletor de empresas.
- Link de convite aberto num computador: o fluxo funciona igual ao do celular.
- Texto ampliado a 200% ou tela pequena (320 px de largura): nenhuma informação é cortada.

## Requirements *(mandatory)*

### Functional Requirements

**Plataforma e experiência**

- **FR-001**: O app MUST ser instalável na tela inicial de celulares e computadores, abrir em
  tela cheia com ícone e nome próprios e funcionar no navegador sem instalação.
- **FR-002**: O layout MUST ser pensado primeiro para celular (uso com uma mão, navegação
  inferior) e se adaptar a telas maiores (navegação lateral, uso do espaço extra).
- **FR-003**: A identidade visual (cores, tipografia, componentes, ícones) MUST ser definida
  em uma etapa de design anterior às telas, a partir da logomarca existente, e aplicada de forma
  consistente.
- **FR-004**: Todas as telas MUST atender ao nível AA das WCAG 2.1 (contraste, alvos de toque de
  44 px, rótulos, teclado, foco visível, leitores de tela, zoom de 200%, movimento reduzido).
- **FR-005**: Todos os textos MUST estar em português do Brasil, preparados para tradução futura.
- **FR-006**: O app MUST mostrar estados de carregamento, vazio e erro em todas as telas, com
  mensagens claras e ação para tentar de novo.

**Conta e sessão**

- **FR-007**: O usuário MUST poder criar conta e entrar com e-mail e senha ou com Google, editar
  o próprio nome e trocar ou definir a senha.
- **FR-008**: A sessão MUST ser mantida entre aberturas do app até expirar; ao expirar ou ser
  recusada, o app MUST voltar à entrada e, após o login, retornar à tela em que estava.
- **FR-009**: O usuário MUST poder sair da conta, o que apaga os dados de sessão do aparelho.

**Empresas**

- **FR-010**: O usuário MUST poder criar empresas e alternar entre as empresas de que é membro
  por um seletor sempre acessível; o app MUST lembrar a última empresa usada.
- **FR-011**: As opções visíveis MUST respeitar o papel do usuário na empresa ativa
  (responsável, gestor ou membro).

**Ponto**

- **FR-012**: A tela principal MUST mostrar data e hora atuais, a jornada do dia (períodos
  previstos), o próximo período esperado, as marcações de hoje com status e um botão de
  registro com confirmação.
- **FR-013**: O app MUST guardar marcações feitas sem conexão e enviá-las automaticamente quando
  a conexão voltar, com indicador de quantas aguardam envio, sem gerar duplicatas.
- **FR-014**: O app MUST avisar antes de marcar em dia fora dos dias úteis que a marcação ficará
  pendente de aprovação.

**Histórico e marcação manual**

- **FR-015**: O membro MUST poder ver seu histórico por dia com marcações, período, tipo
  (normal, manual, offline), status, horas trabalhadas, previstas e saldo, além dos totais do
  período e por semana.
- **FR-016**: O membro MUST poder incluir marcação esquecida ou pedir correção de uma existente,
  com justificativa obrigatória; o app MUST impedir a escolha de datas no futuro, antes do limite
  de dias da empresa ou antes da entrada do membro.
- **FR-017**: O membro MUST poder cancelar pedidos pendentes e ver quem analisou, quando e o
  motivo nos pedidos analisados.

**Configuração da empresa (responsável)**

- **FR-018**: O responsável MUST poder criar, renomear e excluir cargos e editar a jornada de
  cada um (modo semanal ou diário, dias úteis, períodos livres com horário opcional, carga
  diária e semanal, data de início da vigência), com validação no próprio formulário.
- **FR-019**: O responsável MUST poder gerar convites por cargo com validade, compartilhar pelo
  menu nativo do aparelho ou copiar o link, listar, recopiar e revogar convites.
- **FR-020**: O responsável MUST poder gerenciar membros (trocar cargo com data de vigência,
  jornada própria, desativar e reativar), designar gestores por cargo, editar os dados da
  empresa e transferir a responsabilidade com confirmação explícita.

**Convite**

- **FR-021**: Abrir um link de convite MUST mostrar empresa e cargo antes do login, permitir
  criar conta ou entrar e concluir o aceite automaticamente, levando o novo membro à tela de
  ponto da empresa.

**Aprovações**

- **FR-022**: Responsável e gestores MUST ter um painel com membros sem marcação em dia útil e
  com marcações pendentes, agrupado por dia, mostrando nome, cargo e todas as marcações do dia,
  com aprovação e rejeição (motivo opcional) por marcação e atualização imediata da lista.
- **FR-023**: A navegação MUST exibir a quantidade de pendências para quem pode aprová-las.

**Filtros de data**

- **FR-024**: Todas as telas com dados ao longo do tempo (histórico, resumo, painel, convites,
  detalhe de membro) MUST abrir no mês corrente, permitir avançar e voltar mês a mês e oferecer
  um filtro avançado com data inicial e final.

### Key Entities

O app usa as entidades do backend (feature 001): Usuário, Empresa, Membro, Cargo, Jornada,
Período, Convite e Marcação. Entidades próprias do app:

- **Sessão local**: credencial do usuário, validade e última empresa usada, guardadas no
  aparelho.
- **Fila de marcações offline**: marcações feitas sem conexão, cada uma com identificador
  único, empresa, horário do aparelho e estado de envio (aguardando, enviada, recusada com
  motivo).
- **Cópia local de dados**: últimos dados carregados das telas visitadas, para exibição sem
  conexão, com data e hora da última atualização.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um membro abre o app instalado e registra o ponto em no máximo 2 toques e menos de
  5 segundos.
- **SC-002**: Um convidado vai do link de convite até a primeira marcação em menos de 2 minutos,
  incluindo a criação da conta.
- **SC-003**: O responsável cria um cargo com jornada de 4 períodos em menos de 3 minutos na
  primeira tentativa.
- **SC-004**: O responsável aprova todas as pendências de um dia com 20 membros em menos de 3
  minutos.
- **SC-005**: 100% das marcações feitas sem conexão chegam ao servidor ao reconectar, sem
  duplicatas.
- **SC-006**: A tela principal aparece em menos de 2 segundos numa conexão móvel comum, e o app
  instalado abre mesmo sem conexão.
- **SC-007**: Todas as telas passam numa verificação automática de acessibilidade WCAG 2.1 AA
  sem erros e são utilizáveis só com teclado e com leitor de tela.
- **SC-008**: Todas as telas funcionam sem rolagem horizontal de 320 px de largura até telas de
  computador.

## Assumptions

- O backend da feature 001 está completo e é a única fonte de regras e dados; nenhuma regra de
  negócio é duplicada no app além de validações de formulário para orientar o usuário.
- A etapa de design (identidade visual, componentes e telas-chave) é feita antes da
  implementação das telas, conforme a constituição, a partir da logomarca em `docs/logomarca`.
- Idioma único nesta versão: português do Brasil, com textos centralizados para tradução futura.
- Notificações push, biometria, geolocalização, foto na marcação e modo escuro manual estão fora
  de escopo desta versão (o app pode seguir o tema claro/escuro do sistema se o design definir).
- Somente a marcação de ponto funciona sem conexão; as demais ações exigem conexão (as telas
  mostram os últimos dados conhecidos).
- O app é servido no mesmo ambiente de homologação local que o backend (serviço já previsto e
  comentado no compose) e, em produção, junto ao backend no cluster.
- Datas, horas e o "hoje" exibidos seguem o fuso horário da empresa ativa.
- A restrição de marcação manual antes da entrada do membro é aplicada no app (datas
  bloqueadas); a validação equivalente no servidor é tratada separadamente.
