# LekaFit

## API layering (apps/api)

`controller → service → repository`. Strict:

- **Controllers**: HTTP only (routes, guards, pipes, params). Call services. No SQL, no business rules.
- **Services**: business rules, validation, 404/409 decisions. Call repositories. No SQL.
- **Repositories** (`*.repository.ts`): the only place SQL lives.
- Infrastructure exceptions: `db.ts` (connection, migrations), `app.ts` (pool shutdown).

Check: `grep -rln "this.sql\|sql<" apps/api/src | grep -v migrations` lists only repositories, `db.ts` and `app.ts`.

## Workflow

- `pnpm check` (lint + typecheck + all tests) must pass before every commit.
- Dev Postgres: `docker compose -f docker-compose.dev.yml up -d` (port 5433; tests use db `lekafit_test`).
