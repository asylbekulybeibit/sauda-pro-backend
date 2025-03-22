import { IsOptional, IsString } from 'class-validator';

export class CompleteServiceDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
