import {
  IsEnum,
  IsUUID,
  IsDate,
  IsObject,
  ValidateNested,
  IsOptional,
  IsArray,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ReportType,
  ReportPeriod,
  ReportFormat,
} from '../entities/report.entity';

export class ReportFiltersDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  products?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  staff?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  promotions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsObject()
  additionalFilters?: Record<string, any>;
}

export class CreateReportDto {
  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportPeriod)
  period: ReportPeriod;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters: ReportFiltersDto;

  @IsUUID()
  shopId: string;
}
