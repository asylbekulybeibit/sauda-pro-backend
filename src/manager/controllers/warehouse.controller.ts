import {
  Controller,
  Get,
  Post,
  Body,
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
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WarehouseService } from '../services/warehouse.service';

@Controller('manager/warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class WarehouseController {
  constructor(
    private readonly staffService: StaffService,
    private readonly warehouseService: WarehouseService
  ) {}

  @Get('invites/:warehouseId')
  getInvites(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.staffService.getWarehouseInvites(req.user.id, warehouseId);
  }

  @Post('invites/:warehouseId')
  createInvite(
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

  @Get('invites/:warehouseId/stats')
  getInviteStats(
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<InviteStatsDto> {
    return this.staffService.getWarehouseInviteStats(req.user.id, warehouseId);
  }

  @Post('invites/:warehouseId/:inviteId/cancel')
  cancelInvite(
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

  @Post('invites/:warehouseId/:inviteId/resend')
  resendInvite(
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

  @Get(':id')
  @ApiOperation({ summary: 'Get warehouse by ID' })
  @ApiResponse({ status: 200, description: 'Returns warehouse details' })
  async findOne(@Param('id') id: string) {
    console.log(
      '[WarehouseController] Получен запрос на поиск склада с ID:',
      id
    );
    try {
      const result = await this.warehouseService.findOne(id);
      console.log('[WarehouseController] Склад успешно найден');
      return result;
    } catch (error) {
      console.error('[WarehouseController] Ошибка при поиске склада:', error);
      throw error;
    }
  }
}
