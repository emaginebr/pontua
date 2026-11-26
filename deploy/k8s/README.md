# Pontua no Kubernetes (DigitalOcean) — produção `https://pontua.site`

Cluster DOKS `do-nyc2-emagine-k8s`, namespace `pontua`. Tráfego: **Cloudflare** (TLS público,
proxy) → **Cloudflare Tunnel compartilhado** `emagine-k8s` (pods `cloudflared` no namespace
`cloudflared`, conexão de saída, sem IP público nem Load Balancer) → **ingress-nginx compartilhado**
(interno, Service ClusterIP, HTTP) → Services `pontua-api` (8080) e `pontua-web` (80). O banco de
dados é externo ao cluster.

| Pasta | Conteúdo | Quem aplica |
|---|---|---|
| [`bootstrap/`](bootstrap/) | namespace `pontua` e a credencial restrita da pipeline (ServiceAccount `pontua-deployer`) | admin do cluster, uma vez |
| [`pontua/`](pontua/) | recursos do projeto (Deployments, Services, Ingress, ConfigMap) via Kustomize | pipeline **Deploy Production** (`kubectl apply -k`) |

A entrada compartilhada (ingress-nginx e cloudflared) é infra do **cluster** e já existe; não é
mantida neste repositório.

Nenhum arquivo daqui contém credenciais. Os Secrets `pontua-api-secrets` e `ghcr-pull` são
criados pela pipeline a partir dos secrets do environment `production` do GitHub; o job
`manifests` da pipeline confere a cada execução que nenhum Secret com dados foi versionado. O token
do túnel (Secret `cloudflared-token`, namespace `cloudflared`) é credencial do cluster e não vai
para o GitHub do projeto.

## Arquitetura

```
cliente → Cloudflare (HTTPS, Always Use HTTPS, Redirect Rule do www)
        → túnel emagine-k8s → pods cloudflared
        → http://ingress-nginx-controller.ingress-nginx.svc.cluster.local:80
        → Ingress pontua (/api e /health → pontua-api:8080, / → pontua-web:80)
```

- Sem TLS no Ingress: o HTTPS termina na Cloudflare.
- A API recebe o IP real em `X-Forwarded-For` e `X-Forwarded-Proto: https`, e confia nesses
  headers (o Service é ClusterIP: só o ingress fala com ela).
- A Cloudflare corta requisições sem resposta por mais de ~100 s (erro 524).

## Secrets

| Nome no GitHub | Onde | Uso |
|---|---|---|
| `KUBECONFIG` | environment `production` | kubeconfig da ServiceAccount `pontua-deployer` (gerado no bootstrap) |
| `GHCR_PULL_USER` (variable) / `GHCR_PULL_TOKEN` | organização ou environment `production` | Secret `ghcr-pull` (PAT classic só com `read:packages`) |
| `PONTUA_CONNECTION_STRING` (**obrigatório**) | repositório ou environment `production` | chave `ConnectionStrings__PontuaContext` do Secret `pontua-api-secrets` (PostgreSQL ≥ 15) |
| `PONTUA_JWT_SECRET` (**obrigatório**, ≥ 32 bytes) | repositório ou environment `production` | chave `Jwt__Secret` do Secret `pontua-api-secrets` |
| `PONTUA_GOOGLE_CLIENT_ID` (variable, **opcional**) | repositório ou environment `production` | chave `Google__ClientId` do Secret `pontua-api-secrets` e build arg `VITE_GOOGLE_CLIENT_ID` do PWA. Vazia: login com Google desabilitado (`POST /api/auth/google` → 404) e botão oculto; o deploy não falha |

Configuração não secreta (ConfigMap `pontua-api-env`): `ASPNETCORE_ENVIRONMENT=Production`,
`ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` e `Database__MigrateOnStartup=true` — com 1 réplica as
migrations rodam no startup do pod (a `startupProbe` dá até 5 min). Antes de aumentar as réplicas,
mover as migrations para um `Job`. Domínio, CORS (`https://pontua.site`) e URL dos convites ficam em
`backend/Pontua.API/appsettings.Production.json`.

## Bootstrap (admin, uma vez)

Requer `kubectl` na máquina do admin, com o kubeconfig **de admin** do cluster. Esse kubeconfig
nunca vai para o GitHub nem para o repositório.

1. **Pré-requisitos**:
   - liberar o cluster no firewall do banco (Managed DB: *Trusted sources*), se for o caso;
   - **anotar o IP do servidor atual** no registro A/AAAA de `pontua.site` (para a reversão);
   - conferir a infra compartilhada: `kubectl -n ingress-nginx get deploy` e
     `kubectl -n cloudflared get pods` (2/2 Running).
