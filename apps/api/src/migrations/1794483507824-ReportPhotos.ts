import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ReportPhotos1794483507824 implements MigrationInterface {
  name = 'ReportPhotos1794483507824'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "report_photos" ("id" SERIAL NOT NULL, "report_id" integer NOT NULL, "angle" character varying(10) NOT NULL, "mime" character varying(20) NOT NULL, "data" bytea NOT NULL, "uploaded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "report_photos_report_angle" UNIQUE ("report_id", "angle"), CONSTRAINT "PK_019a65eba5d794c4a7207953ad1" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "report_photos" ADD CONSTRAINT "FK_b0f0d1b209bee04b16fb1734d2c" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report_photos" DROP CONSTRAINT "FK_b0f0d1b209bee04b16fb1734d2c"`,
    )
    await queryRunner.query(`DROP TABLE "report_photos"`)
  }
}
