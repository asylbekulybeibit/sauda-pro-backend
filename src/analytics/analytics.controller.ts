import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../auth/types/role.type';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER, RoleType.OWNER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Get sales analytics' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getSalesAnalytics(
    @Query('shopId') shopId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.analyticsService.getSalesAnalytics(
      shopId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Get inventory analytics' })
  @ApiQuery({ name: 'shopId', required: true })
  async getInventoryAnalytics(@Query('shopId') shopId: string) {
    return this.analyticsService.getInventoryAnalytics(shopId);
  }

  @Get('staff')
  @ApiOperation({ summary: 'Get staff performance analytics' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getStaffPerformance(
    @Query('shopId') shopId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.analyticsService.getStaffPerformance(
      shopId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('financial')
  @ApiOperation({ summary: 'Get financial metrics' })
  @ApiQuery({ name: 'shopId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getFinancialMetrics(
    @Query('shopId') shopId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.analyticsService.getFinancialMetrics(
      shopId,
      new Date(startDate),
      new Date(endDate)
    );
  }
}
