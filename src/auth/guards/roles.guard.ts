import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleType } from '../types/role.type';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    this.logger.debug(`Требуемые роли: ${JSON.stringify(requiredRoles)}`);

    if (!requiredRoles) {
      this.logger.debug('Роли не требуются, предоставляем доступ');
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    this.logger.debug(`Пользователь: ${JSON.stringify(user)}`);

    if (!user) {
      this.logger.warn('Пользователь не найден в запросе');
      return false;
    }

    if (user.isSuperAdmin) {
      this.logger.debug(
        'Пользователь является суперадмином, предоставляем доступ'
      );
      return true;
    }

    const hasRole =
      user.roles &&
      user.roles.some((role: RoleType) => requiredRoles.includes(role));

    this.logger.debug(
      `Роли пользователя: ${JSON.stringify(
        user.roles
      )}, имеет нужную роль: ${hasRole}`
    );

    return hasRole;
  }
}
