import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, type Repository } from 'typeorm'
import { ReportEntity } from '../reports/report.entity'
import { type Role, UserEntity } from './user.entity'

export type { Role }
export type User = Omit<UserEntity, 'createdAt'>

export type ClientSummary = User & {
  lastReportWeek: string | null
  unseenReports: number
}

type ClientSummaryRow = {
  id: number
  lastReportWeek: string | null
  unseenReports: string
}

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

  async listClients(): Promise<ClientSummary[]> {
    const unseen = 'COUNT(report.id) FILTER (WHERE report.seenByCoachAt IS NULL)'
    const rows = await this.users
      .createQueryBuilder('user')
      .leftJoin(ReportEntity, 'report', 'report.userId = user.id AND report.status = :status', {
        status: 'SUBMITTED',
      })
      .select('user.id', 'id')
      .addSelect("TO_CHAR(MAX(report.weekStart), 'YYYY-MM-DD')", 'lastReportWeek')
      .addSelect(unseen, 'unseenReports')
      .where('user.role = :role', { role: 'CLIENT' })
      .groupBy('user.id')
      .orderBy(`${unseen} > 0`, 'DESC')
      .addOrderBy('MAX(report.submittedAt)', 'DESC', 'NULLS LAST')
      .addOrderBy('user.firstName', 'ASC')
      .getRawMany<ClientSummaryRow>()
    const users = await this.users.findBy({ id: In(rows.map((r) => r.id)) })
    const byId = new Map(users.map((u) => [u.id, toUser(u)]))
    return rows.flatMap((row) => {
      const user = byId.get(row.id)
      return user
        ? [
            {
              ...user,
              lastReportWeek: row.lastReportWeek,
              unseenReports: Number(row.unseenReports),
            },
          ]
        : []
    })
  }
}
