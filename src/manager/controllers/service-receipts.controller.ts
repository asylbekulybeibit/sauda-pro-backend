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
  Req,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { ServiceReceiptsService } from '../services/service-receipts.service';
import { CreateServiceReceiptDto } from '../dto/service-receipts/create-service-receipt.dto';
import { UpdateServiceReceiptDto } from '../dto/service-receipts/update-service-receipt.dto';
import { ServiceReceipt } from '../entities/service-receipt.entity';

@Controller('manager/:shopId/service-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.CASHIER, RoleType.MANAGER, RoleType.SUPERADMIN, RoleType.OWNER)
export class ServiceReceiptsController {
  constructor(
    private readonly serviceReceiptsService: ServiceReceiptsService
  ) {}

  @Post()
  @Roles(RoleType.CASHIER)
  async create(
    @Param('shopId') shopId: string,
    @Body() createServiceReceiptDto: CreateServiceReceiptDto,
    @Req() req
  ): Promise<ServiceReceipt> {
    return this.serviceReceiptsService.create(
      createServiceReceiptDto,
      shopId,
      req.user.id
    );
  }

  @Get()
  async findAll(
    @Param('shopId') shopId: string,
    @Query('cashShiftId') cashShiftId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ): Promise<ServiceReceipt[]> {
    return this.serviceReceiptsService.findAll(
      shopId,
      cashShiftId,
      serviceId,
      status,
      fromDate,
      toDate
    );
  }

  @Get(':id')
  async findOne(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<ServiceReceipt> {
    return this.serviceReceiptsService.findOne(id, shopId);
  }

  @Patch(':id')
  @Roles(RoleType.CASHIER)
  async update(
    @Param('shopId') shopId: string,
    @Param('id') id: string,
    @Body() updateServiceReceiptDto: UpdateServiceReceiptDto
  ): Promise<ServiceReceipt> {
    return this.serviceReceiptsService.update(
      id,
      updateServiceReceiptDto,
      shopId
    );
  }

  @Post(':id/cancel')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async cancel(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<ServiceReceipt> {
    return this.serviceReceiptsService.cancel(id, shopId);
  }

  @Post(':id/refund')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async refund(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<ServiceReceipt> {
    return this.serviceReceiptsService.refund(id, shopId);
  }
}
