import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { User } from '../../users/entities/user.entity';
import { TransferItem } from './transfer-item.entity';

export enum TransferStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('transfers')
export class Transfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fromShopId: string;

  @Column()
  toShopId: string;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'fromShopId' })
  fromShop: Shop;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'toShopId' })
  toShop: Shop;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @OneToMany(() => TransferItem, (item) => item.transfer, {
    cascade: true,
  })
  items: TransferItem[];

  @Column({ nullable: true })
  comment?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
