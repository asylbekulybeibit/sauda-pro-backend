import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from './entities/invite.entity';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';
import { UsersModule } from '../users/users.module';
import { ShopsModule } from '../shops/shops.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite]),
    UsersModule,
    ShopsModule,
    RolesModule,
  ],
  providers: [InvitesService],
  controllers: [InvitesController],
  exports: [InvitesService],
})
export class InvitesModule {}
