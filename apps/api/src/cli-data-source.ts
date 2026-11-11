import { DataSource } from 'typeorm'
import { dataSourceOptions } from './data-source'

export default new DataSource({
  ...dataSourceOptions(process.env.DATABASE_URL ?? ''),
  migrations: ['src/migrations/*.ts'],
  migrationsRun: false,
})
