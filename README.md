# LekaFit — weekly report mini app

A Telegram Mini App that replaces the HTML/PDF weekly report. Clients fill in the
report inside Telegram, answers save to the server as they type, and the coach
gets a Telegram message with a summary and a button to open the full report.

| Package           | What it is                                                 |
| ----------------- | ---------------------------------------------------------- |
| `packages/shared` | Report fields, zod schemas, plan/fact formulas (RU labels) |
| `apps/api`        | NestJS API + grammY bot, Postgres via plain SQL migrations |
| `apps/web`        | React + HeroUI mini app (client form, coach screens)       |

## How it works

- **Client**: `/start` in the bot → "📋 Недельный отчёт". The report week is the
  week containing _today − 3 days_, so Mon–Wed opens last week and Thu–Sun this week.
  "Было" measurements are prefilled from the last sent report. Sent reports are locked.
- **Coach**: the Telegram account with id `COACH_TELEGRAM_ID` sees the coach view:
  clients (unreviewed first), per-client plan editor, progress table, report history.
  Opening a report marks it reviewed.
- **Auth**: every API call carries Telegram `initData` (`Authorization: tma …`),
  validated with the bot token (24h expiry). No passwords.

## Develop

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres on :5433
docker compose -f docker-compose.dev.yml exec db psql -U lekafit -c "create database lekafit_test"
pnpm check                                       # lint + typecheck + all tests
```

Run locally (bot disabled):

```bash
cd apps/api && DATABASE_URL=postgres://lekafit:lekafit@localhost:5433/lekafit \
  BOT_TOKEN=123456:dev COACH_TELEGRAM_ID=1000 WEBAPP_URL=http://localhost:5173 \
  START_BOT=false pnpm dev
```

```bash
pnpm --filter @lekafit/web dev
```

Outside Telegram the page only shows "open via the bot". To try it inside Telegram,
expose the web port over HTTPS (for example `cloudflared tunnel --url http://localhost:5173`),
set that URL as `WEBAPP_URL`, and run the API with a real test bot token.

Mutation testing: `pnpm --filter @lekafit/shared mutate`, or `npx stryker run` in `apps/api`.

## Deploy (one VPS)

1. Create the bot in @BotFather, copy the token. Point a domain's A record at the VPS.
2. Get the coach's numeric Telegram id (e.g. via @userinfobot).
3. On the server: `cp .env.example .env`, then fill in `DOMAIN`, `POSTGRES_PASSWORD`,
   `BOT_TOKEN` and `COACH_TELEGRAM_ID`.
4. Start everything:

   ```bash
   docker compose up -d --build
   ```

   Caddy gets a TLS certificate automatically. The API runs migrations on start,
   sets the bot's menu button to the mini app and starts polling.
5. The coach must press `/start` in the bot once, otherwise Telegram won't let the
   bot message her.
6. Nightly backups (keeps 30 days):

   ```bash
   (crontab -l; echo "0 3 * * * $(pwd)/scripts/backup.sh") | crontab -
   ```

   Restore with `docker compose exec -T db pg_restore -U lekafit -d lekafit --clean < backups/<file>.dump`.

## Not in the MVP

Monthly report, photos, reminders, PDF export, multiple coaches.
