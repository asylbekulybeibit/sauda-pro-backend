import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop, ShopType } from './entities/shop.entity';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { MoreThan } from 'typeorm';

@Injectable()
export class ShopsService {
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
    const shop = await this.findOne(id);
    await this.shopsRepository.remove(shop);
  }

  async getStats() {
    const [shops, total] = await this.shopsRepository.findAndCount({
      where: { isActive: true },
    });

    const byType = {
      [ShopType.SHOP]: shops.filter((shop) => shop.type === ShopType.SHOP)
        .length,
      [ShopType.WAREHOUSE]: shops.filter(
        (shop) => shop.type === ShopType.WAREHOUSE
      ).length,
      [ShopType.POINT_OF_SALE]: shops.filter(
        (shop) => shop.type === ShopType.POINT_OF_SALE
      ).length,
    };

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
      byType,
      growth,
    };
  }
}
