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
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { ReceiptActionsService } from '../services/receipt-actions.service';
import { CreateReceiptActionDto } from '../dto/receipt-actions/create-receipt-action.dto';
import { UpdateReceiptActionDto } from '../dto/receipt-actions/update-receipt-action.dto';
import { ReceiptAction } from '../entities/receipt-action.entity';

@Controller('manager/:warehouseId/receipt-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.CASHIER, RoleType.MANAGER, RoleType.SUPERADMIN, RoleType.OWNER)
export class ReceiptActionsController {
  constructor(private readonly receiptActionsService: ReceiptActionsService) {}

  @Post()
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async create(
    @Param('warehouseId') warehouseId: string,
    @Body() createReceiptActionDto: CreateReceiptActionDto,
    @Req() req
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.create(
      createReceiptActionDto,
      warehouseId,
      req.user.id
    );
  }

  @Get()
  async findAll(
    @Param('warehouseId') warehouseId: string
  ): Promise<ReceiptAction[]> {
    return this.receiptActionsService.findAll(warehouseId);
  }

  @Get(':id')
  async findOne(
    @Param('warehouseId') warehouseId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.findOne(id, warehouseId);
  }

  @Patch(':id')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async update(
    @Param('warehouseId') warehouseId: string,
    @Param('id') id: string,
    @Body() updateReceiptActionDto: UpdateReceiptActionDto
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.update(
      id,
      updateReceiptActionDto,
      warehouseId
    );
  }

  @Post(':id/print')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async printReceipt(
    @Param('warehouseId') warehouseId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.printReceipt(id, warehouseId);
  }

  @Post(':id/send-whatsapp')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async sendReceiptWhatsapp(
    @Param('warehouseId') warehouseId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.sendReceiptWhatsapp(id, warehouseId);
  }

  @Post(':id/send-email')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async sendReceiptEmail(
    @Param('warehouseId') warehouseId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.sendReceiptEmail(id, warehouseId);
  }
}
