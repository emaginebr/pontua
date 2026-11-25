# Pontua — Design (feature `002-pontua-frontend-pwa`, Fase 1a)

Ponto de consumo único para o `frontend-react-developer`. Direção visual: **Expediente**.

| Artefato | Finalidade | Tarefa | Origem |
|---|---|---|---|
| [`DESIGN_DIRECTION.md`](./DESIGN_DIRECTION.md) | Conceito, paleta da logo, tipografia, iconografia, uso da logo, tom de voz, princípios mobile-first, manifest | T001, T005 | ux-designer |
| [`tokens.css`](./tokens.css) | Tokens `--pt-*` em `:root` (cores, tipografia, espaçamento, raios, sombras, z-index, movimento) + tabela de contraste AA | T002 | ux-designer (`design-system`) |
| [`tailwind-theme.css`](./tailwind-theme.css) | Mapeamento `@theme inline` para Tailwind 4 + base de foco e movimento reduzido | T002 (complemento) | ux-designer |
| [`components.md`](./components.md) | Especificação de componentes com props, estados e acessibilidade | T003 | ux-designer (`ui-styling`) |
| [`screens/index.html`](./screens/index.html) | Galeria dos mockups, paleta e ícones | T004 | ux-designer |
| `screens/login.html`, `welcome.html`, `clock.html`, `history.html`, `approvals.html`, `position-editor.html`, `invite.html`, `members.html`, `settings.html` | Mockups estáticos em 360 px e 1280 px | T004 | ux-designer |
| [`screens/states.html`](./screens/states.html) | Catálogo de selos, carregando/vazio/erro, offline, atualização, instalação iOS | T004 (extra) | ux-designer |
| `screens/mockup.css`, `screens/mockup.js` | Só para os mockups (casca do app e sprite lucide); **não** copiar para o app | T004 | ux-designer |
| [`REVIEW.md`](./REVIEW.md) | Revisão visual do app implementado (achados por tela e severidade, notas do Lighthouse, correções nos docs) | T070 | ux-designer (`ui-ux-pro-max`) |
| `review/*.png`, `review/lighthouse/*.html` | Screenshots 360/1280 do app em homologação e relatórios Lighthouse | T070 | ux-designer (Chrome headless + Lighthouse 13) |
| `assets/logo.png`, `assets/logo-symbol.png` | Cópias usadas pelos mockups | T004 | gerado de `docs/logomarca/logo.png` |
| `frontend/public/icon-any-{192,512}.png`, `icon-maskable-{192,512}.png`, `apple-touch-icon.png`, `favicon.ico`, `favicon.svg`, `favicon-32.png`, `logo.png`, `logo-symbol.png`, `shortcut-punch-96.png`, `og-image.png` | Ícones e imagens do PWA | T005 | gerado de `docs/logomarca/logo.png` (Pillow + Chrome headless) |

Como abrir os mockups: duplo clique em `screens/index.html` (funciona via `file://`; a fonte vem do
Google Fonts, com fallback do sistema sem internet).

Breakpoint de navegação: os mockups usam *container queries* em 1024 px para mostrar o mesmo
conteúdo nas duas molduras; no app isso é `@media`/variante `lg:` do Tailwind.
