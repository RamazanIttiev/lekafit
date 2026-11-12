import { DataSource } from 'typeorm'
import { dataSourceOptions } from './data-source'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — add it to .env at the repo root')

export default new DataSource({
  ...dataSourceOptions(url),
  migrationsRun: false,
})
