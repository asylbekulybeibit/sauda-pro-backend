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
import { RoleType } from '../../roles/entities/user-role.entity';
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
