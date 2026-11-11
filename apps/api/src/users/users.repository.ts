import { Inject, Injectable } from '@nestjs/common'
import { SQL, type Sql } from '../db'

export type Role = 'CLIENT' | 'COACH'

export type User = {
  id: number
  telegramId: number
  firstName: string
  lastName: string | null
  username: string | null
  role: Role
}

export type ClientSummary = Omit<User, 'role'> & {
  lastReportWeek: string | null
  unseenReports: number
}

const userColumns = (sql: Sql) =>
  sql`id, telegram_id::float8 as telegram_id, first_name, last_name, username, role`

@Injectable()
export class UsersRepository {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async upsert(user: Omit<User, 'id'>): Promise<User> {
    const [row] = await this.sql<User[]>`
      insert into users (telegram_id, first_name, last_name, username, role)
      values (${user.telegramId}, ${user.firstName}, ${user.lastName}, ${user.username}, ${user.role})
      on conflict (telegram_id) do update set
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        username = excluded.username,
        role = excluded.role
      returning ${userColumns(this.sql)}`
    if (!row) throw new Error('User upsert returned no row')
    return row
  }

  async findById(id: number): Promise<User | null> {
    const [row] = await this.sql<
      User[]
    >`select ${userColumns(this.sql)} from users where id = ${id}`
    return row ?? null
  }

  async findClient(id: number): Promise<User | null> {
    const user = await this.findById(id)
    return user?.role === 'CLIENT' ? user : null
  }

  listClients(): Promise<ClientSummary[]> {
    return this.sql<ClientSummary[]>`
      select u.id, u.telegram_id::float8 as telegram_id, u.first_name, u.last_name, u.username,
        to_char(max(r.week_start), 'YYYY-MM-DD') as last_report_week,
        count(r.id) filter (where r.seen_by_coach_at is null)::int as unseen_reports
      from users u
      left join reports r on r.user_id = u.id and r.status = 'SUBMITTED'
      where u.role = 'CLIENT'
      group by u.id
      order by count(r.id) filter (where r.seen_by_coach_at is null) > 0 desc,
        max(r.submitted_at) desc nulls last, u.first_name`
  }
}
