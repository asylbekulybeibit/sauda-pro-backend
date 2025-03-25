import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from '../entities/warehouse.entity';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { Barcode } from '../entities/barcode.entity';
import { Category } from '../entities/category.entity';
import {
  BulkProductOperationDto,
  BulkOperationResultDto,
  BulkProductItemDto,
} from '../dto/bulk-operations/bulk-operations.dto';

@Injectable()
export class BulkOperationsService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>,
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
    warehouseId: string,
    data: BulkProductOperationDto
  ): Promise<BulkOperationResultDto> {
    // Проверяем существование склада
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
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
          // Поиск или создание категории
          let categoryId: string | null = null;
          if (product.category) {
            const category = await this.categoryRepository.findOne({
              where: { name: product.category, warehouseId: warehouseId },
            });
            if (category) {
              categoryId = category.id;
            }
          }

          // Создаем новый штрих-код
          const barcode = this.barcodeRepository.create({
            code: product.sku,
            productName: product.name,
            description: product.description,
            categoryId: categoryId,
            isActive: true,
          });

          const savedBarcode = await this.barcodeRepository.save(barcode);

          // Создаем товар в складе
          const warehouseProduct = this.warehouseProductRepository.create({
            barcodeId: savedBarcode.id,
            warehouseId: warehouseId,
            purchasePrice: product.price,
            sellingPrice: product.price,
            quantity: product.quantity,
            isActive: true,
          });

          await this.warehouseProductRepository.save(warehouseProduct);
        } else if (data.operation === 'update') {
          // Находим штрих-код по SKU
          const barcode = await this.barcodeRepository.findOne({
            where: { code: product.sku },
          });

          if (!barcode) {
            throw new Error(`Product with SKU ${product.sku} not found`);
          }

          // Обновляем данные штрих-кода
          barcode.productName = product.name;
          barcode.description = product.description;

          // Обновляем категорию если нужно
          if (product.category) {
            const category = await this.categoryRepository.findOne({
              where: { name: product.category, warehouseId: warehouseId },
            });
            if (category) {
              barcode.categoryId = category.id;
            }
          }

          await this.barcodeRepository.save(barcode);

          // Находим товар на складе
          const warehouseProduct =
            await this.warehouseProductRepository.findOne({
              where: {
                barcodeId: barcode.id,
                warehouseId: warehouseId,
              },
            });

          if (!warehouseProduct) {
            throw new Error(
              `Warehouse product not found for SKU ${product.sku}`
            );
          }

          // Обновляем данные товара
          warehouseProduct.sellingPrice = product.price;
          warehouseProduct.quantity = product.quantity;

          await this.warehouseProductRepository.save(warehouseProduct);
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
