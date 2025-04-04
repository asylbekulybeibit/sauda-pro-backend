import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receipt } from './entities/receipt.entity';
import { Client } from './entities/client.entity';
import { Vehicle } from './entities/vehicle.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { SalesService } from './services/sales.service';
import { SalesController } from './controllers/sales.controller';
import { CashOperation } from './entities/cash-operation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Receipt,
      Client,
      Vehicle,
      User,
      UserRole,
      CashOperation,
    ]),
  ],
  providers: [SalesService],
  controllers: [SalesController],
})
export class SalesModule {}
