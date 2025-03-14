import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { PriceHistory, PriceType } from '../entities/price-history.entity';
import { CreateProductDto } from '../dto/products/create-product.dto';
import { UpdateProductDto } from '../dto/products/update-product.dto';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepository: Repository<PriceHistory>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(userId: string, shopId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав для управления этим магазином'
      );
    }
  }

  async create(createProductDto: CreateProductDto, userId: string) {
    await this.validateManagerAccess(userId, createProductDto.shopId);

    if (createProductDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: {
          id: createProductDto.categoryId,
          isActive: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Категория не найдена');
      }

      if (category.shopId !== createProductDto.shopId) {
        throw new ForbiddenException('Категория принадлежит другому магазину');
      }
    }

    const product = this.productRepository.create(createProductDto);
    const savedProduct = await this.productRepository.save(product);

    // Create initial price history records for both purchase and selling prices
    await Promise.all([
      this.priceHistoryRepository.save({
        oldPrice: 0,
        newPrice: createProductDto.purchasePrice,
        reason: 'Initial purchase price',
        productId: savedProduct.id,
        changedById: userId,
        priceType: PriceType.PURCHASE,
      }),
      this.priceHistoryRepository.save({
        oldPrice: 0,
        newPrice: createProductDto.sellingPrice,
        reason: 'Initial selling price',
        productId: savedProduct.id,
        changedById: userId,
        priceType: PriceType.SELLING,
      }),
    ]);

    return savedProduct;
  }

  async findByShop(shopId: string, userId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.productRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      relations: ['category'],
      order: {
        name: 'ASC',
      },
    });
  }

  async findOne(id: string, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Товар не найден');
    }

    await this.validateManagerAccess(userId, product.shopId);

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto, userId: string) {
    const product = await this.findOne(id, userId);

    if (updateProductDto.shopId && updateProductDto.shopId !== product.shopId) {
      throw new ForbiddenException('Нельзя изменить магазин товара');
    }

    if (
      updateProductDto.categoryId &&
      updateProductDto.categoryId !== product.categoryId
    ) {
      const category = await this.categoryRepository.findOne({
        where: {
          id: updateProductDto.categoryId,
          isActive: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Категория не найдена');
      }

      if (category.shopId !== product.shopId) {
        throw new ForbiddenException('Категория принадлежит другому магазину');
      }
    }

    // Track price changes
    if (
      updateProductDto.purchasePrice !== undefined &&
      updateProductDto.purchasePrice !== product.purchasePrice
    ) {
      await this.priceHistoryRepository.save({
        oldPrice: product.purchasePrice,
        newPrice: updateProductDto.purchasePrice,
        reason: 'Purchase price update',
        productId: product.id,
        changedById: userId,
        priceType: PriceType.PURCHASE,
      });
    }

    if (
      updateProductDto.sellingPrice !== undefined &&
      updateProductDto.sellingPrice !== product.sellingPrice
    ) {
      await this.priceHistoryRepository.save({
        oldPrice: product.sellingPrice,
        newPrice: updateProductDto.sellingPrice,
        reason: 'Selling price update',
        productId: product.id,
        changedById: userId,
        priceType: PriceType.SELLING,
      });
    }

    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  async remove(id: string, userId: string) {
    const product = await this.findOne(id, userId);
    product.isActive = false;
    return this.productRepository.save(product);
  }
}
