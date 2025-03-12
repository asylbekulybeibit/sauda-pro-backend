import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InvitesModule } from './invites/invites.module';
import { ShopsModule } from './shops/shops.module';
import { RolesModule } from './roles/roles.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OwnerModule } from './owner/owner.module';
import { ManagerModule } from './manager/manager.module';
import { NotificationsModule } from './notifications/notifications.module';

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
        database: configService.get('DB_DATABASE', 'saudapro'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('DB_SYNC', true),
      }),
    }),
    AuthModule,
    UsersModule,
    InvitesModule,
    ShopsModule,
    RolesModule,
    DashboardModule,
    OwnerModule,
    ManagerModule,
    NotificationsModule,
  ],
})
export class AppModule {}
