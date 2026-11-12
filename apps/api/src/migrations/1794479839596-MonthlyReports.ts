import type { MigrationInterface, QueryRunner } from 'typeorm'

export class MonthlyReports1794479839596 implements MigrationInterface {
  name = 'MonthlyReports1794479839596'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "reports_user_week"`)
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "kind" character varying(10) NOT NULL DEFAULT 'WEEKLY'`,
    )
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "reports_user_kind_period" UNIQUE ("user_id", "kind", "week_start")`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "reports_user_kind_period"`)
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "kind"`)
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "reports_user_week" UNIQUE ("user_id", "week_start")`,
    )
  }
}
