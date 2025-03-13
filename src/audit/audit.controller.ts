import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { AuditService } from './audit.service';
import { SearchAuditLogsDto } from './dto/search-audit-logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../auth/types/role.type';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('shop/:shopId')
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async searchShopAuditLogs(
    @Param('shopId') shopId: string,
    @Query() searchDto: SearchAuditLogsDto
  ) {
    return this.auditService.search(shopId, searchDto);
  }

  @Get('shop/:shopId/recent')
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async getRecentActivity(
    @Param('shopId') shopId: string,
    @Query('limit') limit?: number
  ) {
    return this.auditService.getRecentActivity(shopId, limit);
  }

  @Get('user/activity')
  async getUserActivity(@GetUser() user: User) {
    return this.auditService.findByUser(user.id);
  }

  @Get('entity/:type/:id')
  @Roles(RoleType.OWNER, RoleType.MANAGER)
  async getEntityHistory(
    @Param('type') entityType: string,
    @Param('id') entityId: string,
    @Query('limit') limit?: number
  ) {
    return this.auditService.findByEntity(entityType as any, entityId, {
      limit,
    });
  }
}
