import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';
import { Shop } from '../shops/entities/shop.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Invite } from '../invites/entities/invite.entity';
import { Warehouse } from '../manager/entities/warehouse.entity';
import { ManagerModule } from '../manager/manager.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shop, UserRole, Invite, Warehouse]),
    ManagerModule,
  ],
  controllers: [OwnerController],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}
