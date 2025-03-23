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
import { ServiceTypeService } from '../services/service-type.service';
import { CreateServiceTypeDto } from '../dto/service-types/create-service-type.dto';
import { UpdateServiceTypeDto } from '../dto/service-types/update-service-type.dto';

@Controller('manager/service-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class ServiceTypeController {
  constructor(private readonly serviceTypeService: ServiceTypeService) {}

  @Post('shop/:shopId')
  create(
    @Body() createServiceTypeDto: CreateServiceTypeDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceTypeService.create(
      createServiceTypeDto,
      req.user.id,
      shopId
    );
  }

  @Get('shop/:shopId')
  findAll(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.serviceTypeService.findAll(req.user.id, shopId);
  }

  @Get('shop/:shopId/active')
  findAllActive(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceTypeService.findAllActive(req.user.id, shopId);
  }

  @Get('shop/:shopId/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceTypeService.findOne(id, req.user.id, shopId);
  }

  @Patch('shop/:shopId/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceTypeDto: UpdateServiceTypeDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceTypeService.update(
      id,
      updateServiceTypeDto,
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
    return this.serviceTypeService.remove(id, req.user.id, shopId);
  }
}
