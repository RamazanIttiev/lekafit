import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { type Role, UserEntity } from './user.entity'

export type { Role }
export type User = Omit<UserEntity, 'createdAt'>

const toUser = ({ createdAt: _, ...user }: UserEntity): User => user

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {}

  async upsert(user: Omit<User, 'id'>): Promise<User> {
    await this.users.upsert(user, ['telegramId'])
    const saved = await this.users.findOneByOrFail({ telegramId: user.telegramId })
    return toUser(saved)
  }

  async findById(id: number): Promise<User | null> {
    const user = await this.users.findOneBy({ id })
    return user ? toUser(user) : null
  }

  async findClient(id: number): Promise<User | null> {
    const user = await this.users.findOneBy({ id, role: 'CLIENT' })
    return user ? toUser(user) : null
  }

  async listClients(): Promise<User[]> {
    const clients = await this.users.findBy({ role: 'CLIENT' })
    return clients.map(toUser)
  }
}
