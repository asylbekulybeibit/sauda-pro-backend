import {
  Controller,
  Get,
  Post,
  Body,
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
import { PurchasesService } from '../services/purchases.service';
import { CreatePurchaseDto } from '../dto/purchases/create-purchase.dto';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseWithItems } from '../interfaces/purchase-with-items.interface';

@Controller('manager/purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  async createPurchase(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Request() req
  ): Promise<PurchaseWithItems> {
    return this.purchasesService.createPurchase(req.user.id, createPurchaseDto);
  }

  @Get(':shopId')
  async getPurchases(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Request() req
  ): Promise<PurchaseWithItems[]> {
    return this.purchasesService.findAll(req.user.id, shopId);
  }

  @Get(':shopId/:id')
  async getPurchase(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ): Promise<PurchaseWithItems> {
    return this.purchasesService.findOne(id, shopId);
  }

  @Delete(':shopId/:id')
  async deletePurchase(
    @Param('shopId', ParseUUIDPipe) shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req
  ): Promise<{ success: boolean }> {
    await this.purchasesService.deletePurchase(req.user.id, id, shopId);
    return { success: true };
  }
}
