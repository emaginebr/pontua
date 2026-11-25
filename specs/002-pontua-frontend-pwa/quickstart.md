# Quickstart: Pontua — App PWA (Frontend)

**Feature**: `002-pontua-frontend-pwa`

## Pré-requisitos

- Node.js 22 LTS e npm.
- Backend de homologação rodando (feature 001): `wsl --cd C:\repos\pontua -e docker compose up -d`
  → API em `http://localhost:5080`.
- Opcional: `VITE_GOOGLE_CLIENT_ID` para o login Google (sem ele o botão não aparece).

## Desenvolvimento

```bash
cd frontend
npm install
cp .env.example .env.local     # VITE_API_URL vazio (usa o proxy), VITE_GOOGLE_CLIENT_ID opcional
npm run dev                    # http://localhost:5173 (proxy /api → http://localhost:5080)
npm test                       # Vitest + axe
npm run build && npm run preview   # testar o service worker (não roda em dev)
```

## Homologação (compose via WSL)

```bash
wsl --cd C:\repos\pontua -e docker compose up -d --build
# Frontend: http://localhost:8081  (nginx; /api/ e /health → api:8080 na mesma origem)
# API:      http://localhost:5080
wsl --cd C:\repos\pontua -e docker compose ps      # pontua-db, pontua-api e pontua-frontend "healthy"
curl http://localhost:8081/healthz                  # ok (nginx do frontend)
curl http://localhost:8081/health                   # Healthy (API via proxy)
```

- Porta do host: `FRONTEND_PORT` no `.env` (padrão `8081`). O link do convite usa
  `APP_FRONTEND_BASE_URL` (padrão `http://localhost:8081/convite/{token}`).
- `VITE_API_URL` (vazio = mesma origem) e `VITE_GOOGLE_CLIENT_ID` vêm do `.env` da raiz como build
  args e ficam embutidos no bundle: mudou, rode `docker compose up -d --build frontend`.

## Roteiro de validação manual

1. **Entrada (US1)**: em `http://localhost:8081`, criar conta → cair em "Bem-vindo". Erros de
   formulário aparecem ao lado do campo. Sair e entrar de novo.
2. **Empresa e cargos (US3)**: criar "Padaria Sol" → tela de ponto com o cargo "Responsável".
   Em Empresa → Cargos, criar "Atendente" semanal (seg–sex, Entrada/Pausa/Retorno/Saída, 8 h/dia,
   44 h/semana); criar outro cargo diário e usar "copiar de outro dia".
3. **Convite (US4)**: gerar convite para Atendente → "Compartilhar" (celular) ou "Copiar". Abrir
   o link numa janela anônima → ver empresa e cargo → criar conta → cair na tela de ponto da
   empresa já como membro.
4. **Ponto (US2)**: registrar 4 marcações e ver os períodos. Tentar de novo em < 1 min → aviso.
   DevTools → Network → Offline → registrar → indicador "1 aguardando envio" → voltar online →
   marcação aparece como "Offline · Pendente" e o indicador some.
5. **Histórico (US5)**: trocar de mês; filtro avançado com intervalo; incluir manual de ontem com
   justificativa → "Manual · Pendente", saldo inalterado; datas antes da entrada não são
   selecionáveis; cancelar o pedido.
6. **Aprovações (US6)**: como responsável, o contador mostra as pendências; aprovar uma (a lista
   atualiza sem recarregar), rejeitar outra com motivo; o membro vê quem analisou e o motivo.
7. **Configurações (US7)**: designar o membro como gestor de Atendente → ele vê o painel só com
   atendentes; transferir a responsabilidade → o antigo responsável perde o menu de configuração.
8. **PWA**: Chrome → Instalar app; abrir instalado em modo avião → casca abre e a tela de ponto
   mostra os últimos dados com aviso. Lighthouse: instalável e Acessibilidade 100.
9. **Acessibilidade**: navegar uma tela inteira só com Tab/Enter/Esc; zoom de 200%; largura 320 px
   sem rolagem horizontal.

## Resultado da validação

Executado em 2026-11-25 no ambiente de homologação (`http://localhost:8081`), pela interface, com
Chrome automatizado e dois usuários. Detalhes, evidências e capturas em
[`docs/design/review/QUICKSTART_RESULT.md`](../../docs/design/review/QUICKSTART_RESULT.md).

| Passo | Resultado |
|---|---|
| 1. Entrada | ✅ |
| 2. Empresa e cargos | ✅ (editor diário corrigido e reverificado em 1024/1280/1440/360 px) |
| 3. Convite | ✅ |
| 4. Ponto e offline | ✅ sem duplicatas |
| 5. Histórico e manual | ✅ ("ontem" testado como "hoje" — contas criadas no mesmo dia) |
| 6. Aprovações | ✅ |
| 7. Gestor e transferência | ✅ |
| 8. PWA | ✅ instalável, SW ativo, casca offline |
| 9. Acessibilidade | ✅ foco volta ao fechar modais; 20/20 rotas sem rolagem em 320 px; zoom 200% |

Lighthouse mobile (`/entrar` e tela de ponto): Desempenho 100 · Acessibilidade 100 · Boas
práticas 100 · SEO 100. Revisão de design: 41 ✅ · 2 ⚠️ aceitos (A-15, A-16) · 0 ❌; ajuste fino
pendente: N-07 (resumo do dia quebra na lista do editor diário ≥ 1440 px).

