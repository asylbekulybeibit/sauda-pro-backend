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
import { ClientService } from '../services/client.service';
import { CreateClientDto } from '../dto/clients/create-client.dto';
import { UpdateClientDto } from '../dto/clients/update-client.dto';

@Controller('manager/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post('shop/:shopId')
  create(
    @Body() createClientDto: CreateClientDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.clientService.create(createClientDto, req.user.id, shopId);
  }

  @Get('shop/:shopId')
  findAll(@Request() req, @Param('shopId', ParseUUIDPipe) shopId: string) {
    return this.clientService.findAll(req.user.id, shopId);
  }

  @Get('shop/:shopId/active')
  findAllActive(
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.clientService.findAllActive(req.user.id, shopId);
  }

  @Get('shop/:shopId/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.clientService.findOne(id, req.user.id, shopId);
  }

  @Patch('shop/:shopId/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClientDto: UpdateClientDto,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.clientService.update(id, updateClientDto, req.user.id, shopId);
  }

  @Delete('shop/:shopId/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Param('shopId', ParseUUIDPipe) shopId: string
  ) {
    return this.clientService.remove(id, req.user.id, shopId);
  }
}
