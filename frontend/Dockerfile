# syntax=docker/dockerfile:1
# Frontend do Pontua — build estático (Vite + PWA) servido por nginx (research R-15).
# As variáveis VITE_* são EMBUTIDAS no JavaScript durante o build: mudar um valor exige
# reconstruir a imagem. Nada aqui é segredo (tudo vai para o navegador — Princípio VI).

# ---------------------------------------------------------------------------
# 1) Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dependências primeiro (cache de camada enquanto package*.json não mudar)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# URL base da API. Vazio = mesma origem (o nginx deste container encaminha /api/ e /health)
ARG VITE_API_URL=""
# OAuth Client ID público do Google (vazio = botão do Google oculto)
ARG VITE_GOOGLE_CLIENT_ID=""
# Base path do React Router (vazio = raiz). Se usar, o nginx.conf e o manifest precisam de ajuste
ARG VITE_SITE_BASENAME=""

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID} \
    VITE_SITE_BASENAME=${VITE_SITE_BASENAME}

# tsc -b + vite build e conferência do PWA gerado (sem testes na imagem)
RUN npm run build && npm run check:pwa

# ---------------------------------------------------------------------------
# 2) Runtime
# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.inc /etc/nginx/snippets/pontua-security-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html
# robots.txt fora de public/ (Lighthouse SEO — revisão T070, A-23); o nginx o serve em /robots.txt
COPY robots.txt /usr/share/nginx/html/robots.txt

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
