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

   | Variável | Obrigatória | Conteúdo |
   |---|---|---|
   | `ConnectionStrings__PontuaContext` | **sim** | Connection string Npgsql do PostgreSQL de produção (≥ 15) |
   | `Jwt__Secret` | **sim** | Segredo aleatório, mínimo 32 bytes (recomendado ≥ 64); a API não sobe sem ele |
   | `Google__ClientId` | **opcional** | OAuth Client ID do domínio de produção. Sem ele a API sobe normalmente, o login com Google fica desabilitado (`POST /api/auth/google` → 404 "Login com Google não está habilitado neste ambiente.") e o botão some no PWA, cujo build arg `VITE_GOOGLE_CLIENT_ID` também é opcional |

   **Para a futura pipeline (skill `k8s-deploy`)** — mapeamento de GitHub *secrets*/*variables*:

   | Origem no GitHub | Tipo | Obrigatória | Destino |
   |---|---|---|---|
   | `PONTUA_CONNECTION_STRING` | secret | **sim** | `ConnectionStrings__PontuaContext` |
   | `PONTUA_JWT_SECRET` | secret | **sim** (≥ 32 bytes) | `Jwt__Secret` |
   | `PONTUA_GOOGLE_CLIENT_ID` | variable | **opcional** | `Google__ClientId` (API) e build arg `VITE_GOOGLE_CLIENT_ID` (PWA) |

   - O passo de validação de secrets só pode falhar na ausência de `PONTUA_CONNECTION_STRING` ou de
     `PONTUA_JWT_SECRET` (e se este tiver menos de 32 bytes); **nunca** por falta de
     `PONTUA_GOOGLE_CLIENT_ID`.
   - Com `PONTUA_GOOGLE_CLIENT_ID` vazia: não criar a chave `Google__ClientId` no Secret/ConfigMap
     (ou criá-la com valor vazio) e passar `VITE_GOOGLE_CLIENT_ID` vazio no build da imagem do frontend.

3. **Domínio, Ingress e TLS**: o domínio de produção é **`https://pontua.site`**, com frontend e API
   na mesma origem — o Ingress (ou Gateway API) roteia `/api/` e `/health` para o Service da API e
   todo o resto (`/`) para o PWA. TLS terminado no cluster (ex.: cert-manager + Let's Encrypt).
   `App:FrontendBaseUrl` (`https://pontua.site`, links de convite em `https://pontua.site/convite/{token}`)
   e `Cors:AllowedOrigins` (`["https://pontua.site"]`) já estão configurados para esse domínio em
   `appsettings.Production.json`.
   Avaliar `ForwardedHeaders` na API para respeitar `X-Forwarded-Proto` atrás do Ingress.
4. **Migrações**: não aplicar no startup das réplicas. Usar um `Job` (ou um único init container)
   com *migration bundle* (`dotnet ef migrations bundle`) ou script idempotente
   (`dotnet ef migrations script --idempotent`) antes do rollout do `Deployment`.
5. **Data Protection**: persistir as chaves (volume, Redis ou banco) se algum recurso passar a
   depender de Data Protection com múltiplas réplicas.
6. **Pipeline**: build e push da imagem + `kubectl apply`/Helm/Kustomize. Não usar o deploy via SSH
   com `docker-compose-prod.yml` da skill `dotnet-env`.
