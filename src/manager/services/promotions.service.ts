import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Promotion, PromotionTarget } from '../entities/promotion.entity';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { CreatePromotionDto } from '../dto/promotions/create-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private promotionsRepository: Repository<Promotion>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: { userId, shopId, type: RoleType.MANAGER, isActive: true },
    });

    if (!hasAccess) {
      throw new ForbiddenException('No access to this shop');
    }
  }

  async create(
    userId: string,
    createPromotionDto: CreatePromotionDto
  ): Promise<Promotion> {
    await this.validateManagerAccess(userId, createPromotionDto.shopId);

    if (createPromotionDto.startDate > createPromotionDto.endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    // Validate products if target is PRODUCT
    if (
      createPromotionDto.target === PromotionTarget.PRODUCT &&
      createPromotionDto.productIds?.length
    ) {
      const products = await this.productsRepository.find({
        where: {
          id: In(createPromotionDto.productIds),
          shopId: createPromotionDto.shopId,
          isActive: true,
        },
      });

      if (products.length !== createPromotionDto.productIds.length) {
        throw new BadRequestException('Some products not found or inactive');
      }
    }

    // Validate categories if target is CATEGORY
    if (
      createPromotionDto.target === PromotionTarget.CATEGORY &&
      createPromotionDto.categoryIds?.length
    ) {
      const categories = await this.categoriesRepository.find({
        where: {
          id: In(createPromotionDto.categoryIds),
          shopId: createPromotionDto.shopId,
          isActive: true,
        },
      });

      if (categories.length !== createPromotionDto.categoryIds.length) {
        throw new BadRequestException('Some categories not found or inactive');
      }
    }

    const promotion = this.promotionsRepository.create({
      ...createPromotionDto,
      createdById: userId,
      isActive: true,
    });

    return this.promotionsRepository.save(promotion);
  }

  async findAll(userId: string, shopId: string): Promise<Promotion[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.promotionsRepository.find({
      where: { shopId },
      relations: ['products', 'categories'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    userId: string,
    shopId: string,
    id: string
  ): Promise<Promotion> {
    await this.validateManagerAccess(userId, shopId);

    const promotion = await this.promotionsRepository.findOne({
      where: { id, shopId },
      relations: ['products', 'categories'],
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return promotion;
  }

  async update(
    userId: string,
    shopId: string,
    id: string,
    updatePromotionDto: Partial<CreatePromotionDto>
  ): Promise<Promotion> {
    await this.validateManagerAccess(userId, shopId);

    const promotion = await this.findOne(userId, shopId, id);

    // Validate dates if provided
    if (updatePromotionDto.startDate && updatePromotionDto.endDate) {
      if (updatePromotionDto.startDate > updatePromotionDto.endDate) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    // Validate products if target is PRODUCT and productIds provided
    if (
      updatePromotionDto.target === PromotionTarget.PRODUCT &&
      updatePromotionDto.productIds?.length
    ) {
      const products = await this.productsRepository.find({
        where: {
          id: In(updatePromotionDto.productIds),
          shopId,
          isActive: true,
        },
      });

      if (products.length !== updatePromotionDto.productIds.length) {
        throw new BadRequestException('Some products not found or inactive');
      }
    }

    // Validate categories if target is CATEGORY and categoryIds provided
    if (
      updatePromotionDto.target === PromotionTarget.CATEGORY &&
      updatePromotionDto.categoryIds?.length
    ) {
      const categories = await this.categoriesRepository.find({
        where: {
          id: In(updatePromotionDto.categoryIds),
          shopId,
          isActive: true,
        },
      });

      if (categories.length !== updatePromotionDto.categoryIds.length) {
        throw new BadRequestException('Some categories not found or inactive');
      }
    }

    Object.assign(promotion, updatePromotionDto);
    return this.promotionsRepository.save(promotion);
  }

  async remove(userId: string, shopId: string, id: string): Promise<void> {
    await this.validateManagerAccess(userId, shopId);

    const promotion = await this.findOne(userId, shopId, id);
    promotion.isActive = false;
    await this.promotionsRepository.save(promotion);
  }
}
