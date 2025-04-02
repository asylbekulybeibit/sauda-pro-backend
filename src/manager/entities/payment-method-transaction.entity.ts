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
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
  SALE = 'sale',
  REFUND = 'refund',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  PURCHASE = 'purchase',
  ADJUSTMENT = 'adjustment',
  RETURN_WITHOUT_RECEIPT = 'return_without_receipt',
}

export enum ReferenceType {
  SALE = 'sale',
  REFUND = 'refund',
  PURCHASE = 'purchase',
  SHIFT = 'shift',
  MANUAL = 'manual',
}

@Entity('payment_method_transactions')
export class PaymentMethodTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  paymentMethodId: string;

  @ManyToOne(() => RegisterPaymentMethod, (method) => method.transactions)
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: RegisterPaymentMethod;

  @Column({ nullable: true })
  shiftId: string;

  @ManyToOne(() => CashShift, { nullable: true })
  @JoinColumn({ name: 'shiftId' })
  shift: CashShift;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceBefore: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({
    type: 'enum',
    enum: ReferenceType,
    nullable: true,
  })
  referenceType: ReferenceType;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ nullable: true, type: 'text' })
  note: string;

  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
