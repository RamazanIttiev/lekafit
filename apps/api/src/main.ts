import { createApp } from './app'
import { configFromEnv } from './config'

const { config, port } = configFromEnv(process.env)
const app = await createApp(config)
await app.listen(port)
