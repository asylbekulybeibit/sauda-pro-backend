import { User } from '../users/entities/user.entity';

export interface RequestContext {
  user?: User;
  ipAddress?: string;
  userAgent?: string;
}
