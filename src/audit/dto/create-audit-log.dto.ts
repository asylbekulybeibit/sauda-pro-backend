import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { AuditActionType, AuditEntityType } from '../entities/audit-log.entity';

export class CreateAuditLogDto {
  @IsEnum(AuditActionType)
  action: AuditActionType;

  @IsEnum(AuditEntityType)
  entityType: AuditEntityType;

  @IsString()
  entityId: string;

  @IsOptional()
  @IsObject()
  oldValue?: Record<string, any>;

  @IsOptional()
  @IsObject()
  newValue?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsString()
  description: string;

  @IsString()
  shopId: string;
}
