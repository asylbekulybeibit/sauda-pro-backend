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

@Controller('manager/:shopId/warehouse/debts')
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
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Debt[]> {
    console.log(
      '[DebtsController] Getting debts for warehouse:',
      warehouseId,
      'shop:',
      shopId
    );
    try {
      const debts = await this.debtsService.findAll(warehouseId);
      console.log(
        '[DebtsController] Successfully retrieved debts, count:',
        debts.length
      );
      return debts;
    } catch (error) {
      console.error('[DebtsController] Error getting debts:', error);
      throw error;
    }
  }

  @Get(':warehouseId/active')
  async getActiveDebts(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Debt[]> {
    console.log(
      '[DebtsController] Getting active debts for warehouse:',
      warehouseId,
      'shop:',
      shopId
    );
    try {
      const debts = await this.debtsService.getActiveDebts(warehouseId);
      console.log(
        '[DebtsController] Successfully retrieved active debts, count:',
        debts.length
      );
      return debts;
    } catch (error) {
      console.error('[DebtsController] Error getting active debts:', error);
      throw error;
    }
  }

  @Get(':warehouseId/statistics')
  async getDebtsStatistics(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    console.log(
      '[DebtsController] Getting debt statistics for warehouse:',
      warehouseId,
      'shop:',
      shopId
    );
    try {
      const stats = await this.debtsService.getDebtsStatistics(warehouseId);
      console.log(
        '[DebtsController] Successfully retrieved debt statistics:',
        stats
      );
      return stats;
    } catch (error) {
      console.error('[DebtsController] Error getting debt statistics:', error);
      throw error;
    }
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
    return this.debtsService.addPayment(
      id,
      payment.paymentMethodId,
      payment.amount,
      req.user.id
    );
  }

  @Post(':id/cancel')
  async cancelDebt(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ): Promise<Debt> {
    return this.debtsService.cancel(id);
  }
}
