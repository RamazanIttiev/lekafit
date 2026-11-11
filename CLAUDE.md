# LekaFit

## API layering (apps/api)

`controller → service → repository`. Strict:

- **Controllers**: HTTP only (routes, guards, pipes, params). Call services. No SQL, no business rules.
- **Services**: business rules, validation, 404/409 decisions. Call repositories. No SQL.
- **Repositories** (`*.repository.ts`): the only layer that touches the database, via `@InjectRepository` (TypeORM). Prefer repository methods (`findOneBy`, `upsert`, `update`); use the query builder only for aggregates. No raw SQL strings.
- **Entities** (`*.entity.ts`): give every `@Column` an explicit `type` — `tsx` does not emit decorator metadata.

## Database (TypeORM via @nestjs/typeorm)

- Schema changes: edit the entity, then in `apps/api` run
  `DATABASE_URL=… pnpm migration:generate src/migrations/<Name>` against a database at the current schema,
  and add the new class to `migrations` in `src/data-source.ts`. Migrations run on app start (`migrationsRun`).
- Never use `synchronize: true`.

## Workflow

- `pnpm check` (lint + typecheck + all tests) must pass before every commit.
- Dev Postgres: `docker compose -f docker-compose.dev.yml up -d` (port 5433; tests use db `lekafit_test`).
