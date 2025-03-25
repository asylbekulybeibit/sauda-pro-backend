import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { RoleType } from '../../auth/types/role.type';
import { Warehouse } from '../../manager/entities/warehouse.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  shopId: string;

  @Column('uuid', { nullable: true })
  warehouseId: string;

  @Column({
    type: 'enum',
    enum: RoleType,
  })
  type: RoleType;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deactivatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.roles)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Shop, (shop) => shop.userRoles)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @ManyToOne(() => Warehouse, { nullable: true })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;
}
