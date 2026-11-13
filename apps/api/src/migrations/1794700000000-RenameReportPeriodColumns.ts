import type { MigrationInterface, QueryRunner } from 'typeorm'

export class RenameReportPeriodColumns1794700000000 implements MigrationInterface {
  name = 'RenameReportPeriodColumns1794700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" RENAME COLUMN "week_start" TO "period_start"`)
    await queryRunner.query(`ALTER TABLE "reports" RENAME COLUMN "week_end" TO "period_end"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" RENAME COLUMN "period_end" TO "week_end"`)
    await queryRunner.query(`ALTER TABLE "reports" RENAME COLUMN "period_start" TO "week_start"`)
  }
}
