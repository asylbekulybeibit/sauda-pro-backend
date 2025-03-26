import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OwnerService } from './owner.service';
import { Invite } from '../invites/entities/invite.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { RoleType } from '../auth/types/role.type';
import { CreateOwnerInviteDto } from './dto/create-owner-invite.dto';

@Controller('owner')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Post('invites')
  @Roles(RoleType.OWNER)
  async createInvite(
    @Body() createInviteDto: CreateOwnerInviteDto,
    @Request() req
  ): Promise<Invite> {
    return this.ownerService.createInvite(createInviteDto, req.user.id);
  }

  @Get('invites')
  @Roles(RoleType.OWNER)
  async getOwnerInvites(@Request() req): Promise<Invite[]> {
    return this.ownerService.getOwnerInvites(req.user.id);
  }

  @Get('shop-invites/:shopId')
  @Roles(RoleType.OWNER)
  async getShopInvites(
    @Request() req,
    @Param('shopId') shopId: string
  ): Promise<Invite[]> {
    return this.ownerService.getShopInvites(req.user.id, shopId);
  }

  @Get('invites/:shopId')
  @Roles(RoleType.OWNER)
  async getShopInvitesAlternative(
    @Request() req,
    @Param('shopId') shopId: string
  ): Promise<Invite[]> {
    return this.ownerService.getShopInvites(req.user.id, shopId);
  }

  @Get('invites/:warehouseId')
  @Roles(RoleType.OWNER)
  async getWarehouseInvites(
    @Request() req,
    @Param('warehouseId') warehouseId: string
  ): Promise<Invite[]> {
    return this.ownerService.getWarehouseInvites(req.user.id, warehouseId);
  }

  @Patch('invites/:id/cancel')
  @Roles(RoleType.OWNER)
  async cancelInvite(@Request() req, @Param('id') id: string): Promise<void> {
    await this.ownerService.cancelInvite(req.user.id, id);
  }

  @Get('staff/:warehouseId')
  @Roles(RoleType.OWNER)
  async getWarehouseStaff(
    @Request() req,
    @Param('warehouseId') warehouseId: string
  ): Promise<UserRole[]> {
    return this.ownerService.getWarehouseStaff(req.user.id, warehouseId);
  }

  @Get('shops/:shopId/staff')
  @Roles(RoleType.OWNER)
  async getShopStaff(
    @Request() req,
    @Param('shopId') shopId: string
  ): Promise<UserRole[]> {
    return this.ownerService.getShopStaff(req.user.id, shopId);
  }

  @Get(':shopId/staff')
  @Roles(RoleType.OWNER)
  async getShopStaffAlternative(
    @Request() req,
    @Param('shopId') shopId: string
  ): Promise<UserRole[]> {
    return this.ownerService.getShopStaff(req.user.id, shopId);
  }

  @Patch('staff/:id/deactivate')
  @Roles(RoleType.OWNER)
  async removeStaffMember(
    @Request() req,
    @Param('id') id: string
  ): Promise<void> {
    await this.ownerService.removeStaffMember(req.user.id, id);
  }

  @Get('shops/:shopId')
  @Roles(RoleType.OWNER)
  async getShopById(@Request() req, @Param('shopId') shopId: string) {
    return this.ownerService.getShopById(req.user.id, shopId);
  }

  @Get(':shopId')
  @Roles(RoleType.OWNER)
  async getShopByIdAlternative(
    @Request() req,
    @Param('shopId') shopId: string
  ) {
    return this.ownerService.getShopById(req.user.id, shopId);
  }
}
