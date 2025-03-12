import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../roles/entities/user-role.entity';
import { PriceHistoryService } from '../services/price-history.service';
import { CreatePriceHistoryDto } from '../dto/price-history/create-price-history.dto';
import { PriceHistory } from '../entities/price-history.entity';

@Controller('manager/price-history')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class PriceHistoryController {
  constructor(private readonly priceHistoryService: PriceHistoryService) {}

  @Post()
  create(
    @Request() req,
    @Body() createPriceHistoryDto: CreatePriceHistoryDto
  ): Promise<PriceHistory> {
    return this.priceHistoryService.create(req.user.id, createPriceHistoryDto);
  }

  @Get('product/:productId')
  findByProduct(
    @Request() req,
    @Param('productId', ParseUUIDPipe) productId: string
  ): Promise<PriceHistory[]> {
    return this.priceHistoryService.findByProduct(req.user.id, productId);
  }

  @Get('shop/:shopId')
  findByShop(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<PriceHistory[]> {
    return this.priceHistoryService.findByShop(req.user.id, shopId);
  }

  @Get('product/:productId/stats')
  getProductPriceStats(
    @Request() req,
    @Param('productId', ParseUUIDPipe) productId: string
  ): Promise<{
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    priceChangesCount: number;
  }> {
    return this.priceHistoryService.getProductPriceStats(
      req.user.id,
      productId
    );
  }
}
