import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateUserRoleDto } from './dto/create-user-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../auth/types/role.type';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(RoleType.OWNER)
  async create(@Body() createUserRoleDto: CreateUserRoleDto) {
    return this.rolesService.create(createUserRoleDto);
  }

  @Get()
  @Roles(RoleType.OWNER)
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles(RoleType.OWNER)
  async findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Delete(':id')
  @Roles(RoleType.OWNER)
  async remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Get('user/:userId')
  @Roles(RoleType.OWNER)
  async findByUser(@Param('userId') userId: string) {
    return this.rolesService.findByUser(userId);
  }
}
