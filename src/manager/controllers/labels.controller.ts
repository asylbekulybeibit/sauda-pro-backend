import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { LabelsService } from '../services/labels.service';
import { CreateTemplateDto } from '../dto/products/create-template.dto';
import { GenerateLabelsDto } from '../dto/products/generate-labels.dto';
import { LabelTemplate } from '../entities/label-template.entity';

@Controller('manager/labels')
@UseGuards(JwtAuthGuard)
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Post('templates')
  async createTemplate(
    @GetUser('id') userId: string,
    @Body() createTemplateDto: CreateTemplateDto
  ): Promise<LabelTemplate> {
    return this.labelsService.createTemplate(userId, createTemplateDto);
  }

  @Get('templates')
  async findTemplates(
    @GetUser('id') userId: string,
    @Query('shopId') shopId: string
  ): Promise<LabelTemplate[]> {
    return this.labelsService.findTemplates(userId, shopId);
  }

  @Get('templates/:id')
  async findTemplate(
    @GetUser('id') userId: string,
    @Query('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<LabelTemplate> {
    return this.labelsService.findTemplate(userId, shopId, id);
  }

  @Delete('templates/:id')
  async deleteTemplate(
    @GetUser('id') userId: string,
    @Query('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<void> {
    return this.labelsService.deleteTemplate(userId, shopId, id);
  }

  @Post('generate')
  async generateLabels(
    @GetUser('id') userId: string,
    @Body() generateLabelsDto: GenerateLabelsDto,
    @Res() res: Response
  ): Promise<void> {
    const buffer = await this.labelsService.generateBatchLabels(
      userId,
      generateLabelsDto.shopId,
      generateLabelsDto
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=labels.pdf',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('preview')
  async generatePreview(
    @GetUser('id') userId: string,
    @Query('shopId') shopId: string,
    @Query('productId') productId: string,
    @Query('templateId') templateId: string,
    @Res() res: Response
  ): Promise<void> {
    const buffer = await this.labelsService.generatePreview(
      userId,
      shopId,
      productId,
      templateId
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=preview.pdf',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('barcode')
  async findProductByBarcode(
    @GetUser('id') userId: string,
    @Query('shopId') shopId: string,
    @Query('barcode') barcode: string
  ) {
    return this.labelsService.findProductByBarcode(userId, shopId, barcode);
  }
}
