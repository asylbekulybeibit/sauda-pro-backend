import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { PriceHistory } from '../entities/price-history.entity';
import { CreateProductDto } from '../dto/products/create-product.dto';
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

    // Create initial price history record
    await this.priceHistoryRepository.save({
      oldPrice: 0,
      newPrice: createProductDto.price,
      reason: 'Initial price',
      productId: savedProduct.id,
      changedById: userId,
    });

    return savedProduct;
  }

  async findAll(userId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException('У вас нет прав менеджера');
    }

    return this.productRepository.find({
      where: {
        shopId: managerRole.shopId,
        isActive: true,
      },
      relations: ['category'],
    });
  }

  async findOne(id: string, userId: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Продукт не найден');
    }

    await this.validateManagerAccess(userId, product.shopId);

    return product;
  }

  async update(
    id: string,
    updateProductDto: Partial<CreateProductDto>,
    userId: string
  ) {
    const product = await this.findOne(id, userId);

    if (updateProductDto.shopId && updateProductDto.shopId !== product.shopId) {
      throw new ForbiddenException('Нельзя изменить магазин продукта');
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

    // If price is being updated, create a price history record
    if (
      updateProductDto.price !== undefined &&
      updateProductDto.price !== product.price
    ) {
      await this.priceHistoryRepository.save({
        oldPrice: product.price,
        newPrice: updateProductDto.price,
        reason: 'Price update',
        productId: product.id,
        changedById: userId,
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
