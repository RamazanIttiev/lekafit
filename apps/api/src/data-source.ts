import type { DataSourceOptions } from 'typeorm'
import { Init1794398584765 } from './migrations/1794398584765-Init'
import { PlanEntity } from './reports/plan.entity'
import { ReportEntity } from './reports/report.entity'
import { UserEntity } from './users/user.entity'

export const entities = [UserEntity, PlanEntity, ReportEntity]

export const dataSourceOptions = (url: string): DataSourceOptions => ({
  type: 'postgres',
  url,
  entities,
  migrations: [Init1794398584765],
  migrationsRun: true,
  synchronize: false,
})
