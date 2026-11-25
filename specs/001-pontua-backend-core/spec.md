# Feature Specification: Pontua — Núcleo do Backend de Ponto Eletrônico

**Feature Branch**: `001-pontua-backend-core`
**Created**: 2026-11-25
**Status**: Draft
**Input**: User description: "O Pontua será um App PWA para controle de ponto eletrônico: backend em
.NET na pasta backend; frontend React PWA focado em mobile na pasta frontend (não será desenvolvido
agora). Cadastro de empresas; usuário com cargo e horário de trabalho; horários configuráveis de
forma diária ou semanal; períodos configuráveis por cargo (ex.: Entrada, Pausa, Retorno, Saída);
dias úteis por usuário, com marcação fora deles sujeita a aprovação; qualquer usuário cria uma
empresa e vira responsável; transferência de responsabilidade; cargos, períodos e carga horária
semanal por cargo; link de convite com cargo definido; marcação manual com justificativa e
aprovação; tela do responsável com usuários sem marcação em dia útil ou com marcação manual,
com aprovação de cada marcação; filtro por data (mês e data específica) em todas as telas.
Criar apenas o backend nesse primeiro momento."

## Escopo desta feature

Esta feature entrega **apenas o backend** (regras de negócio, dados e serviços consumidos pelo
futuro app). O frontend PWA fica fora de escopo, mas todas as capacidades descritas aqui
**DEVEM** estar disponíveis para que o app possa ser construído depois sem novas regras de
negócio. As "telas" citadas abaixo referem-se às consultas que o backend deve oferecer para
alimentá-las.

## Clarifications

### Session 2026-11-25

- Q: Exigência legal (Portaria MTP 671/2021) → A: Modelo de dados pronto para a portaria
  (marcações imutáveis e NSR por empresa); geração de AFD/AEJ e comprovante fica para depois.
- Q: Marcação sem internet → A: Aceita com o horário do aparelho, enviada quando a conexão
  voltar, identificada como "sincronizada offline" e sempre pendente de aprovação.
- Q: Limite retroativo para marcação manual → A: Configurável pelo responsável por empresa,
  padrão de 30 dias.
- Q: Quem pode aprovar marcações → A: Gestor por cargo: o responsável designa gestores e
  atribui cargos a cada um; o gestor aprova/rejeita e consulta apenas membros desses cargos.
- Q: Significado de jornada "diária ou semanal" → A: Ambos: modo semanal/diário para os
  horários, horários previstos opcionais por período, e sempre carga diária e carga semanal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conta e criação de empresa (Priority: P1)

Uma pessoa cria sua conta (e-mail e senha, ou conta Google), entra no sistema e cadastra uma
empresa. Ao criar a empresa, ela passa automaticamente a ser a **responsável** por ela.

**Why this priority**: sem conta e sem empresa nenhuma outra funcionalidade existe; é a base
de todo o produto.

**Independent Test**: criar uma conta, entrar, cadastrar uma empresa e verificar que a pessoa
aparece como responsável e consegue ver os dados da empresa.

**Acceptance Scenarios**:

1. **Given** uma pessoa sem conta, **When** ela se cadastra com nome, e-mail e senha válidos,
   **Then** a conta é criada e ela consegue entrar no sistema.
2. **Given** um usuário autenticado, **When** ele cadastra uma empresa com nome válido,
   **Then** a empresa é criada e ele fica registrado como responsável e membro dela.
3. **Given** um usuário que é responsável por uma empresa, **When** ele cria uma segunda
   empresa, **Then** ele passa a ser responsável pelas duas, e cada uma tem dados isolados.
4. **Given** um usuário sem vínculo com uma empresa, **When** ele tenta ver os dados dela,
   **Then** o acesso é negado.

---

### User Story 2 - Cargos, períodos e jornada de trabalho (Priority: P1)

