import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerController } from './controllers/manager.controller';
import { ManagerService } from './services/manager.service';
import { Warehouse } from './entities/warehouse.entity';
import { WarehouseProduct } from './entities/warehouse-product.entity';
import { Category } from './entities/category.entity';
import { Barcode } from './entities/barcode.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Supplier } from './entities/supplier.entity';
import { Purchase } from './entities/purchase.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { PriceHistory } from './entities/price-history.entity';
import { Promotion } from './entities/promotion.entity';
import { LabelTemplate } from './entities/label-template.entity';
import { NotificationsModule } from '../notifications/notifications.module';

import { WarehouseProductsController } from './controllers/warehouse-products.controller';
import { CategoriesController } from './controllers/categories.controller';
import { BarcodesController } from './controllers/barcodes.controller';
import { SuppliersController } from './controllers/suppliers.controller';
import { PurchasesController } from './controllers/purchases.controller';
import { InventoryController } from './controllers/inventory.controller';
import { LabelsController } from './controllers/labels.controller';
import { PriceHistoryController } from './controllers/price-history.controller';
import { PromotionsController } from './controllers/promotions.controller';

import { WarehouseProductsService } from './services/warehouse-products.service';
import { CategoriesService } from './services/categories.service';
import { SuppliersService } from './services/suppliers.service';
import { PurchasesService } from './services/purchases.service';
import { InventoryService } from './services/inventory.service';
import { LabelsService } from './services/labels.service';
import { PriceHistoryService } from './services/price-history.service';
import { PromotionsService } from './services/promotions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Warehouse,
      WarehouseProduct,
      Category,
      Barcode,
      UserRole,
      Supplier,
      Purchase,
      InventoryTransaction,
      LabelTemplate,
      PriceHistory,
      Promotion,
    ]),
    NotificationsModule,
  ],
  controllers: [
    ManagerController,
    WarehouseProductsController,
    CategoriesController,
    BarcodesController,
    SuppliersController,
    PurchasesController,
    InventoryController,
    LabelsController,
    PriceHistoryController,
    PromotionsController,
  ],
  providers: [
    ManagerService,
    WarehouseProductsService,
    CategoriesService,
    SuppliersService,
    PurchasesService,
    InventoryService,
    LabelsService,
    PriceHistoryService,
    PromotionsService,
  ],
  exports: [ManagerService],
})
export class ManagerModule {}
