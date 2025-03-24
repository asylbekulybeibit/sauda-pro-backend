import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { CashOperationsService } from '../services/cash-operations.service';
import { CreateCashOperationDto } from '../dto/cash-operations/create-cash-operation.dto';
import { GetCashOperationsFilterDto } from '../dto/cash-operations/get-cash-operations-filter.dto';
import { CashOperation } from '../entities/cash-operation.entity';

@Controller('manager/:shopId/cash-operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.CASHIER, RoleType.MANAGER, RoleType.SUPERADMIN, RoleType.OWNER)
export class CashOperationsController {
  constructor(private readonly cashOperationsService: CashOperationsService) {}

  @Post()
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async create(
    @Param('shopId') shopId: string,
    @Body() createCashOperationDto: CreateCashOperationDto,
    @Req() req
  ): Promise<CashOperation> {
    return this.cashOperationsService.create(
      createCashOperationDto,
      shopId,
      req.user.id
    );
  }

  @Get()
  async findAll(
    @Param('shopId') shopId: string,
    @Query() filter: GetCashOperationsFilterDto
  ): Promise<CashOperation[]> {
    return this.cashOperationsService.findAll(shopId, filter);
  }

  @Get(':id')
  async findOne(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<CashOperation> {
    return this.cashOperationsService.findOne(id, shopId);
  }

  @Get('shift/:shiftId')
  async findByShift(
    @Param('shopId') shopId: string,
    @Param('shiftId') shiftId: string
  ): Promise<CashOperation[]> {
    return this.cashOperationsService.findByShift(shiftId, shopId);
  }

  @Get('register/:registerId')
  async findByRegister(
    @Param('shopId') shopId: string,
    @Param('registerId') registerId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ): Promise<CashOperation[]> {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    return this.cashOperationsService.findByRegister(
      registerId,
      shopId,
      from,
      to
    );
  }
}