O responsável cria os cargos da empresa. Para cada cargo ele define a **jornada**: quais
períodos de marcação existem (ex.: Entrada, Pausa, Retorno, Saída — nomes e quantidade livres),
o horário previsto de cada período (opcional, para jornadas flexíveis), os dias da semana
trabalhados, a carga horária diária e a carga horária semanal. A jornada pode ser **semanal**
(os mesmos períodos, horários e carga diária para todos os dias trabalhados) ou **diária**
(períodos, horários e carga diária diferentes para cada dia da semana).

**Why this priority**: as marcações, os dias úteis e as pendências do responsável dependem da
jornada; sem ela o ponto não tem referência.

**Independent Test**: criar um cargo com jornada semanal (4 períodos, segunda a sexta, 44 h) e
outro com jornada diária (horários distintos no sábado) e consultar a jornada prevista de cada
dia da semana.

**Acceptance Scenarios**:

1. **Given** o responsável de uma empresa, **When** ele cria o cargo "Atendente" com os períodos
   Entrada 08:00, Pausa 12:00, Retorno 13:00 e Saída 17:00, de segunda a sexta, **Then** a
   jornada prevista de qualquer dia útil desse cargo retorna esses quatro períodos.
2. **Given** um cargo com jornada diária, **When** o responsável define sábado com apenas
   Entrada 08:00 e Saída 12:00, **Then** a jornada prevista do sábado tem só esses dois
   períodos e os demais dias mantêm seus próprios horários.
3. **Given** um cargo, **When** o responsável define carga diária de 8 horas e carga semanal
   de 44 horas, **Then** esses valores ficam disponíveis nos resumos de horas dos membros do
   cargo, por dia e por semana.
3a. **Given** um cargo com jornada flexível (períodos Entrada e Saída sem horário previsto e
   carga diária de 6 horas), **When** um membro marca Entrada às 10:00 e Saída às 16:00,
   **Then** as marcações são associadas aos períodos na ordem e o dia fecha com 6 horas.
4. **Given** um membro que não é responsável, **When** ele tenta criar ou alterar um cargo,
   **Then** a operação é negada.
5. **Given** um cargo com membros ativos, **When** o responsável tenta excluí-lo, **Then** a
   exclusão é recusada com mensagem explicando que há membros vinculados.

---

### User Story 3 - Convite e entrada na empresa (Priority: P1)

O responsável gera um link de convite já vinculado a um cargo. Quem abre o link e aceita
(entrando ou criando a conta) vira membro da empresa naquele cargo e já pode marcar o ponto.

**Why this priority**: é o único caminho para colaboradores entrarem na empresa; sem ele o
responsável marca ponto sozinho.

**Independent Test**: gerar um convite para o cargo "Atendente", aceitá-lo com outra conta e
verificar que essa conta virou membro com o cargo e a jornada corretos.

**Acceptance Scenarios**:

1. **Given** o responsável, **When** ele gera um convite para o cargo "Atendente", **Then**
   recebe um link único com data de expiração.
2. **Given** um link de convite válido, **When** um usuário autenticado o aceita, **Then** ele
   vira membro ativo da empresa com o cargo do convite e a jornada desse cargo.
3. **Given** um convite expirado ou revogado, **When** alguém tenta aceitá-lo, **Then** a
   operação é recusada com mensagem clara.
4. **Given** um usuário que já é membro ativo da empresa, **When** ele aceita outro convite da
   mesma empresa, **Then** nenhum vínculo duplicado é criado.
5. **Given** o responsável, **When** ele lista os convites, **Then** vê os ativos, expirados e
   revogados, e pode revogar qualquer convite ativo.

---

### User Story 4 - Marcação de ponto (Priority: P1)

O membro registra suas marcações ao longo do dia. Cada marcação recebe o horário do servidor e
é associada ao próximo período previsto da jornada (ex.: primeira do dia = Entrada). Ele
consulta seu histórico por mês ou por intervalo de datas.

**Why this priority**: é a função central do produto — controle de ponto.

**Independent Test**: com um membro de jornada de 4 períodos, registrar quatro marcações num dia
útil e consultar o histórico do mês, vendo os quatro períodos preenchidos.

