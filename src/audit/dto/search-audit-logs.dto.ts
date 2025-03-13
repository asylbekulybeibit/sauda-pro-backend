import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditActionType, AuditEntityType } from '../entities/audit-log.entity';

export class SearchAuditLogsDto {
  @IsOptional()
  @IsEnum(AuditActionType)
  action?: AuditActionType;

  @IsOptional()
  @IsEnum(AuditEntityType)
  entityType?: AuditEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  take?: number = 10;
}
