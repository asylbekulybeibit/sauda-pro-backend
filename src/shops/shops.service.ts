import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './entities/shop.entity';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { MoreThan } from 'typeorm';
import { Logger } from '@nestjs/common';

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);

  constructor(
    @InjectRepository(Shop)
    private shopsRepository: Repository<Shop>
  ) {}

  async create(createShopDto: CreateShopDto): Promise<Shop> {
    const shop = this.shopsRepository.create(createShopDto);
    return this.shopsRepository.save(shop);
  }

  async findAll(): Promise<Shop[]> {
    return this.shopsRepository.find({
      where: { isActive: true },
      relations: ['userRoles', 'userRoles.user'],
    });
  }

  async findOne(id: string): Promise<Shop> {
    const shop = await this.shopsRepository.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.user'],
    });

    if (!shop) {
      throw new NotFoundException(`Магазин с ID ${id} не найден`);
    }

    return shop;
  }

  async update(id: string, updateShopDto: UpdateShopDto): Promise<Shop> {
    const shop = await this.findOne(id);
    Object.assign(shop, updateShopDto);
    return this.shopsRepository.save(shop);
  }

  async remove(id: string): Promise<void> {
    const shop = await this.shopsRepository.findOne({ where: { id } });
    if (!shop) {
      throw new NotFoundException('Магазин не найден');
    }

    await this.shopsRepository.update(id, { isActive: false });
    this.logger.debug(`Магазин ${id} деактивирован`);
  }

  async getStats() {
    const [shops, total] = await this.shopsRepository.findAndCount({
      where: { isActive: true },
    });

    

    // Получаем количество магазинов за последний месяц
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const [lastMonthShops] = await this.shopsRepository.findAndCount({
      where: { createdAt: MoreThan(lastMonth) },
    });

    const growth =
      lastMonthShops.length > 0
        ? Math.round((lastMonthShops.length / total) * 100)
        : 0;

    return {
      total,
      active: shops.length,
     
      growth,
    };
  }
}
