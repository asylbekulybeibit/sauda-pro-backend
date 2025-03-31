import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentBalanceToRegisterPaymentMethods1711878096000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "register_payment_methods"
            ADD COLUMN IF NOT EXISTS "currentBalance" DECIMAL(10,2) DEFAULT 0;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "register_payment_methods"
            DROP COLUMN IF EXISTS "currentBalance";
        `);
  }
}
