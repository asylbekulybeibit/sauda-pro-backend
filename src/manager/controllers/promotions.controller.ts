import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { PromotionsService } from '../services/promotions.service';
import { CreatePromotionDto } from '../dto/promotions/create-promotion.dto';
import { Promotion } from '../entities/promotion.entity';

@Controller('manager/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  create(
    @Request() req,
    @Body() createPromotionDto: CreatePromotionDto
  ): Promise<Promotion> {
    console.log(
      'PromotionsController.create called with data:',
      JSON.stringify(createPromotionDto, null, 2)
    );
    return this.promotionsService.create(req.user.id, createPromotionDto);
  }

  @Post('create-with-discount')
  createWithDiscount(@Request() req, @Body() data: any): Promise<Promotion> {
    console.log(
      'PromotionsController.createWithDiscount called with data:',
      JSON.stringify(data, null, 2)
    );

    // Преобразуем данные в правильный формат CreatePromotionDto
    const createPromotionDto: CreatePromotionDto = {
      name: data.name,
      description: data.description,
      type: data.type,
      target: data.target,
      value: Number(data.value),
      discount: Number(data.discount || data.value), // Используем discount или value
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      shopId: data.shopId,
      productIds: data.productIds,
      categoryIds: data.categoryIds,
    };

    console.log(
      'Transformed DTO:',
      JSON.stringify(createPromotionDto, null, 2)
    );

    return this.promotionsService.create(req.user.id, createPromotionDto);
  }

  @Get('shop/:shopId')
  findAll(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Promotion[]> {
    return this.promotionsService.findAll(req.user.id, shopId);
  }

  @Get('shop/:shopId/promotion/:id')
  findOne(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<Promotion> {
    return this.promotionsService.findOne(req.user.id, shopId, id);
  }

  @Patch('shop/:shopId/promotion/:id')
  update(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePromotionDto: Partial<CreatePromotionDto>
  ): Promise<Promotion> {
    console.log(
      'PromotionsController.update called with data:',
      JSON.stringify(updatePromotionDto, null, 2)
    );
    return this.promotionsService.update(
      req.user.id,
      shopId,
      id,
      updatePromotionDto
    );
  }

  @Delete('shop/:shopId/promotion/:id')
  remove(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    return this.promotionsService.remove(req.user.id, shopId, id);
  }
}
