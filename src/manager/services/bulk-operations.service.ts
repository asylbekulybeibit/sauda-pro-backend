import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import {
  BulkProductOperationDto,
  BulkOperationResultDto,
  BulkProductItemDto,
} from '../dto/bulk-operations/bulk-operations.dto';

@Injectable()
export class BulkOperationsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>
  ) {}

  async generateTemplate(type: string): Promise<Buffer> {
    if (type !== 'products') {
      throw new BadRequestException('Unsupported template type');
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Define template headers and example data
    const headers = [
      'name',
      'sku',
      'price',
      'quantity',
      'category',
      'description',
    ];

    const exampleData = [
      {
        name: 'Пример товара',
        sku: 'SKU123',
        price: '1000',
        quantity: '10',
        category: 'Категория',
        description: 'Описание товара',
      },
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exampleData, {
      header: headers,
    });

    // Add column widths
    const colWidths = [
      { wch: 30 }, // name
      { wch: 15 }, // sku
      { wch: 10 }, // price
      { wch: 10 }, // quantity
      { wch: 20 }, // category
      { wch: 40 }, // description
    ];
    ws['!cols'] = colWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }

  async processProductUpload(
    shopId: string,
    data: BulkProductOperationDto
  ): Promise<BulkOperationResultDto> {
    // Проверяем существование магазина
    const shop = await this.shopRepository.findOne({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException(`Shop with ID ${shopId} not found`);
    }

    const result: BulkOperationResultDto = {
      success: true,
      processed: 0,
      failed: 0,
      errors: [],
    };

    // Обрабатываем каждый товар
    for (let i = 0; i < data.products.length; i++) {
      const product = data.products[i];
      try {
        if (data.operation === 'create') {
          // Создаем новый товар
          const newProduct = this.productRepository.create({
            name: product.name,
            sku: product.sku,
            sellingPrice: product.price,
            purchasePrice: product.price, // По умолчанию установим закупочную цену равной продажной
            quantity: product.quantity,
            description: product.description,
            shopId: shopId,
            isActive: true,
          });

          // Если указана категория, попробуем найти ее по имени
          if (product.category) {
            const category = await this.categoryRepository.findOne({
              where: { name: product.category, shopId: shopId },
            });
            if (category) {
              newProduct.categoryId = category.id;
            }
          }

          await this.productRepository.save(newProduct);
        } else if (data.operation === 'update') {
          // Обновляем существующий товар
          const existingProduct = await this.productRepository.findOne({
            where: {
              sku: product.sku,
              shopId: shopId,
            },
          });

          if (!existingProduct) {
            throw new Error(`Product with SKU ${product.sku} not found`);
          }

          // Обновляем основные поля
          existingProduct.name = product.name;
          existingProduct.sellingPrice = product.price;
          existingProduct.quantity = product.quantity;
          existingProduct.description = product.description;

          // Если указана категория, попробуем найти ее по имени
          if (product.category) {
            const category = await this.categoryRepository.findOne({
              where: { name: product.category, shopId: shopId },
            });
            if (category) {
              existingProduct.categoryId = category.id;
            }
          }

          await this.productRepository.save(existingProduct);
        }
        result.processed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: i,
          sku: product.sku,
          message: error.message || 'Unknown error',
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }
}
