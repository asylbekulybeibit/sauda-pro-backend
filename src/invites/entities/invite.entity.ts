import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { RoleType } from '../../auth/types/role.type';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import { Warehouse } from '../../manager/entities/warehouse.entity';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({
    type: 'enum',
    enum: RoleType,
    default: RoleType.CASHIER,
  })
  role: RoleType;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @Column({ nullable: true })
  statusChangedAt: Date;

  @Column({ nullable: true })
  otp: string;

  @Column({ nullable: true })
  otpExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.sentInvites)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: string;

  @ManyToOne(() => User, (user) => user.receivedInvites, { nullable: true })
  @JoinColumn({ name: 'invitedUserId' })
  invitedUser: User;

  @Column({ nullable: true })
  invitedUserId: string;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  shopId: string;

  @ManyToOne(() => Warehouse, { nullable: true })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ nullable: true })
  warehouseId: string;

  @BeforeInsert()
  @BeforeUpdate()
  normalizePhone() {
    if (this.phone) {
      this.phone = normalizePhoneNumber(this.phone);
    }
  }
}
