import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
  constructor(
    @InjectRepository(SupplierProduct)
    private supplierProductRepository: Repository<SupplierProduct>,
    @InjectRepository(Barcode)
    private barcodeRepository: Repository<Barcode>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: { userId, warehouseId, type: RoleType.MANAGER, isActive: true },
    });

    if (!hasAccess) {
      throw new ForbiddenException('No access to this warehouse');
    }
  }

  async getSupplierProducts(
    userId: string,
    supplierId: string,
    warehouseId: string
  ): Promise<any[]> {
    await this.validateManagerAccess(userId, warehouseId);

    // Проверяем, существует ли поставщик
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, warehouseId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Получаем связи поставщик-товар
    const supplierProducts = await this.supplierProductRepository.find({
      where: { supplierId },
      relations: ['barcode'],
    });

    // Извлекаем товары из связей
    const products = supplierProducts.map((sp) => {
      const barcode = sp.barcode;
      // Добавляем цену и минимальный заказ от поставщика к товару
      // Убедимся, что цена - это число
      const price =
        typeof sp.price === 'string'
          ? parseFloat(sp.price)
          : typeof sp.price === 'number'
          ? sp.price
          : 0;

      return {
        ...barcode,
        price: price,
        minimumOrder: sp.minimumOrder,
      };
    });

    return products;
  }

  async addProductToSupplier(
    userId: string,
    supplierId: string,
    barcodeId: string,
    warehouseId: string,
    data: { price: number; minimumOrder?: number }
  ): Promise<SupplierProduct> {
    await this.validateManagerAccess(userId, warehouseId);

    // Проверяем, существует ли поставщик
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, warehouseId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Проверяем, существует ли товар
    const barcode = await this.barcodeRepository.findOne({
      where: { id: barcodeId, isActive: true },
    });

    if (!barcode) {
      throw new NotFoundException('Product not found');
    }

    // Проверяем, не добавлен ли уже этот товар к поставщику
    const existingRelation = await this.supplierProductRepository.findOne({
      where: { supplierId, barcodeId },
    });

    if (existingRelation) {
      throw new BadRequestException('Product already added to this supplier');
    }

    // Создаем связь поставщик-товар
    const supplierProduct = this.supplierProductRepository.create({
      supplierId,
      barcodeId,
      price: data.price,
      minimumOrder: data.minimumOrder,
    });

    return this.supplierProductRepository.save(supplierProduct);
  }

  async removeProductFromSupplier(
    userId: string,
    supplierId: string,
    barcodeId: string,
    warehouseId: string
  ): Promise<void> {
    await this.validateManagerAccess(userId, warehouseId);

    // Проверяем, существует ли поставщик
    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, warehouseId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Проверяем, существует ли товар
    const barcode = await this.barcodeRepository.findOne({
      where: { id: barcodeId, isActive: true },
    });

    if (!barcode) {
      throw new NotFoundException('Product not found');
    }

    // Проверяем, существует ли связь поставщик-товар
    const supplierProduct = await this.supplierProductRepository.findOne({
      where: { supplierId, barcodeId },
    });

    if (!supplierProduct) {
      throw new NotFoundException('Product not found for this supplier');
    }

    // Удаляем связь поставщик-товар
    await this.supplierProductRepository.remove(supplierProduct);
  }
}
