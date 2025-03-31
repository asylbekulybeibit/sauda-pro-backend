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
import { CashRegister } from './entities/cash-register.entity';
import { RegisterPaymentMethod } from './entities/register-payment-method.entity';
import { PaymentMethodTransaction } from './entities/payment-method-transaction.entity';
import { Staff } from './entities/staff.entity';
import { Invite } from '../invites/entities/invite.entity';
import { ServiceStaff } from './entities/service-staff.entity';
import { Service } from './entities/service.entity';
import { Client } from './entities/client.entity';
import { Vehicle } from './entities/vehicle.entity';
import { InventoryNotification } from './entities/inventory-notification.entity';
import { VehicleNotification } from './entities/vehicle-notification.entity';
import { Debt } from './entities/debt.entity';
import { Receipt } from './entities/receipt.entity';
import { ReceiptItem } from './entities/receipt-item.entity';
import { CashShift } from './entities/cash-shift.entity';
import { CashOperation } from './entities/cash-operation.entity';

import { WarehouseProductsController } from './controllers/warehouse-products.controller';
import { CategoriesController } from './controllers/categories.controller';
import { BarcodesController } from './controllers/barcodes.controller';
import { SuppliersController } from './controllers/suppliers.controller';
import { PurchasesController } from './controllers/purchases.controller';
import { InventoryController } from './controllers/inventory.controller';
import { LabelsController } from './controllers/labels.controller';
import { PriceHistoryController } from './controllers/price-history.controller';
import { PromotionsController } from './controllers/promotions.controller';
import { CashRegistersController } from './controllers/cash-registers.controller';
import { PaymentMethodsController } from './controllers/payment-methods.controller';
import { StaffController } from './controllers/staff.controller';
import { EmployeeController } from './controllers/employee.controller';
import { ClientController } from './controllers/client.controller';
import { VehicleController } from './controllers/vehicle.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { DebtsController } from './controllers/debts.controller';
import { CashierController } from './controllers/cashier.controller';

import { WarehouseProductsService } from './services/warehouse-products.service';
import { CategoriesService } from './services/categories.service';
import { SuppliersService } from './services/suppliers.service';
import { PurchasesService } from './services/purchases.service';
import { InventoryService } from './services/inventory.service';
import { LabelsService } from './services/labels.service';
import { PriceHistoryService } from './services/price-history.service';
import { PromotionsService } from './services/promotions.service';
import { CashRegistersService } from './services/cash-registers.service';
import { PaymentMethodTransactionsService } from './services/payment-method-transactions.service';
import { StaffService } from './services/staff.service';
import { EmployeeService } from './services/employee.service';
import { ServiceStaffService } from './services/service-staff.service';
import { ClientService } from './services/client.service';
import { VehicleService } from './services/vehicle.service';
import { NotificationsService } from './services/notifications.service';
import { DebtsService } from './services/debts.service';
import { CashierService } from './services/cashier.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

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
      CashRegister,
      RegisterPaymentMethod,
      PaymentMethodTransaction,
      Staff,
      Invite,
      ServiceStaff,
      Service,
      Client,
      Vehicle,
      InventoryNotification,
      VehicleNotification,
      Debt,
      Receipt,
      ReceiptItem,
      CashShift,
      CashOperation,
    ]),
    WhatsappModule,
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
    CashRegistersController,
    PaymentMethodsController,
    StaffController,
    EmployeeController,
    ClientController,
    VehicleController,
    NotificationsController,
    DebtsController,
    CashierController,
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
    CashRegistersService,
    PaymentMethodTransactionsService,
    StaffService,
    EmployeeService,
    ServiceStaffService,
    ClientService,
    VehicleService,
    NotificationsService,
    DebtsService,
    CashierService,
  ],
  exports: [ManagerService, NotificationsService],
})
export class ManagerModule {}
