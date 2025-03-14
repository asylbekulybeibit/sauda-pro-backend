import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameProductPriceColumns1710864000000
  implements MigrationInterface
{
  name = 'RenameProductPriceColumns1710864000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create price_type enum
    await queryRunner.query(`
            CREATE TYPE "price_type_enum" AS ENUM ('purchase', 'selling')
        `);

    // Add priceType column to price_history table
    await queryRunner.query(`
            ALTER TABLE "price_history"
            ADD COLUMN "priceType" "price_type_enum" NOT NULL DEFAULT 'selling'
        `);

    // Add new columns to products table
    await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN "sellingPrice" numeric(10,2),
            ADD COLUMN "purchasePrice" numeric(10,2)
        `);

    // Copy data from old columns to new ones
    await queryRunner.query(`
            UPDATE "products"
            SET "sellingPrice" = "price",
                "purchasePrice" = "cost"
        `);

    // Set NOT NULL constraint on new columns
    await queryRunner.query(`
            ALTER TABLE "products"
            ALTER COLUMN "sellingPrice" SET NOT NULL,
            ALTER COLUMN "purchasePrice" SET NOT NULL
        `);

    // Drop old columns
    await queryRunner.query(`
            ALTER TABLE "products"
            DROP COLUMN "price",
            DROP COLUMN "cost"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back old columns
    await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN "price" numeric(10,2),
            ADD COLUMN "cost" numeric(10,2)
        `);

    // Copy data back from new columns to old ones
    await queryRunner.query(`
            UPDATE "products"
            SET "price" = "sellingPrice",
                "cost" = "purchasePrice"
        `);

    // Set NOT NULL constraint on old columns
    await queryRunner.query(`
            ALTER TABLE "products"
            ALTER COLUMN "price" SET NOT NULL,
            ALTER COLUMN "cost" SET NOT NULL
        `);

    // Drop new columns
    await queryRunner.query(`
            ALTER TABLE "products"
            DROP COLUMN "sellingPrice",
            DROP COLUMN "purchasePrice"
        `);

    // Drop priceType column from price_history table
    await queryRunner.query(`
            ALTER TABLE "price_history"
            DROP COLUMN "priceType"
        `);

    // Drop price_type enum
    await queryRunner.query(`
            DROP TYPE "price_type_enum"
        `);
  }
}
