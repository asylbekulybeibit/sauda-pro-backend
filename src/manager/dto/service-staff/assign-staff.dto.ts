import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignStaffDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId: string;

  @IsUUID()
  @IsNotEmpty()
  staffId: string;
}
