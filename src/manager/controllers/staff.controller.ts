import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { StaffService } from '../services/staff.service';
import { CreateStaffInviteDto } from '../dto/staff/create-staff-invite.dto';

@Controller('manager/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('shop/:shopId')
  getStaff(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.staffService.getStaff(req.user.id, shopId);
  }

  @Post('shop/:shopId/invite')
  createInvite(
    @Body() createStaffInviteDto: CreateStaffInviteDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.staffService.createInvite(
      createStaffInviteDto,
      req.user.id,
      shopId
    );
  }

  @Get('shop/:shopId/invites')
  getInvites(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.staffService.getInvites(req.user.id, shopId);
  }

  @Patch('shop/:shopId/staff/:id/deactivate')
  deactivateStaff(
    @Param('id') id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.staffService.deactivateStaff(id, req.user.id, shopId);
  }
}
