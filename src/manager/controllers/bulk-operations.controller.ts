import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { BulkOperationsService } from '../services/bulk-operations.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Bulk Operations')
@Controller('bulk-operations')
export class BulkOperationsController {
  constructor(private readonly bulkOperationsService: BulkOperationsService) {}

  @Get('templates/:type')
  @ApiOperation({ summary: 'Download template file for bulk operations' })
  @ApiResponse({ status: 200, description: 'Template file' })
  async downloadTemplate(
    @Param('type') type: string,
    @Res() res: Response
  ): Promise<void> {
    const template = await this.bulkOperationsService.generateTemplate(type);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${type}_template.xlsx`
    );

    res.send(template);
  }
}
