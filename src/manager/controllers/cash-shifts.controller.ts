import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  UseGuards,
  Query,
  Request,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashShiftsService } from '../services/cash-shifts.service';
import { CreateCashShiftDto } from '../dto/cash-shifts/create-cash-shift.dto';
import { CloseCashShiftDto } from '../dto/cash-shifts/close-cash-shift.dto';
import { GetCashShiftsFilterDto } from '../dto/cash-shifts/get-cash-shifts-filter.dto';
import { CashShift } from '../entities/cash-shift.entity';
import { CashOperation } from '../entities/cash-operation.entity';

@Controller('manager/:shopId/cash-shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER, RoleType.CASHIER, RoleType.SUPERADMIN, RoleType.OWNER)
export class CashShiftsController {
  constructor(private readonly cashShiftsService: CashShiftsService) {}

  @Post()
  @Roles(RoleType.MANAGER, RoleType.CASHIER)
  async create(
    @Param('shopId') shopId: string,
    @Body() createCashShiftDto: CreateCashShiftDto,
    @Req() req
  ): Promise<CashShift> {
    return this.cashShiftsService.create(
      createCashShiftDto,
      shopId,
      req.user.id
    );
  }

  @Get()
  async findAll(
    @Param('shopId') shopId: string,
    @Query() filter: GetCashShiftsFilterDto
  ): Promise<CashShift[]> {
    return this.cashShiftsService.findAll(shopId, filter);
  }

  @Get('current')
  async getCurrentShifts(
    @Param('shopId') shopId: string
  ): Promise<CashShift[]> {
    return this.cashShiftsService.getCurrentShifts(shopId);
  }

  @Get(':id')
  async findOne(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<CashShift> {
    return this.cashShiftsService.findOne(id, shopId);
  }

  @Post(':id/close')
  @Roles(RoleType.MANAGER, RoleType.CASHIER)
  async close(
    @Param('shopId') shopId: string,
    @Param('id') id: string,
    @Body() closeCashShiftDto: CloseCashShiftDto,
    @Req() req
  ): Promise<CashShift> {
    return this.cashShiftsService.close(
      id,
      closeCashShiftDto,
      shopId,
      req.user.id
    );
  }

  @Get(':id/operations')
  async getShiftOperations(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<CashOperation[]> {
    return this.cashShiftsService.getShiftOperations(id, shopId);
  }

  @Get('cash-register/:cashRegisterId/open')
  async findOpenShiftByCashRegister(
    @Param('shopId') shopId: string,
    @Param('cashRegisterId') cashRegisterId: string
  ): Promise<CashShift | null> {
    return this.cashShiftsService
      .getCurrentShifts(shopId)
      .then(
        (shifts) =>
          shifts.find((shift) => shift.cashRegisterId === cashRegisterId) ||
          null
      );
  }
}
