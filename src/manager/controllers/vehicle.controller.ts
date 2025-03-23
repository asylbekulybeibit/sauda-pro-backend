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
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { VehicleService } from '../services/vehicle.service';
import { CreateVehicleDto } from '../dto/vehicles/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/vehicles/update-vehicle.dto';

@Controller('manager/vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post('shop/:shopId')
  create(
    @Body() createVehicleDto: CreateVehicleDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.vehicleService.create(createVehicleDto, req.user.id, shopId);
  }

  @Get('shop/:shopId')
  findAll(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.vehicleService.findAll(req.user.id, shopId);
  }

  @Get('shop/:shopId/client/:clientId')
  findByClient(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.vehicleService.findByClient(clientId, req.user.id, shopId);
  }

  @Get('shop/:shopId/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.vehicleService.findOne(id, req.user.id, shopId);
  }

  @Patch('shop/:shopId/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.vehicleService.update(
      id,
      updateVehicleDto,
      req.user.id,
      shopId
    );
  }

  @Delete('shop/:shopId/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.vehicleService.remove(id, req.user.id, shopId);
  }
}
