import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Warehouse } from '../manager/entities/warehouse.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { CacheService } from '../common/services/cache.service';
import { Cached } from '../common/decorators/cache.decorator';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly cacheService: CacheService
  ) {}
}
