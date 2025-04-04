import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
  Delete,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreateAdminInviteDto } from './dto/create-admin-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../auth/types/role.type';

@Controller('invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async create(@Body() createInviteDto: CreateInviteDto, @Request() req) {
    return this.invitesService.create(createInviteDto, req.user.id);
  }

  @Post('admin/owner')
  @Roles(RoleType.SUPERADMIN)
  async createOwnerInvite(
    @Body() createAdminInviteDto: CreateAdminInviteDto,
    @Request() req
  ) {
    return this.invitesService.createAdminInvite(
      createAdminInviteDto,
      req.user.id
    );
  }

  @Get()
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async findAll() {
    return this.invitesService.findAll();
  }

  @Get('pending')
  async findPendingInvites(@Request() req) {
    return this.invitesService.findPendingInvitesByPhone(req.user.phone);
  }

  @Get('rejected')
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async findRejectedInvites() {
    return this.invitesService.findRejectedInvites();
  }

  @Get(':id')
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async findOne(@Param('id') id: string) {
    return this.invitesService.findOne(id);
  }

  @Post(':id/accept')
  async acceptInvite(@Param('id') id: string, @Request() req) {
    return this.invitesService.acceptInvite(id, req.user.id);
  }

  @Post(':id/reject')
  async rejectInvite(@Param('id') id: string, @Request() req) {
    return this.invitesService.rejectInvite(id, req.user.id);
  }

  @Patch(':id/cancel')
  @Roles(RoleType.SUPERADMIN)
  async cancelInvite(@Param('id') id: string) {
    return this.invitesService.cancelInvite(id);
  }

  @Delete(':id')
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async remove(@Param('id') id: string) {
    return this.invitesService.remove(id);
  }

  @Get('admin/all')
  @Roles(RoleType.SUPERADMIN)
  async findAllForAdmin() {
    return this.invitesService.findAllForAdmin();
  }
}
