import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceHistory } from '../entities/price-history.entity';
import { Product } from '../entities/product.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { CreatePriceHistoryDto } from '../dto/price-history/create-price-history.dto';

@Injectable()
export class PriceHistoryService {
  constructor(
    @InjectRepository(PriceHistory)
    private priceHistoryRepository: Repository<PriceHistory>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException('No access to this shop');
    }
  }

  async create(
    userId: string,
    createPriceHistoryDto: CreatePriceHistoryDto
  ): Promise<PriceHistory> {
    const product = await this.productRepository.findOne({
      where: { id: createPriceHistoryDto.productId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateManagerAccess(userId, product.shopId);

    const priceHistory = this.priceHistoryRepository.create({
      ...createPriceHistoryDto,
      changedById: userId,
    });

    return this.priceHistoryRepository.save(priceHistory);
  }

  async findByProduct(
    userId: string,
    productId: string
  ): Promise<PriceHistory[]> {
    const product = await this.productRepository.findOne({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateManagerAccess(userId, product.shopId);

    return this.priceHistoryRepository.find({
      where: { productId },
      relations: ['changedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByShop(userId: string, shopId: string): Promise<PriceHistory[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.priceHistoryRepository
      .createQueryBuilder('priceHistory')
      .innerJoin('priceHistory.product', 'product')
      .where('product.shopId = :shopId', { shopId })
      .andWhere('product.isActive = :isActive', { isActive: true })
      .leftJoinAndSelect('priceHistory.changedBy', 'changedBy')
      .leftJoinAndSelect('priceHistory.product', 'productDetails')
      .orderBy('priceHistory.createdAt', 'DESC')
      .getMany();
  }

  async getProductPriceStats(
    userId: string,
    productId: string
  ): Promise<{
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    priceChangesCount: number;
  }> {
    const product = await this.productRepository.findOne({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateManagerAccess(userId, product.shopId);

    const stats = await this.priceHistoryRepository
      .createQueryBuilder('priceHistory')
      .select([
        'MIN(priceHistory.newPrice) as minPrice',
        'MAX(priceHistory.newPrice) as maxPrice',
        'AVG(priceHistory.newPrice) as avgPrice',
        'COUNT(*) as priceChangesCount',
      ])
      .where('priceHistory.productId = :productId', { productId })
      .getRawOne();

    return {
      minPrice: parseFloat(stats.minPrice) || product.price,
      maxPrice: parseFloat(stats.maxPrice) || product.price,
      avgPrice: parseFloat(stats.avgPrice) || product.price,
      priceChangesCount: parseInt(stats.priceChangesCount) || 0,
    };
  }
}
