import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashierService } from '../services/cashier.service';
import { GetCashierShiftsDto } from '../dto/cashier/get-cashier-shifts.dto';
import { CashierShiftSummaryDto } from '../dto/cashier/cashier-shift-summary.dto';
import { CashierStartServiceDto as StartServiceDto } from '../dto/cashier/start-service.dto';
import { CashierCompleteServiceDto as CompleteServiceDto } from '../dto/cashier/complete-service.dto';
import { Service } from '../entities/service.entity';
import { CashShift } from '../entities/cash-shift.entity';
import { SalesReceipt } from '../entities/sales-receipt.entity';
import { ServiceReceipt } from '../entities/service-receipt.entity';
import { CreateVehicleDto } from '../dto/vehicles/create-vehicle.dto';
import { Vehicle } from '../entities/vehicle.entity';

@Controller('manager/:shopId/cashier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.CASHIER)
export class CashierController {
  constructor(private readonly cashierService: CashierService) {}

  @Get('shifts')
  async getCashierShifts(
    @Param('shopId') shopId: string,
    @Req() req,
    @Query() filter: GetCashierShiftsDto
  ): Promise<CashShift[]> {
    return this.cashierService.getCashierShifts(shopId, req.user.id, filter);
  }

  @Get('current-shift')
  async getCurrentShift(
    @Param('shopId') shopId: string,
    @Req() req
  ): Promise<CashShift> {
    return this.cashierService.getCurrentShift(shopId, req.user.id);
  }

  @Get('shift/:id/summary')
  async getShiftSummary(
    @Param('shopId') shopId: string,
    @Param('id') shiftId: string
  ): Promise<CashierShiftSummaryDto> {
    return this.cashierService.getShiftSummary(shopId, shiftId);
  }

  @Post('service/start')
  async startService(
    @Param('shopId') shopId: string,
    @Body() startServiceDto: StartServiceDto,
    @Req() req
  ): Promise<Service> {
    return this.cashierService.startService(
      startServiceDto,
      shopId,
      req.user.id
    );
  }

  @Post('service/complete')
  async completeService(
    @Param('shopId') shopId: string,
    @Body() completeServiceDto: CompleteServiceDto,
    @Req() req
  ): Promise<ServiceReceipt> {
    return this.cashierService.completeService(
      completeServiceDto,
      shopId,
      req.user.id
    );
  }

  @Get('services/active')
  async getActiveServices(@Param('shopId') shopId: string): Promise<Service[]> {
    return this.cashierService.getActiveServices(shopId);
  }

  @Post('quick-sale')
  async quickSale(
    @Param('shopId') shopId: string,
    @Body('productId') productId: string,
    @Body('quantity') quantity: number,
    @Body('paymentMethod') paymentMethod: string,
    @Req() req
  ): Promise<SalesReceipt> {
    return this.cashierService.quickSale(
      shopId,
      req.user.id,
      productId,
      quantity,
      paymentMethod
    );
  }

  @Get('daily-summary/:date')
  async getDailySummary(
    @Param('shopId') shopId: string,
    @Param('date') date: string
  ): Promise<any> {
    return this.cashierService.getDailySummary(shopId, date);
  }

  /**
   * Получение списка автомобилей клиента для кассира
   */
  @Get('vehicles/client/:clientId')
  async getClientVehicles(
    @Param('shopId') shopId: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Req() req
  ): Promise<Vehicle[]> {
    return this.cashierService.getClientVehicles(clientId, shopId);
  }

  /**
   * Создание нового автомобиля для клиента (для кассира)
   */
  @Post('vehicles')
  async createVehicle(
    @Param('shopId') shopId: string,
    @Body() createVehicleDto: CreateVehicleDto,
    @Req() req
  ): Promise<Vehicle> {
    return this.cashierService.createVehicle(
      createVehicleDto,
      shopId,
      req.user.id
    );
  }
}