2. **Namespace e credencial da pipeline** (gere o kubeconfig num diretório temporário fora do
   repositório):

   ```bash
   kubectl apply -f deploy/k8s/bootstrap/namespace.yaml
   kubectl apply -f deploy/k8s/bootstrap/deployer-rbac.yaml
   umask 077
   deploy/k8s/bootstrap/make-kubeconfig.sh > "$TMP/pontua-deployer.kubeconfig"
   KUBECONFIG="$TMP/pontua-deployer.kubeconfig" kubectl auth can-i create deployments -n pontua   # yes
   KUBECONFIG="$TMP/pontua-deployer.kubeconfig" kubectl auth can-i get pods -n kube-system          # no
   gh secret set KUBECONFIG --env production < "$TMP/pontua-deployer.kubeconfig"
   rm -f "$TMP/pontua-deployer.kubeconfig"
   ```

   Cadastrar também os demais secrets (tabela acima).

## Deploy

Actions → **Deploy Production** → `ref` = `main` (ou uma tag). A pipeline roda os testes, publica
as imagens `ghcr.io/emaginebr/pontua-api` e `pontua-web` com a tag `sha-<commit>`, cria os
Secrets do cluster, aplica `deploy/k8s/pontua` e espera o rollout. Conferir com
`kubectl -n pontua get deploy,pods,ingress`.

Pela linha de comando (inclusive de um branch ainda não mergeado):

```bash
gh workflow run deploy-prod.yml --ref <branch> -f ref=<branch>
```

## Troca da origem na Cloudflare

1. **Validar por dentro** antes da troca, com um pod temporário (sem `--rm`, que perde linhas da
   saída):

   ```bash
   kubectl -n pontua run routecheck --restart=Never --image=curlimages/curl:8.17.0 --command -- sh -c \
     "curl -s -H Host:pontua.site -H X-Forwarded-Proto:https http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/healthz"
   kubectl -n pontua wait --for=jsonpath='{.status.phase}'=Succeeded pod/routecheck --timeout=90s
   kubectl -n pontua logs routecheck
   kubectl -n pontua delete pod routecheck
   ```

2. **www**: verificar **antes** da troca quem faz hoje o redirect `www` → `pontua.site`. Se for o
   servidor antigo, criar na Cloudflare: Rules → Redirect Rules, Request URL
   `https://www.pontua.site/*` → `https://pontua.site/${1}`, 301, preservando a query string (o
   registro do `www` precisa estar proxied); e SSL/TLS → Edge Certificates → **Always Use HTTPS**
   ligado. O `www` não entra no túnel nem no Ingress.
3. **Troca** (alguns segundos fora do ar):
   - Cloudflare → DNS da zona: apagar o registro A/AAAA de `pontua.site` (IP anotado no bootstrap);
   - Zero Trust → Networks → Tunnels → `emagine-k8s` → **Add route → Published application**:
     hostname `pontua.site`, Service `HTTP` `ingress-nginx-controller.ingress-nginx.svc.cluster.local:80`;
   - conferir o CNAME `pontua.site` → `<id-do-túnel>.cfargotunnel.com` (proxied); se o painel não o
     criar, criar à mão.
4. **Confirmar que o tráfego chega ao cluster**: o log do ingress deve mostrar o IP público real
   dos clientes (`kubectl -n ingress-nginx logs deploy/ingress-nginx-controller --since=2m | grep pontua.site`).
   Resposta com `server: cloudflare` não prova nada: compare com uma rota cujo conteúdo é diferente
   no servidor antigo. Se a API registrar um IP `10.109.x.x` (pod do cloudflared), o real-ip do
   ingress não está valendo.
5. Rodar o roteiro de validação funcional do projeto (login, fluxos principais, dados).

**Reverter a troca**: remover a rota de `pontua.site` no túnel (e o CNAME, se ficar) e recriar o
registro A/AAAA (proxied) com o IP anotado. O efeito é quase imediato.

## Desligar o ambiente antigo

Só depois da troca validada: parar os containers antigos, retirar encaminhamentos do projeto em
proxies de outros servidores e remover do GitHub os secrets do deploy antigo (ex.: SSH).

## Operação

| Ação | Como |
|---|---|
| Deploy | Actions → Deploy Production (`ref`) |
| Rollback rápido | Deploy Production com a tag anterior e `skip_tests=true` (a imagem já existe, o build é pulado) |
| Rollback de emergência | `kubectl -n pontua rollout undo deployment/pontua-api` (e `pontua-web`) |
| Logs | `kubectl -n pontua logs deploy/pontua-api --tail=200 -f` |
| Status | `kubectl -n pontua get deploy,pods,ingress -o wide` / `kubectl -n pontua describe pod <pod>` |
| Túnel | `kubectl -n cloudflared logs deploy/cloudflared --tail=50` (erro 1033 na Cloudflare = túnel sem conector) |
| Rotacionar a credencial da pipeline | apagar o Secret `pontua-deployer-token`, reaplicar `bootstrap/deployer-rbac.yaml`, gerar outro kubeconfig e atualizar o secret `KUBECONFIG` |
