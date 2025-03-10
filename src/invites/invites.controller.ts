import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../roles/entities/user-role.entity';

@Controller('invites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async create(@Body() createInviteDto: CreateInviteDto, @Request() req) {
    return this.invitesService.create(createInviteDto, req.user.id);
  }

  @Get()
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async findAll() {
    return this.invitesService.findAll();
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
}
