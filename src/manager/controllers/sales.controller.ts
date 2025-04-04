import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SalesService } from '../services/sales.service';
import { GetSalesHistoryDto } from '../dto/sales/get-sales-history.dto';

@ApiTags('Sales')
@Controller('manager/:warehouseId/sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get sales history' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'receiptType', required: false, enum: ['sale', 'return'] })
  @ApiQuery({ name: 'cashierId', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getSalesHistory(
    @Param('warehouseId') warehouseId: string,
    @Query(ValidationPipe) query: GetSalesHistoryDto
  ) {
    return this.salesService.getSalesHistory(warehouseId, query);
  }

  @Get('receipts/:operationId')
  @ApiOperation({ summary: 'Get receipt details' })
  async getReceiptDetails(
    @Param('warehouseId') warehouseId: string,
    @Param('operationId') operationId: string
  ) {
    return this.salesService.getReceiptDetails(warehouseId, operationId);
  }

  @Get('cashiers')
  @ApiOperation({ summary: 'Get cashiers list' })
  async getCashiers(@Param('warehouseId') warehouseId: string) {
    return this.salesService.getCashiers(warehouseId);
  }

  @Get('clients')
  @ApiOperation({ summary: 'Get clients list' })
  async getClients(@Param('warehouseId') warehouseId: string) {
    return this.salesService.getClients(warehouseId);
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'Get vehicles list' })
  async getVehicles(@Param('warehouseId') warehouseId: string) {
    return this.salesService.getVehicles(warehouseId);
  }
}
