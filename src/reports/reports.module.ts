import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportGeneratorService } from './services/report-generator.service';
import { Report } from './entities/report.entity';
import { Product } from '../manager/entities/product.entity';
import { Category } from '../manager/entities/category.entity';
import { InventoryTransaction } from '../manager/entities/inventory-transaction.entity';
import { CashierStats } from '../manager/entities/cashier-stats.entity';
import { Promotion } from '../manager/entities/promotion.entity';
import { Shop } from '../shops/entities/shop.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      Product,
      Category,
      InventoryTransaction,
      CashierStats,
      Promotion,
      Shop,
      UserRole,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportGeneratorService],
  exports: [ReportsService],
})
export class ReportsModule {}
