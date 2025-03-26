import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManagerController } from './controllers/manager.controller';
import { ManagerService } from './services/manager.service';
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
import { Barcode } from './entities/barcode.entity';
import { WarehouseProduct } from './entities/warehouse-product.entity';
import { Warehouse } from './entities/warehouse.entity';
import { Category } from './entities/category.entity';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { PriceHistory } from './entities/price-history.entity';
import { Promotion } from './entities/promotion.entity';
import { CashierStats } from './entities/cashier-stats.entity';
import { Supplier } from './entities/supplier.entity';
import { CashRegister } from './entities/cash-register.entity';
import { RegisterPaymentMethod } from './entities/register-payment-method.entity';
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
import { BulkOperationsController } from './controllers/bulk-operations.controller';
import { BulkOperationsService } from './services/bulk-operations.service';
import { WarehouseController } from './controllers/warehouse.controller';
import { WarehouseServicesController } from './controllers/warehouse-services.controller';
import { WarehouseServicesService } from './services/warehouse-services.service';
import { WarehouseProductsController } from './controllers/warehouse-products.controller';
import { WarehouseProductsService } from './services/warehouse-products.service';

// Новые импорты для учета баланса методов оплаты
import { PaymentMethodTransaction } from './entities/payment-method-transaction.entity';
import { PaymentMethodBalance } from './entities/payment-method-balance.entity';
import { PaymentMethodTransactionsService } from './services/payment-method-transactions.service';
import { PaymentMethodsController } from './controllers/payment-methods.controller';

// Существующие импорты для сервисных сущностей
import { Staff } from './entities/staff.entity';
import { Client } from './entities/client.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Service } from './entities/service.entity';
import { ServiceStaff } from './entities/service-staff.entity';
import { WarehouseService } from './entities/warehouse-service.entity';

// Импорты новых сущностей для чеков
import { ReceiptAction } from './entities/receipt-action.entity';
import { Receipt } from './entities/receipt.entity';

// Импорты новых контроллеров и сервисов для услуг
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './services/employee.service';
import { ClientController } from './controllers/client.controller';
import { ClientService } from './services/client.service';
import { VehicleController } from './controllers/vehicle.controller';
import { VehicleService } from './services/vehicle.service';
import { ServiceStaffController } from './controllers/service-staff.controller';
import { ServiceStaffService } from './services/service-staff.service';

// Импорты для кассовых смен и статистики

// Новые импорты для контроллеров кассира
import { ReceiptActionsController } from './controllers/receipt-actions.controller';

// Импорты недостающих сервисов для кассира
import { ReceiptActionsService } from './services/receipt-actions.service';

// Добавляем User для CashierService
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Barcode,
      WarehouseProduct,
      Warehouse,
      Category,
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
      // Новые сущности для учета баланса методов оплаты
      PaymentMethodTransaction,
      PaymentMethodBalance,
      // Добавляем новые сущности для сферы услуг
      Staff,
      Client,
      Vehicle,
      Service,
      ServiceStaff,
      WarehouseService,
      // Добавляем новые сущности для чеков
      ReceiptAction,
      Receipt,
      // Добавляем сущности для кассовых смен и операций
      // Добавляем User для CashierService
      User,
    ]),
    NotificationsModule,
    ReportsModule,
  ],
  controllers: [
    ManagerController,
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
    BulkOperationsController,
    WarehouseController,
    // Новый контроллер для методов оплаты
    PaymentMethodsController,
    // Новые контроллеры для услуг
    EmployeeController,
    ClientController,
    VehicleController,
    ServiceStaffController,
    // Контроллер для кассовых смен
    // Контроллер для статистики кассиров
    // Новые контроллеры для кассира
    ReceiptActionsController,
    WarehouseServicesController,
    WarehouseProductsController,
  ],
  providers: [
    ManagerService,
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
    BulkOperationsService,
    // Новый сервис для операций с методами оплаты
    PaymentMethodTransactionsService,
    // Новые сервисы для услуг
    EmployeeService,
    ClientService,
    VehicleService,
    ServiceStaffService,
    // Сервисы для кассовых смен и статистики
    // Добавляем недостающие сервисы кассира
    ReceiptActionsService,
    WarehouseServicesService,
    WarehouseProductsService,
  ],
  exports: [
    ManagerService,
    InventoryService,
    PurchasesService,
    // Экспортируем сервис для использования в других модулях
    PaymentMethodTransactionsService,
  ],
})
export class ManagerModule {}
