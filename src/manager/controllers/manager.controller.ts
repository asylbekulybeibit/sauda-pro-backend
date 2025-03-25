import { Controller, Get, UseGuards, Request, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { ManagerService } from '../services/manager.service';

@Controller('manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  @Get('dashboard')
  async getDashboard(@Request() req) {
    return this.managerService.getDashboard(req.user.id);
  }

  @Get('warehouses/:id')
  async getWarehouse(@Param('id') id: string, @Request() req) {
    return this.managerService.getWarehouse(id, req.user.id);
  }
}