**Acceptance Scenarios**:

1. **Given** um membro ativo num dia útil, **When** ele registra uma marcação, **Then** ela é
   gravada com o horário do servidor, tipo "normal", associada ao próximo período previsto e
   já considerada válida.
2. **Given** um membro que já preencheu todos os períodos previstos do dia, **When** ele
   registra outra marcação, **Then** ela é gravada como marcação extra do dia.
3. **Given** um membro num dia fora dos seus dias úteis, **When** ele registra uma marcação,
   **Then** ela é aceita, mas fica **pendente de aprovação** do responsável, com o motivo
   "fora do dia útil".
4. **Given** um membro com marcações em vários meses, **When** ele consulta o histórico de um
   mês, **Then** recebe apenas as marcações daquele mês, agrupadas por dia, com o status de
   cada uma.
5. **Given** um membro, **When** ele consulta um intervalo de datas específico, **Then** recebe
   apenas as marcações dentro do intervalo.
6. **Given** um membro, **When** ele consulta o resumo de um período, **Then** vê as horas
   trabalhadas (apenas marcações válidas) comparadas à carga horária prevista.
7. **Given** um membro que registrou uma marcação sem conexão, **When** o app a envia depois,
   **Then** ela é gravada com o horário do aparelho, identificada como "sincronizada offline"
   e pendente de aprovação; um reenvio da mesma marcação não cria duplicata.

---

### User Story 5 - Marcação manual com justificativa (Priority: P2)

O membro inclui uma marcação que esqueceu de registrar, ou corrige o horário de uma marcação
existente, informando data, horário e uma justificativa. A marcação fica identificada como
**"marcação manual"** e só passa a valer depois da aprovação do responsável.

**Why this priority**: esquecimentos são comuns e, sem correção, o histórico fica errado; mas o
ponto já funciona sem isso.

**Independent Test**: incluir uma marcação manual de Saída para ontem com justificativa e
verificar que ela aparece como manual e pendente, sem entrar no total de horas até ser aprovada.

**Acceptance Scenarios**:

1. **Given** um membro, **When** ele inclui uma marcação para uma data passada com horário e
   justificativa, **Then** ela é gravada como "marcação manual", com status pendente.
2. **Given** um membro, **When** ele tenta incluir uma marcação manual sem justificativa,
   **Then** a operação é recusada.
3. **Given** uma marcação existente, **When** o membro solicita a alteração do horário com
   justificativa, **Then** é criada uma marcação manual pendente que substitui a original
   somente após aprovação; o horário original continua registrado.
4. **Given** uma marcação manual pendente, **When** o membro a cancela antes da análise,
   **Then** ela deixa de aparecer como pendente para o responsável.
5. **Given** um membro, **When** ele tenta incluir uma marcação manual com data ou horário no
   futuro, **Then** a operação é recusada.
6. **Given** uma empresa com limite retroativo de 30 dias, **When** o membro tenta incluir uma
   marcação manual de 31 dias atrás, **Then** a operação é recusada informando o limite.

---

### User Story 6 - Painel de pendências e aprovação (Priority: P2)

O responsável (para todos os membros) ou um gestor (para os membros dos cargos atribuídos a
ele) consulta, para um dia ou período, a lista de membros que (a) não fizeram nenhuma
marcação em um dia útil ou (b) têm marcações pendentes (manuais ou fora do dia útil). Para cada
membro ele vê o nome e as marcações do dia, e aprova ou rejeita cada marcação individualmente.

**Why this priority**: fecha o ciclo da marcação manual e dá controle ao responsável; depende
das histórias anteriores.

**Independent Test**: com um membro sem marcações num dia útil e outro com uma marcação manual,
consultar o painel do dia, ver os dois listados, aprovar a marcação manual e verificar que ela
passa a contar nas horas do membro.

**Acceptance Scenarios**:

