import type { MigrationInterface, QueryRunner } from 'typeorm'

export class MonthlyPlanTargets1794480999769 implements MigrationInterface {
  name = 'MonthlyPlanTargets1794480999769'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" ADD "training_month" double precision`)
    await queryRunner.query(`ALTER TABLE "plans" ADD "cardio_month" double precision`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "cardio_month"`)
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "training_month"`)
  }
}
