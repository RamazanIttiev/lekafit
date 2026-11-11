import { join } from 'node:path'
import type { DataSourceOptions } from 'typeorm'
import { PlanEntity } from './reports/plan.entity'
import { ReportEntity } from './reports/report.entity'
import { UserEntity } from './users/user.entity'

export const entities = [UserEntity, PlanEntity, ReportEntity]

const migrations = join(import.meta.dirname, 'migrations', '*.{ts,js}')

export const dataSourceOptions = (url: string): DataSourceOptions => ({
  type: 'postgres',
  url,
  entities,
  migrations: [migrations],
  migrationsRun: true,
  synchronize: false,
  logging: false,
})