1. **Given** um dia útil em que um membro não marcou nada, **When** o responsável consulta o
   painel daquele dia, **Then** o membro aparece na lista como "sem marcação".
2. **Given** um membro com marcação manual pendente no dia, **When** o responsável consulta o
   painel, **Then** o membro aparece com o nome e todas as marcações do dia, indicando quais
   estão pendentes, com a justificativa.
3. **Given** uma marcação pendente, **When** o responsável a aprova, **Then** ela passa a ser
   válida, entra no total de horas e sai da lista de pendências; se era uma correção, passa a
   substituir a marcação original.
4. **Given** uma marcação pendente, **When** o responsável a rejeita (com motivo opcional),
   **Then** ela não conta nas horas e o membro consegue ver a rejeição e o motivo.
5. **Given** o responsável, **When** consulta o painel por mês, **Then** recebe as pendências
   de todos os dias do mês, agrupadas por dia.
6. **Given** um membro que não é responsável nem gestor, **When** ele tenta aprovar uma marcação,
   **Then** a operação é negada.

---

### User Story 7 - Gestão de membros e transferência de responsabilidade (Priority: P3)

Na área de configurações, o responsável altera o cargo de um membro, ajusta a jornada individual
dele (dias úteis e horários próprios, quando diferentes do cargo), desativa membros e transfere
a responsabilidade da empresa para outro membro.

**Why this priority**: necessário para operar a empresa no dia a dia, mas o fluxo principal já
funciona sem ele.

**Independent Test**: transferir a responsabilidade para outro membro e verificar que o novo
responsável consegue aprovar marcações e o antigo não.

**Acceptance Scenarios**:

1. **Given** o responsável e um membro ativo, **When** ele transfere a responsabilidade para
   esse membro, **Then** o membro passa a ser o único responsável e o antigo responsável
   continua como membro comum.
2. **Given** o responsável, **When** tenta transferir a responsabilidade para alguém que não é
   membro ativo, **Then** a operação é recusada.
3. **Given** um membro, **When** o responsável muda seu cargo, **Then** a nova jornada vale a
   partir da data da mudança, sem alterar dias anteriores.
4. **Given** um membro, **When** o responsável define dias úteis próprios para ele (ex.: só
   terça e quinta), **Then** esses dias prevalecem sobre os do cargo para esse membro.
5. **Given** um membro, **When** o responsável o desativa, **Then** ele não consegue mais marcar
   ponto nessa empresa, mas seu histórico continua disponível para o responsável.
6. **Given** o responsável, **When** ele tenta desativar a si mesmo, **Then** a operação é
   recusada até que a responsabilidade seja transferida.
7. **Given** o responsável, **When** ele designa um membro como gestor do cargo "Atendente",
   **Then** esse gestor passa a ver no painel e aprovar marcações apenas dos atendentes.
8. **Given** um gestor do cargo "Atendente", **When** ele tenta aprovar uma marcação de um
   membro de outro cargo ou uma marcação própria, **Then** a operação é negada.

---

### Edge Cases

- Membro registra marcação logo após a meia-noite referente a uma jornada que começou no dia
  anterior: a marcação pertence ao dia do calendário em que foi feita, no fuso da empresa.
- Membro registra duas marcações em sequência por engano (segundos de diferença): o sistema
  recusa uma nova marcação normal se a anterior foi feita há menos de 1 minuto.
- Feriados não são reconhecidos automaticamente; um feriado num dia útil aparece no painel como
  "sem marcação" e o responsável simplesmente o ignora.
- Mudança de jornada do cargo: alterações valem dali em diante; dias passados continuam
  avaliados pela jornada vigente na época.
- Membro pertence a mais de uma empresa: cada marcação é sempre feita numa empresa específica e
  só aparece para o responsável dessa empresa.
- Membro desativado que recebe novo convite da mesma empresa: é reativado com o cargo do novo
  convite.
- Responsável que também trabalha na empresa: marca ponto normalmente; suas marcações manuais
  são aprovadas por ele mesmo, e a aprovação fica registrada com autor e data.
