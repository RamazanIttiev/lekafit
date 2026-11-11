import { Inject, Injectable } from '@nestjs/common'
import { type AppConfig, CONFIG } from '../config'
import { type User, UsersRepository } from './users.repository'

export type TelegramProfile = {
  id: number
  firstName: string
  lastName?: string | undefined
  username?: string | undefined
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(UsersRepository) private readonly users: UsersRepository,
  ) {}

  signIn(profile: TelegramProfile): Promise<User> {
    return this.users.upsert({
      telegramId: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName ?? null,
      username: profile.username ?? null,
      role: profile.id === this.config.coachTelegramId ? 'COACH' : 'CLIENT',
    })
  }
}
