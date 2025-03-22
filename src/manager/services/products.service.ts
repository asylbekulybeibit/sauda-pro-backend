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

    // Handle barcode conversion
    if (!createProductDto.barcodes && createProductDto.barcode) {
      createProductDto.barcodes = [createProductDto.barcode];
      console.log(
        'Converting single barcode to array:',
        createProductDto.barcodes
      );
    }

    // Generate SKU if not provided
    if (!createProductDto.sku) {
      // Generate SKU from first 3 letters of product name + random number
      const namePrefix = createProductDto.name.substring(0, 3).toUpperCase();
      const randomNum = Math.floor(Math.random() * 10000);
      const timestamp = Date.now().toString().substring(8, 13); // Use part of timestamp for uniqueness
      createProductDto.sku = `${namePrefix}${randomNum}${timestamp}`;
      console.log('Generated SKU for product:', createProductDto.sku);
    } else {
      // Check if SKU is unique within the shop
      const existingProduct = await this.productRepository.findOne({
        where: {
          sku: createProductDto.sku,
          shopId: createProductDto.shopId,
          isActive: true,
        },
      });

      if (existingProduct) {
        throw new ForbiddenException(
          `Товар с артикулом ${createProductDto.sku} уже существует в этом магазине`
        );
      }
    }

    // Create a copy of the DTO without the barcode field to avoid TypeORM saving both properties
    const { barcode, ...productData } = createProductDto;
    console.log(
      'Creating product with data:',
      JSON.stringify(productData, null, 2)
    );

    const product = this.productRepository.create(productData);
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

    // Handle barcode conversion
    if (updateProductDto.barcode !== undefined) {
      if (!updateProductDto.barcodes) {
        updateProductDto.barcodes = updateProductDto.barcode
          ? [updateProductDto.barcode]
          : [];
      }
      console.log(
        'Update: converting barcode to barcodes array:',
        updateProductDto.barcodes
      );

      // Remove the barcode field from the update data
      delete updateProductDto.barcode;
    }

    console.log(
      'Updating product with data:',
      JSON.stringify(updateProductDto, null, 2)
    );

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
