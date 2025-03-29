import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';

@Entity('notification_rules')
export class NotificationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: 'inventory' | 'vehicle';

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column('simple-array')
  notifyVia: string[];

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  shopId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
