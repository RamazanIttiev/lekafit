import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1794398584765 implements MigrationInterface {
  name = 'Init1794398584765'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "telegram_id" bigint NOT NULL, "first_name" text NOT NULL, "last_name" text, "username" text, "role" character varying(10) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_1a1e4649fd31ea6ec6b025c7bfc" UNIQUE ("telegram_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "plans" ("user_id" integer NOT NULL, "cal" double precision, "protein" double precision, "fat" double precision, "carb" double precision, "steps" double precision, "training" double precision, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_32f8c25a5ce0e33674e1253411e" PRIMARY KEY ("user_id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "week_start" date NOT NULL, "week_end" date NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'DRAFT', "data" jsonb NOT NULL, "plan_snapshot" jsonb, "submitted_at" TIMESTAMP WITH TIME ZONE, "seen_by_coach_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "reports_user_week" UNIQUE ("user_id", "week_start"), CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "plans" ADD CONSTRAINT "FK_32f8c25a5ce0e33674e1253411e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_ca7a21eb95ca4625bd5eaef7e0c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_ca7a21eb95ca4625bd5eaef7e0c"`,
    )
    await queryRunner.query(`ALTER TABLE "plans" DROP CONSTRAINT "FK_32f8c25a5ce0e33674e1253411e"`)
    await queryRunner.query(`DROP TABLE "reports"`)
    await queryRunner.query(`DROP TABLE "plans"`)
    await queryRunner.query(`DROP TABLE "users"`)
  }
}
