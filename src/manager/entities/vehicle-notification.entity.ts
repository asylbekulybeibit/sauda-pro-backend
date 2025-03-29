import { Entity, Column } from 'typeorm';
import { NotificationRule } from './notification-rule.entity';

@Entity('vehicle_notifications')
export class VehicleNotification extends NotificationRule {
  @Column()
  serviceType: string;

  @Column('int')
  mileageInterval: number;

  @Column('int')
  monthsInterval: number;

  constructor() {
    super();
    this.type = 'vehicle';
  }
}
