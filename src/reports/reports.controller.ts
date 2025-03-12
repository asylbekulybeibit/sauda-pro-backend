import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Res,
  ParseUUIDPipe,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../roles/entities/user-role.entity';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { Report, ReportType } from './entities/report.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Endpoints для менеджера
  @Post('manager')
  @Roles(RoleType.MANAGER)
  async createManagerReport(
    @CurrentUser('id') userId: string,
    @Body() createReportDto: CreateReportDto
  ): Promise<Report> {
    // Менеджер может создавать только операционные отчеты
    const allowedTypes = [
      ReportType.SALES,
      ReportType.INVENTORY,
      ReportType.STAFF,
      ReportType.CATEGORIES,
      ReportType.PROMOTIONS,
    ];

    if (!allowedTypes.includes(createReportDto.type)) {
      throw new ForbiddenException(
        'This report type is not available for managers'
      );
    }

    return this.reportsService.create(userId, createReportDto);
  }

  @Get('manager/shop/:shopId')
  @Roles(RoleType.MANAGER)
  async getManagerReports(
    @CurrentUser('id') userId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Report[]> {
    return this.reportsService.findAll(userId, shopId);
  }

  // Endpoints для владельца
  @Post('owner')
  @Roles(RoleType.OWNER)
  async createOwnerReport(
    @CurrentUser('id') userId: string,
    @Body() createReportDto: CreateReportDto
  ): Promise<Report> {
    return this.reportsService.create(userId, createReportDto);
  }

  @Get('owner/shop/:shopId')
  @Roles(RoleType.OWNER)
  async getOwnerReports(
    @CurrentUser('id') userId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Report[]> {
    return this.reportsService.findAll(userId, shopId);
  }

  @Get('owner/network')
  @Roles(RoleType.OWNER)
  async getNetworkReports(
    @CurrentUser('id') userId: string
  ): Promise<Report[]> {
    // TODO: Implement network-wide reports
    return [];
  }

  // Общие endpoints
  @Get(':id')
  @Roles(RoleType.MANAGER, RoleType.OWNER)
  async getReport(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Report> {
    return this.reportsService.findOne(userId, shopId, id);
  }

  @Get(':id/download')
  @Roles(RoleType.MANAGER, RoleType.OWNER)
  async downloadReport(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('shopId', ParseUUIDPipe) shopId: string,
    @Res() res: Response
  ): Promise<void> {
    const report = await this.reportsService.findOne(userId, shopId, id);

    if (!report.fileUrl) {
      throw new NotFoundException('Report file not found');
    }

    // TODO: Implement file download
    res.download(report.fileUrl);
  }
}
