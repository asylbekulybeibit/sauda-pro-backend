import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { Invite } from '../../invites/entities/invite.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSuperAdmin: boolean;

  @Column({ select: false, nullable: true })
  salt: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  roles: UserRole[];

  @OneToMany(() => Invite, (invite) => invite.createdBy)
  sentInvites: Invite[];

  @OneToMany(() => Invite, (invite) => invite.invitedUser)
  receivedInvites: Invite[];

  get name(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
