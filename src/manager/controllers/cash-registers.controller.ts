import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashRegistersService } from '../services/cash-registers.service';
import { CreateCashRegisterDto } from '../dto/cash-registers/create-cash-register.dto';
import { CashRegister } from '../entities/cash-register.entity';
import { PaymentMethodDto } from '../dto/cash-registers/update-payment-methods.dto';

@Controller('manager/:warehouseId/cash-registers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class CashRegistersController {
  constructor(private readonly cashRegistersService: CashRegistersService) {}

  @Post()
  create(
    @Body() createCashRegisterDto: CreateCashRegisterDto,
    @Param('warehouseId') warehouseId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.create(createCashRegisterDto, warehouseId);
  }

  @Get()
  findAll(@Param('warehouseId') warehouseId: string): Promise<CashRegister[]> {
    return this.cashRegistersService.findAllByWarehouse(warehouseId);
  }

  @Get('shared-payment-methods')
  async getSharedPaymentMethods(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    return this.cashRegistersService.getSharedPaymentMethods(warehouseId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Param('warehouseId') warehouseId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.findOne(id, warehouseId);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Param('warehouseId') warehouseId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.updateStatus(id, status, warehouseId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Param('warehouseId') warehouseId: string
  ): Promise<void> {
    return this.cashRegistersService.remove(id, warehouseId);
  }

  @Put(':id/payment-methods')
  updatePaymentMethods(
    @Param('id') id: string,
    @Body('paymentMethods') paymentMethods: PaymentMethodDto[],
    @Param('warehouseId') warehouseId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.updatePaymentMethods(
      id,
      paymentMethods,
      warehouseId
    );
  }
}
