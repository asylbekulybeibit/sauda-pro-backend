import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Logger,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { ManagerService } from '../services/manager.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { Barcode } from '../entities/barcode.entity';

@Controller('manager/barcodes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class BarcodesController {
  private readonly logger = new Logger(BarcodesController.name);

  constructor(
    private readonly managerService: ManagerService,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>
  ) {}

  @Get('shop/:shopId')
  async getBarcodes(
    @Param('shopId') shopId: string,
    @Request() req,
    @Query('isService') isService?: string
  ) {
    const isServiceBool = isService === 'true' || isService === '1';
    return this.managerService.getBarcodes(shopId, req.user.id, isServiceBool);
  }

  @Post('shop/:shopId')
  async createBarcode(
    @Param('shopId') shopId: string,
    @Body() createBarcodeDto: any,
    @Request() req
  ) {
    // Проверяем доступ
    await this.managerService.validateManagerAccessToShop(req.user.id, shopId);

    // Создаем новый штрихкод
    const barcode = this.barcodeRepository.create({
      ...createBarcodeDto,
      shopId,
      isActive: true,
    });

    return this.barcodeRepository.save(barcode);
  }

  @Patch('shop/:shopId/:id')
  async updateBarcode(
    @Param('shopId') shopId: string,
    @Param('id') id: string,
    @Body() updateBarcodeDto: any,
    @Request() req
  ) {
    // Проверяем доступ
    await this.managerService.validateManagerAccessToShop(req.user.id, shopId);

    // Находим существующий штрихкод
    const barcode = await this.barcodeRepository.findOne({
      where: { id, shopId },
    });

    if (!barcode) {
      throw new Error('Штрихкод не найден');
    }

    // Обновляем данные штрихкода
    Object.assign(barcode, updateBarcodeDto);

    return this.barcodeRepository.save(barcode);
  }

  @Delete('shop/:shopId/:id')
  async deleteBarcode(
    @Param('shopId') shopId: string,
    @Param('id') id: string,
    @Request() req
  ) {
    // Проверяем доступ
    await this.managerService.validateManagerAccessToShop(req.user.id, shopId);

    // Находим существующий штрихкод
    const barcode = await this.barcodeRepository.findOne({
      where: { id, shopId },
    });

    if (!barcode) {
      throw new Error('Штрихкод не найден');
    }

    // Помечаем штрихкод как неактивный вместо физического удаления
    barcode.isActive = false;
    await this.barcodeRepository.save(barcode);
  }
}
