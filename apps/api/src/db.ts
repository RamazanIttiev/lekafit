import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import postgres from 'postgres'

export type Sql = postgres.Sql
export const SQL = Symbol('SQL')

export const connect = (url: string): Sql =>
  postgres(url, {
    onnotice: () => {},
    transform: postgres.camel,
  })

const migrationsDir = join(import.meta.dirname, 'migrations')

export const migrate = async (sql: Sql) => {
  await sql`create table if not exists schema_migrations (name text primary key)`
  await sql`select pg_advisory_lock(42)`
  try {
    const applied = new Set(
      (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name),
    )
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files.filter((f) => !applied.has(f))) {
      const body = await readFile(join(migrationsDir, file), 'utf8')
      await sql.begin(async (tx) => {
        await tx.unsafe(body)
        await tx`insert into schema_migrations ${tx({ name: file })}`
      })
    }
  } finally {
    await sql`select pg_advisory_unlock(42)`
  }
}
