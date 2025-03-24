import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashierStatsService } from '../services/cashier-stats.service';
import { CashierStats } from '../entities/cashier-stats.entity';

@Controller('manager/:shopId/cashier-stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER, RoleType.SUPERADMIN, RoleType.OWNER)
export class CashierStatsController {
  constructor(private readonly cashierStatsService: CashierStatsService) {}

  @Get('user/:userId')
  async getCashierStats(
    @Param('shopId') shopId: string,
    @Param('userId') userId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string
  ): Promise<CashierStats[]> {
    const from = fromDate ? new Date(fromDate) : new Date();
    from.setHours(0, 0, 0, 0);

    // Если не указана конечная дата, используем текущую дату
    const to = toDate ? new Date(toDate) : new Date();
    to.setHours(23, 59, 59, 999);

    return this.cashierStatsService.getCashierStats(userId, from, to, shopId);
  }

  @Get('daily/:date')
  async getDailySummary(
    @Param('shopId') shopId: string,
    @Param('date') dateParam: string
  ): Promise<any> {
    const date = new Date(dateParam);
    return this.cashierStatsService.getDailySummary(shopId, date);
  }

  @Get('user/:userId/summary')
  async getUserSummary(
    @Param('shopId') shopId: string,
    @Param('userId') userId: string,
    @Query('fromDate') fromDateParam: string,
    @Query('toDate') toDateParam: string
  ): Promise<any> {
    const fromDate = fromDateParam ? new Date(fromDateParam) : new Date();
    fromDate.setHours(0, 0, 0, 0);

    // Если не указана конечная дата, используем текущую дату
    const toDate = toDateParam ? new Date(toDateParam) : new Date();
    toDate.setHours(23, 59, 59, 999);

    return this.cashierStatsService.getUserSummary(
      userId,
      fromDate,
      toDate,
      shopId
    );
  }
}