- Gestor desativado ou que muda de cargo: perde/mantém as atribuições conforme definido pelo
  responsável; um membro desativado perde automaticamente a designação de gestor.
- Transferência de responsabilidade para um gestor: ele deixa de ser gestor (o responsável já
  vê todos os membros) e suas atribuições de cargo são removidas.
- Correção de uma marcação que já tinha uma correção pendente: a correção anterior passa
  automaticamente para o status "cancelada" (continua registrada) e a nova fica pendente.
- Filtro de datas inválido (data inicial maior que a final, ou intervalo acima de 366 dias):
  a consulta é recusada com mensagem clara.

## Requirements *(mandatory)*

### Functional Requirements

**Contas e acesso**

- **FR-001**: O sistema MUST permitir cadastro de conta com nome, e-mail e senha, e entrada com
  e-mail e senha ou com conta Google.
- **FR-002**: O sistema MUST exigir autenticação em todas as operações, exceto cadastro, entrada
  e consulta pública dos dados básicos de um convite (nome da empresa e cargo).
- **FR-003**: O sistema MUST garantir que um usuário só acesse dados das empresas das quais é
  membro ativo, e que operações administrativas (empresa, cargos, jornadas, convites, membros,
  gestores e transferência) sejam permitidas apenas ao responsável.

**Empresas e responsabilidade**

- **FR-004**: Qualquer usuário autenticado MUST poder criar uma empresa (nome obrigatório,
  documento e fuso horário opcionais; fuso padrão America/Sao_Paulo) e tornar-se seu
  responsável e membro.
- **FR-005**: Cada empresa MUST ter exatamente um responsável em qualquer momento.
- **FR-006**: O responsável MUST poder editar os dados da empresa e transferir a
  responsabilidade para outro membro ativo; o antigo responsável continua como membro.
- **FR-007**: Um usuário MUST poder pertencer a várias empresas e listar as empresas das quais
  é membro, indicando em quais é responsável.

**Cargos e jornadas**

- **FR-008**: O responsável MUST poder criar, editar, listar e excluir cargos; a exclusão MUST
  ser recusada enquanto houver membros ativos no cargo.
- **FR-009**: Cada cargo MUST ter uma jornada composta por: dias da semana trabalhados, lista
  ordenada de períodos de marcação com nome livre e horário previsto **opcional**, carga
  horária diária e carga horária semanal (ambas obrigatórias).
- **FR-010**: A jornada MUST suportar o modo **semanal** (mesmos períodos, horários e carga
  diária em todos os dias trabalhados) e o modo **diário** (períodos, horários e carga diária
  definidos por dia da semana).
- **FR-010a**: Quando os períodos não têm horário previsto, as marcações do dia MUST ser
  associadas aos períodos pela ordem de registro; a referência para avaliação passa a ser
  apenas a carga diária e semanal.
- **FR-011**: O responsável MUST poder definir, para um membro específico, dias úteis e/ou
  jornada próprios, que prevalecem sobre os do cargo.
- **FR-012**: Alterações de jornada (do cargo ou do membro) e mudanças de cargo MUST valer a
  partir da data de vigência informada (padrão: hoje), preservando a avaliação de dias
  anteriores.

**Convites e membros**

- **FR-013**: O responsável MUST poder gerar links de convite vinculados a um cargo, com
  expiração (padrão 7 dias), reutilizáveis até expirar ou serem revogados.
- **FR-014**: Ao aceitar um convite válido, o usuário MUST tornar-se membro ativo com o cargo do
  convite e poder marcar ponto imediatamente.
- **FR-015**: O responsável MUST poder listar membros (ativos e inativos), alterar cargo,
  desativar e reativar membros; o responsável não pode ser desativado.

**Marcações**

- **FR-016**: Um membro ativo MUST poder registrar uma marcação normal, gravada com o horário do
  servidor no fuso da empresa e associada ao próximo período previsto do dia (ou como extra).
