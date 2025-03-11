import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UsersModule } from '../users/users.module';
import { ShopsModule } from '../shops/shops.module';
import { InvitesModule } from '../invites/invites.module';

@Module({
  imports: [UsersModule, ShopsModule, InvitesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
