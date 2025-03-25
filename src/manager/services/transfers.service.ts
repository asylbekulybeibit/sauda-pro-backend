import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transfer, TransferStatus } from '../entities/transfer.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { CreateTransferDto } from '../dto/transfers/create-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouseId,
        type: RoleType.MANAGER,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException('No access to this warehouse');
    }
  }

  async create(createTransferDto: CreateTransferDto, userId: string) {
    await this.validateManagerAccess(userId, createTransferDto.fromWarehouseId);

    const transfer = this.transferRepository.create({
      fromWarehouseId: createTransferDto.fromWarehouseId,
      toWarehouseId: createTransferDto.toWarehouseId,
      date: createTransferDto.date,
      items: createTransferDto.items,
      comment: createTransferDto.comment,
      createdById: userId,
      status: TransferStatus.PENDING,
    });

    return this.transferRepository.save(transfer);
  }

  async findAll(warehouseId: string, userId: string) {
    await this.validateManagerAccess(userId, warehouseId);

    return this.transferRepository.find({
      where: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
      relations: ['fromWarehouse', 'toWarehouse', 'items', 'items.product'],
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
