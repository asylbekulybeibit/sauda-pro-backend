import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeSupplierOptional1710592847000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Делаем поле supplierId необязательным
    await queryRunner.query(`
      ALTER TABLE "purchases" 
      ALTER COLUMN "supplierId" DROP NOT NULL
    `);

    // Делаем поле invoiceNumber необязательным
    await queryRunner.query(`
      ALTER TABLE "purchases" 
      ALTER COLUMN "invoiceNumber" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Возвращаем обязательность поля invoiceNumber
    await queryRunner.query(`
      ALTER TABLE "purchases" 
      ALTER COLUMN "invoiceNumber" SET NOT NULL
    `);

    // Возвращаем обязательность поля supplierId
    await queryRunner.query(`
      ALTER TABLE "purchases" 
      ALTER COLUMN "supplierId" SET NOT NULL
    `);
  }
}