- **FR-017**: Marcações normais em dias úteis MUST ser válidas imediatamente; marcações em dias
  fora dos dias úteis do membro MUST ficar pendentes de aprovação.
- **FR-017a**: O sistema MUST aceitar marcações registradas offline no aparelho e enviadas
  depois, com o horário informado pelo aparelho e o horário de recebimento pelo servidor; elas
  MUST ser identificadas como "sincronizada offline", ficar pendentes de aprovação e ser
  recusadas se o horário do aparelho estiver no futuro em relação ao servidor. O reenvio da
  mesma marcação (mesmo identificador gerado no aparelho) MUST NOT gerar duplicidade.
- **FR-018**: Um membro MUST poder incluir uma marcação esquecida ou solicitar correção de uma
  existente, informando data, horário (nunca no futuro) e justificativa obrigatória; ela MUST
  ser identificada como "marcação manual" e ficar pendente de aprovação.
- **FR-018a**: Marcações manuais MUST ser recusadas se a data informada for anterior ao limite
  retroativo da empresa (quantidade de dias configurável pelo responsável, padrão 30, mínimo 1).
- **FR-019**: A marcação original MUST ser preservada quando houver correção; a correção só a
  substitui após aprovação.
- **FR-020**: Um membro MUST poder cancelar suas marcações manuais ainda pendentes.
- **FR-021**: Marcações normais MUST ser recusadas se ocorrerem menos de 1 minuto após a
  marcação anterior do mesmo membro na mesma empresa.
- **FR-022**: Marcações MUST ter status: válida, pendente, aprovada, rejeitada ou cancelada;
  apenas válidas e aprovadas contam nas horas trabalhadas.
- **FR-022a**: Marcações MUST ser imutáveis e nunca excluídas: data/hora, membro, tipo e
  justificativa não podem ser alterados após o registro; correções são sempre novas marcações
  que referenciam a original, e apenas o status evolui (com histórico de quem mudou e quando).
- **FR-022b**: Cada marcação MUST receber um NSR (número sequencial de registro) único,
  crescente e sem lacunas dentro da empresa, atribuído no momento da gravação.

**Aprovações e painel do responsável**

- **FR-022c**: O responsável MUST poder designar membros ativos como **gestores** e atribuir a
  cada gestor um ou mais cargos; um cargo pode ter vários gestores. O responsável pode remover
  a designação ou alterar os cargos atribuídos a qualquer momento.
- **FR-022d**: O gestor MUST ter acesso, restrito aos membros dos cargos atribuídos a ele, ao
  painel de pendências, ao histórico e resumo de horas e à aprovação/rejeição de marcações; ele
  MUST NOT acessar operações administrativas nem dados de membros de outros cargos.
- **FR-022e**: Um gestor MUST NOT aprovar ou rejeitar as próprias marcações; elas são analisadas
  pelo responsável ou por outro gestor do seu cargo.
- **FR-023**: O sistema MUST oferecer ao responsável (todos os membros) e ao gestor (membros
  dos seus cargos), por dia, mês ou intervalo de datas, a
  lista de membros que não fizeram nenhuma marcação em dia útil e de membros com marcações
  pendentes, exibindo nome do membro e todas as marcações do dia com tipo, status e
  justificativa.
- **FR-024**: O responsável (qualquer membro) e o gestor (membros dos seus cargos) MUST poder
  aprovar ou rejeitar cada marcação pendente individualmente, com motivo opcional na rejeição.
- **FR-025**: Toda aprovação, rejeição e cancelamento MUST registrar quem fez e quando.

**Consultas e filtros**

- **FR-026**: Todas as listagens com dados ao longo do tempo (histórico de marcações, painel de
  pendências, resumos de horas, convites) MUST aceitar filtro por mês e por intervalo de datas
  específico; o padrão é o mês corrente.
- **FR-027**: O sistema MUST oferecer, por membro e período, um resumo com horas trabalhadas
  por dia (comparadas à carga diária), por semana (comparadas à carga semanal) e no total do
  período, indicando saldo positivo ou negativo de cada dia e semana.
