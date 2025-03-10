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
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../roles/entities/user-role.entity';

// Контроллер для профиля пользователя
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Request() req) {
    this.logger.debug('Получен запрос на получение профиля');
    this.logger.debug('Данные пользователя из запроса:', req.user);

    if (!req.user || !req.user.id) {
      this.logger.error('ID пользователя отсутствует в запросе');
      throw new UnauthorizedException('Пользователь не авторизован');
    }

    const profile = await this.usersService.findOne(req.user.id);
    this.logger.debug('Найден профиль:', profile);
    return profile;
  }

  @Patch()
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    this.logger.debug('Получен запрос на обновление профиля');
    this.logger.debug('Данные для обновления:', updateUserDto);
    return this.usersService.update(req.user.id, updateUserDto);
  }
}

// Контроллер для административных операций
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(RoleType.OWNER)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(RoleType.OWNER)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(RoleType.OWNER)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleType.OWNER)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(RoleType.OWNER)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
