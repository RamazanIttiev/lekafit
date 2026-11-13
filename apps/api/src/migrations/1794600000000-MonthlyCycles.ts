import type { MigrationInterface, QueryRunner } from 'typeorm'

const MOSCOW_DATE = (column: string) => `(${column} AT TIME ZONE 'Europe/Moscow')::date`

export class MonthlyCycles1794600000000 implements MigrationInterface {
  name = 'MonthlyCycles1794600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "reports_user_kind_period"`)
    await queryRunner.query(`
      DELETE FROM "reports"
      WHERE "kind" = 'MONTHLY' AND "submitted_at" IS NULL AND "id" NOT IN (
        SELECT DISTINCT ON ("user_id") "id" FROM "reports"
        WHERE "kind" = 'MONTHLY' AND "submitted_at" IS NULL
        ORDER BY "user_id", "week_start" DESC
      )`)
    await queryRunner.query(`
      UPDATE "reports" AS r SET
        "week_start" = COALESCE(o."prev_day", o."day"),
        "week_end" = CASE WHEN o."prev_day" IS NULL THEN o."day"
                          ELSE (o."prev_day" + INTERVAL '1 month')::date END
      FROM (
        SELECT "id", ${MOSCOW_DATE('"submitted_at"')} AS "day",
          LAG(${MOSCOW_DATE('"submitted_at"')}) OVER (
            PARTITION BY "user_id" ORDER BY "submitted_at"
          ) AS "prev_day"
        FROM "reports" WHERE "kind" = 'MONTHLY' AND "submitted_at" IS NOT NULL
      ) AS o
      WHERE r."id" = o."id"`)
    await queryRunner.query(`
      UPDATE "reports" AS r SET
        "week_start" = COALESCE(l."day", ${MOSCOW_DATE('r."updated_at"')}),
        "week_end" = CASE WHEN l."day" IS NULL THEN ${MOSCOW_DATE('r."updated_at"')}
                          ELSE (l."day" + INTERVAL '1 month')::date END
      FROM (SELECT r2."id", (
          SELECT MAX(${MOSCOW_DATE('s."submitted_at"')}) FROM "reports" s
          WHERE s."user_id" = r2."user_id" AND s."kind" = 'MONTHLY' AND s."submitted_at" IS NOT NULL
        ) AS "day"
        FROM "reports" r2 WHERE r2."kind" = 'MONTHLY' AND r2."submitted_at" IS NULL
      ) AS l
      WHERE r."id" = l."id"`)
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "reports_user_kind_period" UNIQUE ("user_id", "kind", "week_start", "week_end")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "reports_user_kind_period"`)
    await queryRunner.query(`
      UPDATE "reports" SET
        "week_start" = date_trunc('month', "week_end")::date,
        "week_end" = (date_trunc('month', "week_end") + INTERVAL '1 month - 1 day')::date
      WHERE "kind" = 'MONTHLY'`)
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "reports_user_kind_period" UNIQUE ("user_id", "kind", "week_start")`,
    )
  }
}
