import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { Barcode } from '../entities/barcode.entity';
import { Supplier } from '../entities/supplier.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { SupplierProductDto } from '../dto/suppliers/supplier-product.dto';

@Injectable()
export class SupplierProductsService {
  private readonly logger = new Logger(SupplierProductsService.name);

  constructor(
    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepository: Repository<SupplierProduct>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: { userId, shopId, type: RoleType.MANAGER, isActive: true },
    });

    if (!hasAccess) {
      throw new ForbiddenException('У вас нет доступа к этому магазину');
    }
  }

  async getSupplierProducts(
    supplierId: string,
    shopId: string
  ): Promise<SupplierProduct[]> {
    this.logger.log(
      `[getSupplierProducts] Получение товаров поставщика ${supplierId} для магазина ${shopId}`
    );

    await this.validateManagerAccess(supplierId, shopId);

    // Проверяем существование поставщика
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, shopId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Поставщик не найден');
    }

    // Получаем все товары поставщика
    return this.supplierProductRepository.find({
      where: { supplierId },
      relations: ['barcode'],
    });
  }

  async addProductToSupplier(
    supplierId: string,
    barcodeId: string,
    data: { price: number; minimumOrder?: number },
    shopId: string
  ): Promise<SupplierProduct> {
    this.logger.log(
      `[addProductToSupplier] Добавление товара ${barcodeId} поставщику ${supplierId} для магазина ${shopId}`
    );

    await this.validateManagerAccess(supplierId, shopId);

    // Проверяем существование поставщика
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, shopId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Поставщик не найден');
    }

    // Проверяем существование товара
    const barcode = await this.barcodeRepository.findOne({
      where: { id: barcodeId },
    });

    if (!barcode) {
      throw new NotFoundException('Товар не найден');
    }

    // Создаем или обновляем связь поставщика с товаром
    let supplierProduct = await this.supplierProductRepository.findOne({
      where: { supplierId, barcodeId },
    });

    if (supplierProduct) {
      // Обновляем существующую связь
      Object.assign(supplierProduct, data);
    } else {
      // Создаем новую связь
      supplierProduct = this.supplierProductRepository.create({
        supplierId,
        barcodeId,
        ...data,
      });
    }

    return this.supplierProductRepository.save(supplierProduct);
  }

  async removeProductFromSupplier(
    supplierId: string,
    barcodeId: string,
    shopId: string
  ): Promise<void> {
    this.logger.log(
      `[removeProductFromSupplier] Удаление товара ${barcodeId} у поставщика ${supplierId} для магазина ${shopId}`
    );

    await this.validateManagerAccess(supplierId, shopId);

    // Проверяем существование поставщика
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, shopId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Поставщик не найден');
    }

    // Удаляем связь поставщика с товаром
    await this.supplierProductRepository.delete({
      supplierId,
      barcodeId,
    });
  }
}
