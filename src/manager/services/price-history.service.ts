import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceHistory } from '../entities/price-history.entity';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { CreatePriceHistoryDto } from '../dto/price-history/create-price-history.dto';

@Injectable()
export class PriceHistoryService {
  constructor(
    @InjectRepository(PriceHistory)
    private priceHistoryRepository: Repository<PriceHistory>,
    @InjectRepository(WarehouseProduct)
    private warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouseId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException('No access to this warehouse');
    }
  }

  async create(
    userId: string,
    createPriceHistoryDto: CreatePriceHistoryDto
  ): Promise<PriceHistory> {
    const product = await this.warehouseProductRepository.findOne({
      where: { id: createPriceHistoryDto.productId, isActive: true },
      relations: ['barcode', 'barcode.category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateManagerAccess(userId, product.warehouseId);

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
    const product = await this.warehouseProductRepository.findOne({
      where: { id: productId, isActive: true },
      relations: ['barcode', 'barcode.category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateManagerAccess(userId, product.warehouseId);

    return this.priceHistoryRepository
      .createQueryBuilder('priceHistory')
      .where('priceHistory.productId = :productId', { productId })
      .leftJoinAndSelect('priceHistory.changedBy', 'changedBy')
      .leftJoinAndSelect('priceHistory.product', 'product')
      .orderBy('priceHistory.createdAt', 'DESC')
      .getMany();
  }

  async findByWarehouse(
    userId: string,
    warehouseId: string
  ): Promise<PriceHistory[]> {
    console.log('[PriceHistoryService] findByWarehouse started:', {
      userId,
      warehouseId,
    });

    const result = await this.priceHistoryRepository
      .createQueryBuilder('priceHistory')
      .innerJoin('priceHistory.product', 'product')
      .where('product.warehouseId = :warehouseId', { warehouseId })
      .andWhere('product.isActive = :isActive', { isActive: true })
      .leftJoinAndSelect('priceHistory.changedBy', 'changedBy')
      .leftJoinAndSelect('priceHistory.product', 'productDetails')
      .orderBy('priceHistory.createdAt', 'DESC')
      .getMany();

    console.log('[PriceHistoryService] findByWarehouse result:', {
      recordsFound: result.length,
      firstRecord: result[0],
      lastRecord: result[result.length - 1],
    });

    return result;
  }

  async findByWarehouseAndDateRange(
    userId: string,
    warehouseId: string,
    startDate?: string,
    endDate?: string
  ): Promise<PriceHistory[]> {
    console.log('[PriceHistoryService] findByWarehouseAndDateRange started:', {
      userId,
      warehouseId,
      startDate,
      endDate,
    });

    const query = this.priceHistoryRepository
      .createQueryBuilder('priceHistory')
      .innerJoin('priceHistory.warehouseProduct', 'warehouseProduct')
      .where('warehouseProduct.warehouseId = :warehouseId', { warehouseId })
      .andWhere('warehouseProduct.isActive = :isActive', { isActive: true });

    // Добавляем фильтры по датам только если они указаны
    if (startDate && endDate) {
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);

      console.log('[PriceHistoryService] Parsed dates:', {
        parsedStartDate,
        parsedEndDate,
      });

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        console.error('[PriceHistoryService] Invalid date format');
        throw new Error('Invalid date format');
      }

      query
        .andWhere('priceHistory.createdAt >= :startDate', {
          startDate: parsedStartDate,
        })
        .andWhere('priceHistory.createdAt <= :endDate', {
          endDate: parsedEndDate,
        });
    }

    // Логируем SQL запрос для отладки
    const sqlQuery = query
      .leftJoinAndSelect('priceHistory.changedBy', 'changedBy')
      .leftJoinAndSelect(
        'priceHistory.warehouseProduct',
        'warehouseProductDetails'
      )
      .leftJoinAndSelect('warehouseProductDetails.barcode', 'barcode')
      .orderBy('priceHistory.createdAt', 'DESC')
      .getSql();

    console.log('[PriceHistoryService] Generated SQL query:', sqlQuery);

    const result = await query.getMany();

    console.log('[PriceHistoryService] findByWarehouseAndDateRange result:', {
      recordsFound: result.length,
      firstRecord: result[0],
      lastRecord: result[result.length - 1],
    });

    return result;
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
    const product = await this.warehouseProductRepository.findOne({
      where: { id: productId, isActive: true },
      relations: ['barcode', 'barcode.category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateManagerAccess(userId, product.warehouseId);

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
      minPrice: parseFloat(stats.minPrice) || product.sellingPrice,
      maxPrice: parseFloat(stats.maxPrice) || product.sellingPrice,
      avgPrice: parseFloat(stats.avgPrice) || product.sellingPrice,
      priceChangesCount: parseInt(stats.priceChangesCount) || 0,
    };
  }
}
