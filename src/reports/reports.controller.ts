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
  Delete,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '../auth/types/role.type';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { Report, ReportType, ReportFormat } from './entities/report.entity';
import * as path from 'path';

@Controller('manager/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Endpoints для менеджера
  @Post()
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
      ReportType.FINANCIAL,
    ];

    if (!allowedTypes.includes(createReportDto.type)) {
      throw new ForbiddenException(
        'This report type is not available for managers'
      );
    }

    return this.reportsService.create(userId, createReportDto);
  }

  @Get('warehouse/:warehouseId')
  @Roles(RoleType.MANAGER)
  async getManagerReports(
    @CurrentUser('id') userId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Report[]> {
    console.log(
      'Getting reports for warehouse:',
      warehouseId,
      'userId:',
      userId
    );
    try {
      const reports = await this.reportsService.findAll(userId, warehouseId);
      console.log('Found reports:', reports?.length || 0);
      return reports;
    } catch (error) {
      console.error('Error getting reports:', error);
      throw error;
    }
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

  @Get('owner/warehouse/:warehouseId')
  @Roles(RoleType.OWNER)
  async getOwnerReports(
    @CurrentUser('id') userId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Report[]> {
    return this.reportsService.findAll(userId, warehouseId);
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
    @Query('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Report> {
    return this.reportsService.findOne(userId, warehouseId, id);
  }

  @Get(':id/download')
  @Roles(RoleType.MANAGER, RoleType.OWNER)
  async downloadReport(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Res() res: Response
  ): Promise<void> {
    const report = await this.reportsService.findOne(userId, warehouseId, id);

    if (!report.fileUrl) {
      throw new NotFoundException('Report file not found');
    }

    // Определяем MIME-тип в зависимости от формата отчета
    let contentType = 'application/octet-stream'; // По умолчанию
    if (report.format === ReportFormat.PDF) {
      contentType = 'application/pdf';
    } else if (report.format === ReportFormat.EXCEL) {
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    // Формируем имя файла с расширением
    const fileName = path.basename(report.fileUrl);
    const safeFileName = encodeURIComponent(fileName);

    // Устанавливаем заголовки для корректного скачивания файла
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeFileName}"`,
    });

    // Передаем файл для скачивания
    res.sendFile(path.resolve(report.fileUrl));
  }

  @Delete(':id')
  @Roles(RoleType.MANAGER, RoleType.OWNER)
  async deleteReport(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<void> {
    return this.reportsService.delete(userId, warehouseId, id);
  }
}
