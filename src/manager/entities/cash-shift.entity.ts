import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
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

  @ManyToOne(() => CashRegister, (register) => register.shifts)
  cashRegister: CashRegister;

  @Column()
  cashRegisterId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  initialAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  finalAmount: number;

  @Column({
    type: 'enum',
    enum: CashShiftStatus,
    default: CashShiftStatus.OPEN,
  })
  status: CashShiftStatus;

  @OneToMany(() => CashOperation, (operation) => operation.shift)
  operations: CashOperation[];

  @CreateDateColumn()
  createdAt: Date;
}
