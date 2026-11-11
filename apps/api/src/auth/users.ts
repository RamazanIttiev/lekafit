import { Inject, Injectable } from '@nestjs/common'
import { type AppConfig, CONFIG } from '../config'
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

export type TelegramProfile = {
  id: number
  firstName: string
  lastName?: string | undefined
  username?: string | undefined
}

@Injectable()
export class Users {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async upsert(profile: TelegramProfile): Promise<User> {
    const role: Role = profile.id === this.config.coachTelegramId ? 'COACH' : 'CLIENT'
    const [row] = await this.sql<User[]>`
      insert into users (telegram_id, first_name, last_name, username, role)
      values (${profile.id}, ${profile.firstName}, ${profile.lastName ?? null}, ${profile.username ?? null}, ${role})
      on conflict (telegram_id) do update set
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        username = excluded.username,
        role = excluded.role
      returning id, telegram_id::float8 as telegram_id, first_name, last_name, username, role`
    if (!row) throw new Error('User upsert returned no row')
    return row
  }
}
