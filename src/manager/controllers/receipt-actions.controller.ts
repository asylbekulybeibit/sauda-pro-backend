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

@Controller('manager/:shopId/receipt-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.CASHIER, RoleType.MANAGER, RoleType.SUPERADMIN, RoleType.OWNER)
export class ReceiptActionsController {
  constructor(private readonly receiptActionsService: ReceiptActionsService) {}

  @Post()
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async create(
    @Param('shopId') shopId: string,
    @Body() createReceiptActionDto: CreateReceiptActionDto,
    @Req() req
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.create(
      createReceiptActionDto,
      shopId,
      req.user.id
    );
  }

  @Get()
  async findAll(@Param('shopId') shopId: string): Promise<ReceiptAction[]> {
    return this.receiptActionsService.findAll(shopId);
  }

  @Get(':id')
  async findOne(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.findOne(id, shopId);
  }

  @Patch(':id')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async update(
    @Param('shopId') shopId: string,
    @Param('id') id: string,
    @Body() updateReceiptActionDto: UpdateReceiptActionDto
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.update(
      id,
      updateReceiptActionDto,
      shopId
    );
  }

  @Post(':id/print')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async printReceipt(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.printReceipt(id, shopId);
  }

  @Post(':id/send-whatsapp')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async sendReceiptWhatsapp(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.sendReceiptWhatsapp(id, shopId);
  }

  @Post(':id/send-email')
  @Roles(RoleType.CASHIER, RoleType.MANAGER)
  async sendReceiptEmail(
    @Param('shopId') shopId: string,
    @Param('id') id: string
  ): Promise<ReceiptAction> {
    return this.receiptActionsService.sendReceiptEmail(id, shopId);
  }
}
