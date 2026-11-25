# Pontua — Backend

API REST em .NET 8 (Clean Architecture) do Pontua, controle de ponto eletrônico multiempresa.

| Projeto | Papel |
|---|---|
| `Pontua.DTO` | Contratos de entrada/saída e classes de configuração (`IOptions`) |
| `Pontua.Infra.Interfaces` | Contratos genéricos de repositórios e app services |
| `Pontua.Domain` | Modelos, enums, exceções, validadores e serviços de domínio |
| `Pontua.Infra` | `PontuaContext` (EF Core + PostgreSQL), repositórios e migrações |
| `Pontua.Application` | DI centralizado (`Startup.cs`), JWT, CORS, health checks |
| `Pontua.API` | Controllers, Swagger e `Program.cs` |
| `Pontua.Tests` | Testes xUnit (unitários e `Category=Integration`) |

## Ambientes

| Ambiente | `ASPNETCORE_ENVIRONMENT` | Como rodar |
|---|---|---|
| Dev | `Development` | `dotnet run --project Pontua.API --launch-profile http` contra o banco `pontua_dev` do compose (`localhost:5432`) |
| Homolog | `Docker` | `wsl --cd /mnt/c/repos/pontua -e docker compose up -d --build` na raiz (API em `http://localhost:5080`) |
| Prod | `Production` | Kubernetes — pendente, ver [`deploy/k8s/README.md`](../deploy/k8s/README.md) |

A imagem é gerada por `backend/Dockerfile` (contexto `backend/`, sem o `Pontua.Tests`). As migrações
são aplicadas no startup somente com `Database:MigrateOnStartup=true` (apenas homologação); em dev,
use `dotnet tool run dotnet-ef database update --project Pontua.Infra --startup-project Pontua.API`.

Configuração, execução e roteiro de validação:
[`specs/001-pontua-backend-core/quickstart.md`](../specs/001-pontua-backend-core/quickstart.md).

```bash
dotnet build
dotnet test --filter "Category!=Integration"
```
