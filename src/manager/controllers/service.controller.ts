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
  ParseEnumPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { ServiceService } from '../services/service.service';
import { CreateServiceDto } from '../dto/services/create-service.dto';
import { UpdateServiceDto } from '../dto/services/update-service.dto';
import { StartServiceDto } from '../dto/services/start-service.dto';
import { CompleteServiceDto } from '../dto/services/complete-service.dto';
import { ServiceStatus } from '../entities/service.entity';

@Controller('manager/services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post('shop/:shopId')
  create(
    @Body() createServiceDto: CreateServiceDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.create(createServiceDto, req.user.id, shopId);
  }

  @Get('shop/:shopId')
  findAll(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.serviceService.findAll(req.user.id, shopId);
  }

  @Get('shop/:shopId/status/:status')
  findByStatus(
    @Param('status', new ParseEnumPipe(ServiceStatus)) status: ServiceStatus,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.findByStatus(status, req.user.id, shopId);
  }

  @Get('shop/:shopId/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.findOne(id, req.user.id, shopId);
  }

  @Patch('shop/:shopId/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.update(
      id,
      updateServiceDto,
      req.user.id,
      shopId
    );
  }

  @Post('shop/:shopId/:id/start')
  startService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() startServiceDto: StartServiceDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.startService(
      id,
      startServiceDto,
      req.user.id,
      shopId
    );
  }

  @Post('shop/:shopId/:id/complete')
  completeService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() completeServiceDto: CompleteServiceDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.completeService(
      id,
      completeServiceDto,
      req.user.id,
      shopId
    );
  }

  @Post('shop/:shopId/:id/cancel')
  cancelService(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.cancelService(id, req.user.id, shopId);
  }

  @Delete('shop/:shopId/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceService.remove(id, req.user.id, shopId);
  }
}
