import { IsOptional, IsString } from 'class-validator';

export class StartServiceDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
