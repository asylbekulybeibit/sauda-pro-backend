import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Promotion,
  PromotionTarget,
  PromotionType,
} from '../entities/promotion.entity';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { Category } from '../entities/category.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { CreatePromotionDto } from '../dto/promotions/create-promotion.dto';
import { Warehouse } from '../entities/warehouse.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private promotionsRepository: Repository<Promotion>,
    @InjectRepository(WarehouseProduct)
    private warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouseId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!hasAccess) {
      throw new ForbiddenException(
        'User does not have manager access to this warehouse'
      );
    }
  }

  // Метод для получения shopId по warehouseId
  private async getShopIdByWarehouseId(warehouseId: string): Promise<string> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
    }

    return warehouse.shopId;
  }

  async create(
    userId: string,
    createPromotionDto: CreatePromotionDto
  ): Promise<Promotion> {
    await this.validateManagerAccess(userId, createPromotionDto.warehouseId);

    // Получаем shopId для работы с категориями
    const shopId = await this.getShopIdByWarehouseId(
      createPromotionDto.warehouseId
    );

    // Validate dates
    if (createPromotionDto.startDate > createPromotionDto.endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    let products = [];
    let categories = [];

    // Validate products if target is PRODUCT
    if (
      createPromotionDto.target === PromotionTarget.PRODUCT &&
      createPromotionDto.productIds?.length
    ) {
      products = await this.warehouseProductRepository.find({
        where: {
          id: In(createPromotionDto.productIds),
          warehouseId: createPromotionDto.warehouseId,
          isActive: true,
        },
        relations: ['barcode', 'barcode.category'],
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
      categories = await this.categoriesRepository.find({
        where: {
          id: In(createPromotionDto.categoryIds),
          shopId: shopId,
          isActive: true,
        },
      });

      if (categories.length !== createPromotionDto.categoryIds.length) {
        throw new BadRequestException('Some categories not found or inactive');
      }
    }

    // Устанавливаем значение discount, если оно не было предоставлено
    let dtoWithDiscount = { ...createPromotionDto };

    // Если discount не указан, устанавливаем его на основе типа скидки
    if (dtoWithDiscount.discount === undefined) {
      // Для процентных скидок discount = value, для остальных = 0
      dtoWithDiscount.discount =
        dtoWithDiscount.type === PromotionType.PERCENTAGE
          ? dtoWithDiscount.value
          : 0;
    }

    console.log('Creating promotion with discount:', dtoWithDiscount.discount);
    console.log(
      'Products to add:',
      products.map((p) => p.id)
    );
    console.log(
      'Categories to add:',
      categories.map((c) => c.id)
    );

    const promotion = this.promotionsRepository.create({
      ...dtoWithDiscount,
      createdById: userId,
      isActive: true,
      products: products,
      categories: categories,
    });

    return this.promotionsRepository.save(promotion);
  }

  async findAll(userId: string, warehouseId: string): Promise<Promotion[]> {
    await this.validateManagerAccess(userId, warehouseId);

    return this.promotionsRepository.find({
      where: { warehouseId, isActive: true },
      relations: ['products', 'categories'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    userId: string,
    warehouseId: string,
    id: string
  ): Promise<Promotion> {
    await this.validateManagerAccess(userId, warehouseId);

    const promotion = await this.promotionsRepository.findOne({
      where: { id, warehouseId, isActive: true },
      relations: ['products', 'categories'],
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return promotion;
  }

  async update(
    userId: string,
    warehouseId: string,
    id: string,
    updatePromotionDto: Partial<CreatePromotionDto>
  ): Promise<Promotion> {
    await this.validateManagerAccess(userId, warehouseId);

    // Получаем shopId для работы с категориями
    const shopId = await this.getShopIdByWarehouseId(warehouseId);

    const promotion = await this.findOne(userId, warehouseId, id);

    // Validate dates if provided
    if (updatePromotionDto.startDate && updatePromotionDto.endDate) {
      if (updatePromotionDto.startDate > updatePromotionDto.endDate) {
        throw new BadRequestException('Start date cannot be after end date');
      }
    }

    let products = [];
    let categories = [];

    // Validate products if target is PRODUCT and productIds provided
    if (
      updatePromotionDto.target === PromotionTarget.PRODUCT &&
      updatePromotionDto.productIds?.length
    ) {
      products = await this.warehouseProductRepository.find({
        where: {
          id: In(updatePromotionDto.productIds),
          warehouseId,
          isActive: true,
        },
        relations: ['barcode', 'barcode.category'],
      });

      if (products.length !== updatePromotionDto.productIds.length) {
        throw new BadRequestException('Some products not found or inactive');
      }

      // Устанавливаем товары для обновленной акции
      promotion.products = products;
    } else if (updatePromotionDto.target === PromotionTarget.PRODUCT) {
      // Если указан тип PRODUCT, но товары не переданы, используем существующие
      if (promotion.target !== PromotionTarget.PRODUCT) {
        // Если меняется тип с CATEGORY на PRODUCT, а товары не переданы
        throw new BadRequestException(
          'Products are required for PRODUCT target'
        );
      }
    }

    // Validate categories if target is CATEGORY and categoryIds provided
    if (
      updatePromotionDto.target === PromotionTarget.CATEGORY &&
      updatePromotionDto.categoryIds?.length
    ) {
      categories = await this.categoriesRepository.find({
        where: {
          id: In(updatePromotionDto.categoryIds),
          shopId: shopId,
          isActive: true,
        },
      });

      if (categories.length !== updatePromotionDto.categoryIds.length) {
        throw new BadRequestException('Some categories not found or inactive');
      }

      // Устанавливаем категории для обновленной акции
      promotion.categories = categories;
    } else if (updatePromotionDto.target === PromotionTarget.CATEGORY) {
      // Если указан тип CATEGORY, но категории не переданы, используем существующие
      if (promotion.target !== PromotionTarget.CATEGORY) {
        // Если меняется тип с PRODUCT на CATEGORY, а категории не переданы
        throw new BadRequestException(
          'Categories are required for CATEGORY target'
        );
      }
    }

    // Если меняется тип, очищаем ненужные связи
    if (updatePromotionDto.target) {
      if (updatePromotionDto.target === PromotionTarget.PRODUCT) {
        promotion.categories = [];
      } else if (updatePromotionDto.target === PromotionTarget.CATEGORY) {
        promotion.products = [];
      } else if (updatePromotionDto.target === PromotionTarget.CART) {
        promotion.products = [];
        promotion.categories = [];
      }
    }

    // Подготавливаем данные для обновления
    const updateData = { ...updatePromotionDto };

    // Если тип изменился или установлено новое значение, но discount не передан
    if (
      (updateData.type !== undefined || updateData.value !== undefined) &&
      updateData.discount === undefined
    ) {
      // Определяем тип и значение для расчета discount
      const type =
        updateData.type !== undefined ? updateData.type : promotion.type;
      const value =
        updateData.value !== undefined ? updateData.value : promotion.value;

      // Для процентных скидок discount = value, для остальных = 0
      updateData.discount = type === PromotionType.PERCENTAGE ? value : 0;
    }

    // Обновляем поля акции
    Object.assign(promotion, updateData);

    return this.promotionsRepository.save(promotion);
  }

  async remove(userId: string, warehouseId: string, id: string): Promise<void> {
    await this.validateManagerAccess(userId, warehouseId);

    const promotion = await this.findOne(userId, warehouseId, id);
    promotion.isActive = false;
    await this.promotionsRepository.save(promotion);
  }
}
