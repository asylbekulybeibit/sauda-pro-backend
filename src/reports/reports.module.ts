import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportGeneratorService } from './services/report-generator.service';
import { Report } from './entities/report.entity';
import { Barcode } from '../manager/entities/barcode.entity';
import { WarehouseProduct } from '../manager/entities/warehouse-product.entity';
import { Warehouse } from '../manager/entities/warehouse.entity';
import { Category } from '../manager/entities/category.entity';
import { InventoryTransaction } from '../manager/entities/inventory-transaction.entity';
import { CashierStats } from '../manager/entities/cashier-stats.entity';
import { Promotion } from '../manager/entities/promotion.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      Barcode,
      WarehouseProduct,
      Warehouse,
      Category,
      InventoryTransaction,
      CashierStats,
      Promotion,
      UserRole,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportGeneratorService],
  exports: [ReportsService],
})
export class ReportsModule {}
