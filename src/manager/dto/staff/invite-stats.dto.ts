import { RoleType } from '../../../auth/types/role.type';
import { InviteStatus } from '../../../invites/entities/invite.entity';

export class InviteStatsDto {
  total: number;
  byStatus: Record<InviteStatus, number>;
  byRole: Record<RoleType, number>;
  activeInvites: number;
  acceptedInvites: number;
  rejectedInvites: number;
  cancelledInvites: number;
  averageAcceptanceTime: number | null;
}
