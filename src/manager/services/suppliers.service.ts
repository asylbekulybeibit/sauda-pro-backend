import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { CreateSupplierDto } from '../dto/suppliers/create-supplier.dto';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private suppliersRepository: Repository<Supplier>,
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
    createSupplierDto: CreateSupplierDto
  ): Promise<Supplier> {
    await this.validateManagerAccess(userId, createSupplierDto.shopId);

    const supplier = this.suppliersRepository.create(createSupplierDto);
    return this.suppliersRepository.save(supplier);
  }

  async findAll(userId: string, shopId: string): Promise<Supplier[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.suppliersRepository.find({
      where: { shopId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(userId: string, shopId: string, id: string): Promise<Supplier> {
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.suppliersRepository.findOne({
      where: { id, shopId, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(
    userId: string,
    shopId: string,
    id: string,
    updateData: Partial<CreateSupplierDto>
  ): Promise<Supplier> {
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.findOne(userId, shopId, id);
    Object.assign(supplier, updateData);

    return this.suppliersRepository.save(supplier);
  }

  async remove(userId: string, shopId: string, id: string): Promise<void> {
    await this.validateManagerAccess(userId, shopId);

    const supplier = await this.findOne(userId, shopId, id);
    supplier.isActive = false;

    await this.suppliersRepository.save(supplier);
  }
}
