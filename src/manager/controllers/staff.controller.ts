import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../roles/entities/user-role.entity';
import { StaffService } from '../services/staff.service';
import { CreateStaffInviteDto } from '../dto/staff/create-staff-invite.dto';

@Controller('manager/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  getStaff(@Request() req) {
    return this.staffService.getStaff(req.user.id);
  }

  @Post('invite')
  createInvite(
    @Body() createStaffInviteDto: CreateStaffInviteDto,
    @Request() req
  ) {
    return this.staffService.createInvite(createStaffInviteDto, req.user.id);
  }

  @Get('invites')
  getInvites(@Request() req) {
    return this.staffService.getInvites(req.user.id);
  }

  @Patch(':id/deactivate')
  deactivateStaff(@Param('id') id: string, @Request() req) {
    return this.staffService.deactivateStaff(id, req.user.id);
  }
}
