import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransferTables1710864100000 implements MigrationInterface {
  name = 'CreateTransferTables1710864100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create transfer_status enum
    await queryRunner.query(`
      CREATE TYPE "transfer_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED')
    `);

    // Create transfers table
    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fromShopId" uuid NOT NULL,
        "toShopId" uuid NOT NULL,
        "date" TIMESTAMP NOT NULL,
        "status" "transfer_status_enum" NOT NULL DEFAULT 'PENDING',
        "comment" text,
        "createdById" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transfers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transfers_from_shop" FOREIGN KEY ("fromShopId") REFERENCES "shops"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transfers_to_shop" FOREIGN KEY ("toShopId") REFERENCES "shops"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transfers_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create transfer_items table
    await queryRunner.query(`
      CREATE TABLE "transfer_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transferId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "comment" text,
        CONSTRAINT "PK_transfer_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transfer_items_transfer" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transfer_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transfer_items"`);
    await queryRunner.query(`DROP TABLE "transfers"`);
    await queryRunner.query(`DROP TYPE "transfer_status_enum"`);
  }
}
