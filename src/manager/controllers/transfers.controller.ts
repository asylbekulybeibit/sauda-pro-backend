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
import { TransfersService } from '../services/transfers.service';
import { CreateTransferDto } from '../dto/transfers/create-transfer.dto';

@Controller('manager/:warehouseId/transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  create(
    @Body() createTransferDto: CreateTransferDto,
    @Request() req,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string
  ) {
    // Убедимся, что fromWarehouseId соответствует warehouseId из URL
    createTransferDto.fromWarehouseId = warehouseId;
    return this.transfersService.create(createTransferDto, req.user.id);
  }

  @Get()
  findAll(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Request() req
  ) {
    return this.transfersService.findAll(warehouseId, req.user.id);
  }
}
