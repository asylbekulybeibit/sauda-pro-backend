import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { RegisterPaymentMethod } from './register-payment-method.entity';
import { CashShift } from './cash-shift.entity';

@Entity('payment_method_balances')
export class PaymentMethodBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  paymentMethodId: string;

  @ManyToOne(() => RegisterPaymentMethod)
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: RegisterPaymentMethod;

  @Column()
  shiftId: string;

  @ManyToOne(() => CashShift)
  @JoinColumn({ name: 'shiftId' })
  shift: CashShift;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  closingBalance: number;

  @CreateDateColumn()
  createdAt: Date;
}
