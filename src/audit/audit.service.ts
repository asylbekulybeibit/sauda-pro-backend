import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import {
  AuditLog,
  AuditActionType,
  AuditEntityType,
} from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { SearchAuditLogsDto } from './dto/search-audit-logs.dto';
import { RequestContext } from '../common/request-context';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>
  ) {}

  async create(
    dto: CreateAuditLogDto,
    context: RequestContext
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...dto,
      userId: context.user?.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return this.auditLogRepository.save(auditLog);
  }

  async createMany(
    dtos: CreateAuditLogDto[],
    context: RequestContext
  ): Promise<AuditLog[]> {
    const auditLogs = dtos.map((dto) =>
      this.auditLogRepository.create({
        ...dto,
        userId: context.user?.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
    );

    return this.auditLogRepository.save(auditLogs);
  }

  async search(shopId: string, dto: SearchAuditLogsDto) {
    const where: FindOptionsWhere<AuditLog> = { shopId };

    if (dto.startDate && dto.endDate) {
      where.createdAt = Between(new Date(dto.startDate), new Date(dto.endDate));
    }

    if (dto.userId) {
      where.userId = dto.userId;
    }

    if (dto.action) {
      where.action = dto.action;
    }

    if (dto.entityType) {
      where.entityType = dto.entityType;
    }

    if (dto.entityId) {
      where.entityId = dto.entityId;
    }

    const [items, total] = await this.auditLogRepository.findAndCount({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: dto.skip,
      take: dto.take,
    });

    return {
      items,
      total,
    };
  }

  async findByEntity(
    entityType: AuditEntityType,
    entityId: string,
    options?: { limit?: number }
  ) {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: options?.limit,
    });
  }

  async findByUser(
    userId: string,
    options?: { limit?: number; shopId?: string }
  ) {
    const where: FindOptionsWhere<AuditLog> = { userId };

    if (options?.shopId) {
      where.shopId = options.shopId;
    }

    return this.auditLogRepository.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: options?.limit,
    });
  }

  async getRecentActivity(shopId: string, limit: number = 10) {
    return this.auditLogRepository.find({
      where: { shopId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
