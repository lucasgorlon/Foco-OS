# Foco OS

Painel pessoal de produtividade que organiza o dia, a semana, sessões Pomodoro e métricas usando o Trello como fonte oficial das tarefas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/foco-os/` — interface React/Vite e páginas do produto
- `artifacts/api-server/src/routes/` — API do app, rotas de automação e documentação HTML
- `artifacts/api-server/src/lib/trello.ts` — acesso ao Trello, modo demo e cache de 60 segundos
- `artifacts/api-server/src/lib/foco-data.ts` — agregações, sessões e configurações
- `lib/api-spec/openapi.yaml` — contrato OpenAPI usado para gerar os clientes e validadores
- `lib/db/src/schema/` — sessões Pomodoro e configurações persistidas
- `README.md` — configuração, Secrets e endpoints do Make.com

## Architecture decisions

- As tarefas pertencem ao Trello e não são copiadas para PostgreSQL; o banco guarda apenas sessões Pomodoro e preferências.
- `POS_API_KEY` protege os endpoints de automação. Ela não é necessária no modo demo, mas a API externa fica desativada até ser configurada.
- Sem credenciais completas de Trello, o backend retorna dados fictícios identificados como modo demonstração.

## Product

Hoje, Matriz de Eisenhower com triagem, Semana, timer Pomodoro com vínculo a cards, Métricas com exportação CSV e Configurações. A interface é em português e permite tema claro ou escuro.

## User preferences

Toda a interface deve permanecer em português do Brasil. Tarefas e etiquetas do Trello são a fonte oficial; não as persistir no PostgreSQL.

## Gotchas

- Configure credenciais apenas em Secrets; nunca exponha `TRELLO_API_KEY`, `TRELLO_TOKEN` ou `POS_API_KEY` no frontend ou nos logs.
- Reexecute o codegen depois de qualquer alteração em `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
