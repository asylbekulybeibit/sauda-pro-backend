import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { CashRegister } from './cash-register.entity';
import { CashShift } from './cash-shift.entity';
import { User } from '../../users/entities/user.entity';
import { Receipt } from './receipt.entity';
import { RegisterPaymentMethod } from './register-payment-method.entity';
import { CashOperationType, PaymentMethodType } from '../enums/common.enums';

@Entity('cash_operations')
export class CashOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  warehouseId: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @ManyToOne(() => CashRegister, (register) => register.operations)
  @JoinColumn({ name: 'cashRegisterId' })
  cashRegister: CashRegister;

  @Column()
  cashRegisterId: string;

  @ManyToOne(() => CashShift, (shift) => shift.operations)
  @JoinColumn({ name: 'shiftId' })
  shift: CashShift;

  @Column()
  shiftId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => Receipt, { nullable: true })
  @JoinColumn({ name: 'receiptId' })
  receipt: Receipt;

  @Column({ nullable: true })
  receiptId: string;

  @Column({
    type: 'enum',
    enum: CashOperationType,
  })
  operationType: CashOperationType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  paymentMethodId: string;

  @ManyToOne(() => RegisterPaymentMethod, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod: RegisterPaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
  })
  paymentMethodType: PaymentMethodType;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
