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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashRegistersService } from '../services/cash-registers.service';
import { CreateCashRegisterDto } from '../dto/cash-registers/create-cash-register.dto';
import { CashRegister } from '../entities/cash-register.entity';
import { PaymentMethodDto } from '../dto/payment-methods/payment-method.dto';

@Controller('manager/:shopId/cash-registers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class CashRegistersController {
  constructor(private readonly cashRegistersService: CashRegistersService) {}

  @Post()
  create(
    @Body() createCashRegisterDto: CreateCashRegisterDto,
    @Param('shopId') shopId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.create(createCashRegisterDto, shopId);
  }

  @Get()
  findAll(@Param('shopId') shopId: string): Promise<CashRegister[]> {
    return this.cashRegistersService.findAllByShop(shopId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Param('shopId') shopId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.findOne(id, shopId);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Param('shopId') shopId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.updateStatus(id, status, shopId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Param('shopId') shopId: string
  ): Promise<void> {
    return this.cashRegistersService.remove(id, shopId);
  }

  @Put(':id/payment-methods')
  updatePaymentMethods(
    @Param('id') id: string,
    @Body('paymentMethods') paymentMethods: PaymentMethodDto[],
    @Param('shopId') shopId: string
  ): Promise<CashRegister> {
    return this.cashRegistersService.updatePaymentMethods(
      id,
      paymentMethods,
      shopId
    );
  }
}
