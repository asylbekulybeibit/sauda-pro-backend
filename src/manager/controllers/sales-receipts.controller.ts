import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
  Request,
  Patch,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { SalesReceiptsService } from '../services/sales-receipts.service';
import { CreateSalesReceiptDto } from '../dto/sales-receipts/create-sales-receipt.dto';
import { UpdateSalesReceiptDto } from '../dto/sales-receipts/update-sales-receipt.dto';
import { SalesReceipt } from '../entities/sales-receipt.entity';

@Controller('manager/:shopId/sales-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.CASHIER, RoleType.MANAGER, RoleType.SUPERADMIN, RoleType.OWNER)
export class SalesReceiptsController {
  constructor(private readonly salesReceiptsService: SalesReceiptsService) {}

  @Post()
  @Roles(RoleType.CASHIER)
  async create(
    @Param('shopId') shopId: string,
    @Body() createSalesReceiptDto: CreateSalesReceiptDto,
    @Req() req
  ): Promise<SalesReceipt> {
    return this.salesReceiptsService.create(
      createSalesReceiptDto,
      shopId,
      req.user.id
    );
  }

  @Get()
  async findAll(
    @Param('shopId') shopId: string,
    @Query('cashShiftId') cashShiftId?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ): Promise<SalesReceipt[]> {
    return this.salesReceiptsService.findAll(
      shopId,
      cashShiftId,
      status,
      fromDate,
      toDate
    );
  }

  @Get(':id')
  async findOne(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<SalesReceipt> {
    return this.salesReceiptsService.findOne(id, shopId);
  }

  @Patch(':id')
  @Roles(RoleType.CASHIER)
  async update(
    @Param('shopId') shopId: string,
    @Param('id') id: string,
    @Body() updateSalesReceiptDto: UpdateSalesReceiptDto
  ): Promise<SalesReceipt> {
    return this.salesReceiptsService.update(id, updateSalesReceiptDto, shopId);
  }

  @Post(':id/cancel')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async cancel(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<SalesReceipt> {
    return this.salesReceiptsService.cancel(id, shopId);
  }

  @Post(':id/refund')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async refund(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<SalesReceipt> {
    return this.salesReceiptsService.refund(id, shopId);
  }
}
