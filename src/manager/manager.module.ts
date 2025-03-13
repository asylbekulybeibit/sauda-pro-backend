import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerController } from './controllers/manager.controller';
import { ManagerService } from './services/manager.service';
import { ProductsController } from './controllers/products.controller';
import { ProductsService } from './services/products.service';
import { CategoriesController } from './controllers/categories.controller';
import { CategoriesService } from './services/categories.service';
import { InventoryController } from './controllers/inventory.controller';
import { InventoryService } from './services/inventory.service';
import { StaffController } from './controllers/staff.controller';
import { StaffService } from './services/staff.service';
import { SuppliersController } from './controllers/suppliers.controller';
import { SuppliersService } from './services/suppliers.service';
import { PromotionsController } from './controllers/promotions.controller';
import { PromotionsService } from './services/promotions.service';
import { PriceHistoryController } from './controllers/price-history.controller';
import { PriceHistoryService } from './services/price-history.service';
import { LabelsController } from './controllers/labels.controller';
import { LabelsService } from './services/labels.service';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { PriceHistory } from './entities/price-history.entity';
import { Promotion } from './entities/promotion.entity';
import { CashierStats } from './entities/cashier-stats.entity';
import { Supplier } from './entities/supplier.entity';
import { Shop } from '../shops/entities/shop.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Invite } from '../invites/entities/invite.entity';
import { LabelTemplate } from './entities/label-template.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Category,
      Shop,
      UserRole,
      InventoryTransaction,
      Invite,
      PriceHistory,
      Promotion,
      CashierStats,
      Supplier,
      LabelTemplate,
    ]),
    NotificationsModule,
    ReportsModule,
  ],
  controllers: [
    ManagerController,
    ProductsController,
    CategoriesController,
    InventoryController,
    StaffController,
    SuppliersController,
    PromotionsController,
    PriceHistoryController,
    LabelsController,
  ],
  providers: [
    ManagerService,
    ProductsService,
    CategoriesService,
    InventoryService,
    StaffService,
    SuppliersService,
    PromotionsService,
    PriceHistoryService,
    LabelsService,
  ],
  exports: [ManagerService, ProductsService, InventoryService],
})
export class ManagerModule {}
