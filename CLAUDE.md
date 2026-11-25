# Pontua

Software de ponto eletrônico: backend .NET em `backend/` e frontend React PWA (mobile-first) em
`frontend/`. A constituição do projeto está em `.specify/memory/constitution.md` e prevalece
sobre qualquer outra orientação.

## Agentes obrigatórios (Princípio VIII da constituição)

A sessão principal **não edita** código em `backend/` nem em `frontend/` e não produz layout ou
aparência diretamente. Toda alteração é delegada pelo tool `Agent` ao agente da área:

| Área | Agente (`subagent_type`) |
|---|---|
| Backend .NET (`backend/`): entidades, services, repositórios, migrations, controllers, DI, testes | `dotnet-senior-developer` |
| Frontend React/TypeScript (`frontend/`): tipos, services, contexts, hooks, páginas, componentes, i18n | `frontend-react-developer` |
| Layout e aparência do frontend: direção visual, design tokens, mockups, especificação de componentes, ícones | `ux-designer` |

- Telas novas passam primeiro pelo `ux-designer` e só depois pelo `frontend-react-developer`.
- Mudanças que atravessam backend e frontend viram tarefas separadas, uma por agente, com o
  contrato da API definido antes.
- A sessão principal pode ler código, planejar, revisar e editar `specs/`, `.specify/` e este
  arquivo.

## Tecnologias ativas

- C# 12 / .NET 8 (`net8.0`, SDK 9.0.309), ASP.NET Core Web API, EF Core 9 + Npgsql,
  Swashbuckle 8, JwtBearer, Google.Apis.Auth, FluentValidation 11
  (001-pontua-backend-core)
- PostgreSQL: snake_case, UTC sem timezone, marcações imutáveis com NSR por empresa
  (001-pontua-backend-core)
- TypeScript 5, React 18, Vite 6, Tailwind 4, React Router 6, i18next, vite-plugin-pwa,
  Radix Dialog, sonner, lucide-react; Fetch API; Vitest + vitest-axe (002-pontua-frontend-pwa)
- Navegador: `localStorage` `pontua:auth`/`pontua:company`; IndexedDB `pontua-queue` (marcações
  offline) e `pontua-cache` (leitura offline) (002-pontua-frontend-pwa)

## Commits e versionamento

O repositório usa GitVersion (`GitVersion.yml`): o prefixo da primeira linha do commit decide o
incremento da versão a cada push no `main`.

- **Todo commit DEVE usar o prefixo `fix:`** (ex.: `fix(backend): corrige calculo de saldo`),
  a menos que o usuário peça explicitamente outro prefixo (`feat:`, `feat!:`, `major:`, `chore:`
  etc.).
- Formato: `fix(<escopo opcional>): <descrição no imperativo, minúscula, sem ponto final>` — `:`
  colado ao tipo, escopo entre parênteses.

## Comandos e restrições

- Docker só via WSL2 (skill `wsl-docker`): `wsl --cd <dir> -e docker compose ...`. Não há
  Docker no Windows.
- Ambientes: Dev (`Development`, local), Homolog (`Docker`, compose via WSL com banco, API e
  frontend) e Prod (`Production`, cluster Kubernetes — ainda não configurado).
- Novas entidades seguem as skills `dotnet-architecture` (backend) e `react-architecture`
  (frontend).
