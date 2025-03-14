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
    shopId: string
  ): Promise<void> {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!managerRole) {
      throw new ForbiddenException('No access to this shop');
    }
  }

  async create(createTransferDto: CreateTransferDto, userId: string) {
    await this.validateManagerAccess(userId, createTransferDto.fromShopId);

    const transfer = this.transferRepository.create({
      fromShopId: createTransferDto.fromShopId,
      toShopId: createTransferDto.toShopId,
      date: createTransferDto.date,
      items: createTransferDto.items,
      comment: createTransferDto.comment,
      createdById: userId,
      status: TransferStatus.PENDING,
    });

    return this.transferRepository.save(transfer);
  }

  async findAll(shopId: string, userId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.transferRepository.find({
      where: [{ fromShopId: shopId }, { toShopId: shopId }],
      relations: ['fromShop', 'toShop', 'items', 'items.product'],
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
