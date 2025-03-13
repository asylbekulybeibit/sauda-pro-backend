import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Order } from '../manager/entities/order.entity';
import { OrderItem } from '../manager/entities/order-item.entity';
import { Product } from '../manager/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';
import { Expense } from '../expenses/entities/expense.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, User, Shop, Expense]),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
