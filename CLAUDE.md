# LekaFit

## API layering (apps/api)

`controller → service → repository`. Strict:

- **Controllers**: HTTP only (routes, guards, pipes, params). Call services. No SQL, no business rules.
- **Services**: business rules, validation, 404/409 decisions. Call repositories. No SQL.
- **Repositories** (`*.repository.ts`): the only layer that touches the database, via `@InjectRepository` (TypeORM). Use repository methods only (`find`, `findOneBy`, `insert`, `upsert`, `update`). No query builder, no raw SQL strings, no SQL fragments. Aggregations/sorting on this app's small data happen in services, in TypeScript. The only SQL in the repo is TypeORM-generated migrations.
- **Entities** (`*.entity.ts`): give every `@Column` an explicit `type` — `tsx` does not emit decorator metadata.

## Database (TypeORM via @nestjs/typeorm)

- Schema changes: edit the entity, then in `apps/api` run
  `DATABASE_URL=… pnpm migration:generate src/migrations/<Name>` against a database at the current schema,
  Files in `src/migrations/` are picked up automatically (glob in `src/data-source.ts`) and run on app start.
- Never use `synchronize: true`.

## Workflow

- `pnpm check` (lint + typecheck + all tests) must pass before every commit.
- Mutation testing in `apps/api` is slow (each mutant reruns the DB-backed e2e suite, one at a time): set `mutate` in `stryker.config.json` to only the changed files and run `npx stryker run` once.
- Dev Postgres: `docker compose -f docker-compose.dev.yml up -d` (port 5433; tests use db `lekafit_test`).
