import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit.service';
import { Reflector } from '@nestjs/core';
import { AuditActionType, AuditEntityType } from '../entities/audit-log.entity';
import { RequestContext } from '../../common/request-context';

export interface AuditMetadata {
  action: AuditActionType;
  entityType: AuditEntityType;
  getEntityId: (data: any) => string;
  getDescription: (data: any) => string;
  getShopId: (data: any) => string;
  getOldValue?: (data: any) => any;
  getNewValue?: (data: any) => any;
  getMetadata?: (data: any) => any;
}

export const Audit = (metadata: AuditMetadata) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('audit:metadata', metadata, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<AuditMetadata>(
      'audit:metadata',
      context.getHandler()
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const requestContext: RequestContext = {
      user: request.user,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };

    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.auditService.create(
            {
              action: metadata.action,
              entityType: metadata.entityType,
              entityId: metadata.getEntityId(data),
              description: metadata.getDescription(data),
              shopId: metadata.getShopId(data),
              oldValue: metadata.getOldValue?.(data),
              newValue: metadata.getNewValue?.(data),
              metadata: metadata.getMetadata?.(data),
            },
            requestContext
          );
        } catch (error) {
          console.error('Failed to create audit log:', error);
        }
      })
    );
  }
}
