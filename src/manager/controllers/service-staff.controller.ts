import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '../../auth/types/role.type';
import { ServiceStaffService } from '../services/service-staff.service';

@Controller('manager/service-staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class ServiceStaffController {
  constructor(private readonly serviceStaffService: ServiceStaffService) {}

  @Get('shop/:shopId/service/:serviceId')
  findAllByService(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceStaffService.findAllByService(
      serviceId,
      req.user.id,
      shopId
    );
  }

  @Get('shop/:shopId/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceStaffService.findOne(id, req.user.id, shopId);
  }

  @Post('shop/:shopId/:id/start')
  startWork(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceStaffService.startWork(id, req.user.id, shopId);
  }

  @Post('shop/:shopId/:id/complete')
  completeWork(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceStaffService.completeWork(id, req.user.id, shopId);
  }

  @Get('shop/:shopId/service/:serviceId/check-completion')
  checkAllStaffCompleted(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.serviceStaffService.checkAllStaffCompleted(
      serviceId,
      req.user.id,
      shopId
    );
  }
}