- **FR-028**: O responsável MUST poder consultar o histórico e o resumo de qualquer membro da
  sua empresa; o gestor, apenas dos membros dos cargos atribuídos a ele.

### Key Entities

- **Usuário**: pessoa com conta no sistema (nome, e-mail, forma de acesso). Pode ser membro de
  várias empresas.
- **Empresa**: organização com nome, documento opcional, fuso horário, limite retroativo de
  marcação manual (dias) e um responsável.
- **Membro**: vínculo de um usuário com uma empresa; tem cargo, situação (ativo/inativo), data de
  entrada, indicação de gestor e, opcionalmente, jornada/dias úteis próprios.
- **Atribuição de gestor**: vínculo entre um membro gestor e um cargo cujos membros ele
  supervisiona.
- **Cargo**: função dentro da empresa; possui uma jornada vigente.
- **Jornada**: modo (semanal ou diário), dias da semana trabalhados, períodos previstos, carga
  horária diária (por dia da semana no modo diário) e carga horária semanal, com data de início
  de vigência. Pertence a um cargo ou a um membro.
- **Período**: item ordenado da jornada com nome livre (ex.: Entrada, Pausa) e horário previsto
  opcional;
  no modo diário, vinculado a um dia da semana.
- **Convite**: link vinculado a empresa e cargo, com expiração, situação (ativo, expirado,
  revogado) e autor.
- **Marcação**: registro imutável de ponto de um membro com NSR, data e hora, período associado,
  tipo (normal, manual ou sincronizada offline), horário de recebimento pelo servidor, motivo de pendência
  (manual, fora do dia útil ou offline), justificativa, status, marcação
  original substituída (no caso de correção) e dados de aprovação/rejeição.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um colaborador convidado consegue sair do link de convite até sua primeira
  marcação de ponto em menos de 2 minutos.
- **SC-002**: Registrar uma marcação normal é confirmado ao usuário em menos de 1 segundo em
  95% das vezes.
- **SC-003**: O responsável consegue revisar e aprovar todas as pendências de um dia com 20
  membros em menos de 3 minutos.
- **SC-004**: 100% das marcações manuais e fora de dia útil ficam fora do total de horas até
  serem aprovadas.
- **SC-005**: 100% das tentativas de acesso a dados de outra empresa, ou de operações
  administrativas por quem não é responsável, são negadas.
- **SC-006**: Consultas de histórico e de painel de um mês para uma empresa com 100 membros
  retornam em menos de 2 segundos.
- **SC-007**: Nenhuma marcação original é perdida: 100% das correções aprovadas mantêm o
  registro original consultável.

## Assumptions

- O backend segue a constituição do projeto (v1.0.0): .NET, PostgreSQL, autenticação JWT com
  login por e-mail/senha e Google.
- O frontend PWA (mobile-first, funcionando também em desktop) será construído em feature
  separada; esta feature só precisa expor tudo o que ele vai consumir.
- Não há registro de localização (GPS), foto ou restrição por rede/dispositivo na marcação
  nesta versão.
- O modelo de dados é preparado para a Portaria MTP 671/2021 (marcações imutáveis com NSR),
  mas a geração dos arquivos AFD/AEJ, do comprovante de marcação e do espelho de ponto legal
  fica fora de escopo desta versão.
- Feriados, banco de horas, cálculo de horas extras/adicionais e exportação de relatórios estão
  fora de escopo desta versão.
- Notificações (e-mail/push) sobre pendências e aprovações estão fora de escopo desta versão.
- O dia de uma marcação é definido pelo calendário no fuso horário da empresa.
- O responsável pode aprovar as próprias marcações manuais; a aprovação fica registrada.
- Responsável é o único papel administrativo; gestor só supervisiona marcações dos seus cargos.
- Rejeição de uma marcação não impede o membro de enviar uma nova marcação manual para o mesmo
  dia.
- Recuperação de senha por e-mail fica para uma feature futura.
