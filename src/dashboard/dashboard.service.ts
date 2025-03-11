import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ShopsService } from '../shops/shops.service';
import { InvitesService } from '../invites/invites.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly shopsService: ShopsService,
    private readonly invitesService: InvitesService
  ) {}

  async getStats() {
    const [userStats, shopStats, inviteStats] = await Promise.all([
      this.usersService.getStats(),
      this.shopsService.getStats(),
      this.invitesService.getStats(),
    ]);

    return {
      users: userStats,
      shops: shopStats,
      invites: inviteStats,
    };
  }
}
