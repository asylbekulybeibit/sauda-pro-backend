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
import { TransfersController } from './controllers/transfers.controller';
import { TransfersService } from './services/transfers.service';
import { CashRegistersController } from './controllers/cash-registers.controller';
import { CashRegistersService } from './services/cash-registers.service';
import { PurchasesController } from './controllers/purchases.controller';
import { PurchasesService } from './services/purchases.service';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { PriceHistory } from './entities/price-history.entity';
import { Promotion } from './entities/promotion.entity';
import { CashierStats } from './entities/cashier-stats.entity';
import { Supplier } from './entities/supplier.entity';
import { CashRegister } from './entities/cash-register.entity';
import { RegisterPaymentMethod } from './entities/register-payment-method.entity';
import { Shop } from '../shops/entities/shop.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Invite } from '../invites/entities/invite.entity';
import { LabelTemplate } from './entities/label-template.entity';
import { Transfer } from './entities/transfer.entity';
import { TransferItem } from './entities/transfer-item.entity';
import { Purchase } from './entities/purchase.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsModule } from '../reports/reports.module';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierProductsService } from './services/supplier-products.service';
import { SupplierProductsController } from './controllers/supplier-products.controller';

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
      Transfer,
      TransferItem,
      CashRegister,
      RegisterPaymentMethod,
      SupplierProduct,
      Purchase,
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
    TransfersController,
    CashRegistersController,
    SupplierProductsController,
    PurchasesController,
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
    TransfersService,
    CashRegistersService,
    SupplierProductsService,
    PurchasesService,
  ],
  exports: [
    ManagerService,
    ProductsService,
    InventoryService,
    PurchasesService,
  ],
})
export class ManagerModule {}
