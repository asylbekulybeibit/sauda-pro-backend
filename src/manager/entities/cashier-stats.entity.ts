import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { User } from '../../users/entities/user.entity';

@Entity('cashier_stats')
export class CashierStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  warehouseId: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalSales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCash: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCard: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalOnline: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalReturns: number;

  @Column({ type: 'integer', default: 0 })
  totalTransactions: number;

  @Column({ type: 'integer', default: 0 })
  salesCount: number;

  @Column({ type: 'integer', default: 0 })
  returnsCount: number;

  @Column({ type: 'integer', default: 0 })
  shiftsCount: number;

  @Column({ type: 'integer', default: 0 })
  workMinutes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
