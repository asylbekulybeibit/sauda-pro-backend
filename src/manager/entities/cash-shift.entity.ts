import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { CashRegister } from './cash-register.entity';
import { User } from '../../users/entities/user.entity';
import { CashOperation } from './cash-operation.entity';

export enum CashShiftStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  INTERRUPTED = 'interrupted',
}

@Entity('cash_shifts')
export class CashShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @ManyToOne(() => CashRegister, (register) => register.shifts)
  @JoinColumn({ name: 'cashRegisterId' })
  cashRegister: CashRegister;

  @Column()
  cashRegisterId: string;

  @Column()
  openedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'openedById' })
  openedBy: User;

  @Column({ nullable: true })
  closedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'closedById' })
  closedBy: User;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  initialAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  finalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentAmount: number;

  @Column({
    type: 'enum',
    enum: CashShiftStatus,
    default: CashShiftStatus.OPEN,
  })
  status: CashShiftStatus;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @OneToMany(() => CashOperation, (operation) => operation.shift)
  operations: CashOperation[];

  @CreateDateColumn()
  createdAt: Date;
}
