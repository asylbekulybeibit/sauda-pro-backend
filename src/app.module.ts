import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InvitesModule } from './invites/invites.module';
import { ShopsModule } from './shops/shops.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { RolesModule } from './roles/roles.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OwnerModule } from './owner/owner.module';
import { ManagerModule } from './manager/manager.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ExpensesModule } from './expenses/expenses.module';
import { CacheModule } from './common/cache.module';
import { Barcode } from './manager/entities/barcode.entity';
import { Warehouse } from './manager/entities/warehouse.entity';
import { WarehouseProduct } from './manager/entities/warehouse-product.entity';
import { Receipt } from './manager/entities/receipt.entity';
import { ReceiptItem } from './manager/entities/receipt-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5435),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'saudaprod'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,
        synchronize: configService.get('DB_SYNC', true),
      }),
    }),
    CacheModule,
    AuthModule,
    UsersModule,
    InvitesModule,
    ShopsModule,
    WarehousesModule,
    RolesModule,
    DashboardModule,
    OwnerModule,
    ManagerModule,
    NotificationsModule,
    AnalyticsModule,
    ExpensesModule,
  ],
})
export class AppModule {}
