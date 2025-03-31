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
import { RoleType } from '../../auth/types/role.type';
import { DebtsService } from '../services/debts.service';
import { CreateDebtDto } from '../dto/debts/create-debt.dto';
import { Debt } from '../entities/debt.entity';

@Controller('manager/debts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Post()
  async createDebt(
    @Body() createDebtDto: CreateDebtDto,
    @Request() req
  ): Promise<Debt> {
    return this.debtsService.create(req.user.id, createDebtDto);
  }

  @Get(':warehouseId')
  async getDebts(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Debt[]> {
    return this.debtsService.findAll(warehouseId);
  }

  @Get(':warehouseId/active')
  async getActiveDebts(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ): Promise<Debt[]> {
    return this.debtsService.getActiveDebts(warehouseId);
  }

  @Get(':warehouseId/statistics')
  async getDebtsStatistics(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.debtsService.getDebtsStatistics(warehouseId);
  }

  @Get('supplier/:supplierId')
  async getDebtsBySupplier(
    @Param('supplierId', ParseUUIDPipe) supplierId: string
  ): Promise<Debt[]> {
    return this.debtsService.getDebtsBySupplier(supplierId);
  }

  @Post(':id/payments')
  async addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    payment: {
      paymentMethodId: string;
      amount: number;
      note?: string;
    },
    @Request() req
  ): Promise<Debt> {
    return this.debtsService.addPayment(id, payment, req.user.id);
  }

  @Post(':id/cancel')
  async cancelDebt(@Param('id', ParseUUIDPipe) id: string): Promise<Debt> {
    return this.debtsService.cancel(id);
  }
}
