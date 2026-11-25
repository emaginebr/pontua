# Pontua — Produção (Kubernetes) — pendente

Produção roda com `ASPNETCORE_ENVIRONMENT=Production` num cluster Kubernetes (constituição, seção
"Ambientes"). Por enquanto só existem a imagem (`backend/Dockerfile`, porta 8080, `GET /health`) e o
`backend/Pontua.API/appsettings.Production.json` (não-segredos preenchidos, segredos vazios,
`Database:MigrateOnStartup=false`). O restante fica para depois.

## O que falta

1. **Manifests** (`deploy/k8s/`): `Namespace`, `Deployment` da API (imagem publicada num registry,
   `readinessProbe`/`livenessProbe` em `GET /health`, porta 8080, `resources`), `Service`,
   `ConfigMap` (se algum não-segredo precisar variar por cluster) e, quando existir, o frontend PWA.
2. **Secrets** — injetados como variáveis de ambiente no padrão `Secao__Chave`
   (sem `AddEnvironmentVariables("PREFIXO")`):

   | Variável | Conteúdo |
   |---|---|
   | `ConnectionStrings__PontuaContext` | Connection string Npgsql do PostgreSQL de produção (≥ 15) |
   | `Jwt__Secret` | Segredo aleatório, mínimo 32 bytes (recomendado ≥ 64) |
   | `Google__ClientId` | OAuth Client ID do domínio de produção |

3. **Ingress/TLS**: Ingress (ou Gateway API) com TLS terminado no cluster (ex.: cert-manager +
   Let's Encrypt) para a API e o PWA. Confirmar `App:FrontendBaseUrl` e `Cors:AllowedOrigins` em
   `appsettings.Production.json` — hoje estão com o domínio **provisório** `https://app.pontua.com.br`.
   Avaliar `ForwardedHeaders` na API para respeitar `X-Forwarded-Proto` atrás do Ingress.
4. **Migrações**: não aplicar no startup das réplicas. Usar um `Job` (ou um único init container)
   com *migration bundle* (`dotnet ef migrations bundle`) ou script idempotente
   (`dotnet ef migrations script --idempotent`) antes do rollout do `Deployment`.
5. **Data Protection**: persistir as chaves (volume, Redis ou banco) se algum recurso passar a
   depender de Data Protection com múltiplas réplicas.
6. **Pipeline**: build e push da imagem + `kubectl apply`/Helm/Kustomize. Não usar o deploy via SSH
   com `docker-compose-prod.yml` da skill `dotnet-env`.
