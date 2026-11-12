import type { MigrationInterface, QueryRunner } from 'typeorm'

export class DropReportStatus1794500000000 implements MigrationInterface {
  name = 'DropReportStatus1794500000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "status"`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "status" character varying(10) NOT NULL DEFAULT 'DRAFT'`,
    )
    await queryRunner.query(
      `UPDATE "reports" SET "status" = 'SUBMITTED' WHERE "submitted_at" IS NOT NULL`,
    )
  }
}
