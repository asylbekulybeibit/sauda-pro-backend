import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    this.logger.debug('Валидация JWT токена');
    this.logger.debug('Payload:', payload);

    try {
      // Получаем пользователя со всеми ролями
      const user = await this.usersService.findOne(payload.sub);
      this.logger.debug('Найден пользователь:', user);

      return {
        id: payload.sub,
        phone: payload.phone,
        isSuperAdmin: user.isSuperAdmin,
        roles: user.roles?.map((role) => role.role) || [],
      };
    } catch (error) {
      this.logger.error('Ошибка при получении пользователя:', error);
      throw error;
    }
  }
}
