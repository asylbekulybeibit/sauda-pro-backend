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
import { InviteStatsDto } from '../dto/staff/invite-stats.dto';
import { Invite } from '../../invites/entities/invite.entity';

@Controller('manager/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('shop/:shopId')
  getStaff(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.staffService.getStaff(req.user.id, shopId);
  }

  @Get('shop/:shopId/warehouse/:warehouseId')
  getStaffByWarehouse(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.staffService.getStaffByWarehouse(
      req.user.id,
      shopId,
      warehouseId
    );
  }

  @Post('shop/:shopId/invites')
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

  @Get('shop/:shopId/invites/stats')
  getInviteStats(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<InviteStatsDto> {
    return this.staffService.getInviteStats(req.user.id, shopId);
  }

  @Get('shop/:shopId/invites/history')
  getInviteHistory(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Invite[]> {
    return this.staffService.getInviteHistory(req.user.id, shopId);
  }

  @Post('shop/:shopId/invites/:inviteId/cancel')
  cancelInvite(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string
  ): Promise<Invite> {
    return this.staffService.cancelInvite(inviteId, req.user.id, shopId);
  }

  @Post('shop/:shopId/invites/:inviteId/resend')
  resendInvite(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string
  ): Promise<Invite> {
    return this.staffService.resendInvite(inviteId, req.user.id, shopId);
  }

  @Get('warehouse/:warehouseId/invites')
  getWarehouseInvites(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.staffService.getWarehouseInvites(req.user.id, warehouseId);
  }

  @Post('warehouse/:warehouseId/invites')
  createWarehouseInvite(
    @Body() createStaffInviteDto: CreateStaffInviteDto,
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.staffService.createWarehouseInvite(
      createStaffInviteDto,
      req.user.id,
      warehouseId
    );
  }

  @Get('warehouse/:warehouseId/invites/stats')
  getWarehouseInviteStats(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<InviteStatsDto> {
    return this.staffService.getWarehouseInviteStats(req.user.id, warehouseId);
  }

  @Post('warehouse/:warehouseId/invites/:inviteId/cancel')
  cancelWarehouseInvite(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string
  ): Promise<Invite> {
    return this.staffService.cancelWarehouseInvite(
      inviteId,
      req.user.id,
      warehouseId
    );
  }

  @Post('warehouse/:warehouseId/invites/:inviteId/resend')
  resendWarehouseInvite(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string
  ): Promise<Invite> {
    return this.staffService.resendWarehouseInvite(
      inviteId,
      req.user.id,
      warehouseId
    );
  }
}
