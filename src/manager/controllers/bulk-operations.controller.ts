import { Controller, Get, Post, Param, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { BulkOperationsService } from '../services/bulk-operations.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import {
  BulkProductOperationDto,
  BulkOperationResultDto,
} from '../dto/bulk-operations/bulk-operations.dto';

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

  @Post(':shopId/products')
  @ApiOperation({ summary: 'Upload products in bulk' })
  @ApiResponse({
    status: 200,
    description: 'Products processed successfully',
    type: BulkOperationResultDto,
  })
  @ApiBody({ type: BulkProductOperationDto })
  async uploadProducts(
    @Param('shopId') shopId: string,
    @Body() data: BulkProductOperationDto
  ): Promise<BulkOperationResultDto> {
    return this.bulkOperationsService.processProductUpload(shopId, data);
  }
}
