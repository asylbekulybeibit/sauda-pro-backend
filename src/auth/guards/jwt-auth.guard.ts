import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    this.logger.debug('Проверка JWT токена');
    this.logger.debug('Authorization header:', request.headers.authorization);

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    this.logger.debug('Результат проверки JWT:');
    if (err) {
      this.logger.error('Ошибка при проверке JWT:', err);
    }
    if (info) {
      this.logger.debug('Дополнительная информация:', info);
    }
    if (user) {
      this.logger.debug('Пользователь из JWT:', user);
    } else {
      this.logger.warn('Пользователь не найден в JWT');
    }

    return super.handleRequest(err, user, info, context);
  }
}
