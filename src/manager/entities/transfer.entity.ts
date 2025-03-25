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
import { User } from '../../users/entities/user.entity';
import { TransferItem } from './transfer-item.entity';
import { Warehouse } from './warehouse.entity';

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
  fromWarehouseId: string;

  @Column()
  toWarehouseId: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'fromWarehouseId' })
  fromWarehouse: Warehouse;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'toWarehouseId' })
  toWarehouse: Warehouse;

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
