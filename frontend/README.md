# Pontua — frontend (PWA)

React 18 + TypeScript + Vite + Tailwind 4, instalável como PWA (`vite-plugin-pwa`).

O roteiro completo — pré-requisitos, variáveis, dev, homologação em Docker e validação manual
(instalação, modo offline, Lighthouse) — está em
[`specs/002-pontua-frontend-pwa/quickstart.md`](../specs/002-pontua-frontend-pwa/quickstart.md).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite em `http://localhost:5173`, com proxy de `/api` e `/health` (`VITE_DEV_API_PROXY`) |
| `npm run lint` | ESLint |
| `npm test` | Vitest (inclui checagens de acessibilidade com `vitest-axe`) |
| `npm run build` | `tsc -b` + build de produção em `dist/` (com `sw.js` e `manifest.webmanifest`) |
| `npm run check:pwa` | Confere o PWA gerado em `dist/` (manifest, ícones, atalho, `sw.js`, tamanho do precache) |

Variáveis: copie `.env.example` para `.env.local`. Todas são públicas (vão para o navegador).

## Imagem Docker

`Dockerfile` (Node 22 → `nginx:alpine`) e `nginx.conf` seguem o research R-15: SPA com fallback
para `index.html`, `no-cache` em `index.html`/`sw.js`/`workbox-*.js`/`manifest.webmanifest`,
cache longo em `/assets/` e proxy de `/api/` e `/health` para `http://api:8080`.

```bash
docker build -t pontua-frontend \
  --build-arg VITE_API_URL= \
  --build-arg VITE_GOOGLE_CLIENT_ID=<client-id> .
```

As variáveis `VITE_*` são embutidas no build: mudar um valor exige reconstruir a imagem.
