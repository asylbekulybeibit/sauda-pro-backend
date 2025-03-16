import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { CashRegister } from './cash-register.entity';
import { CashShift } from './cash-shift.entity';
import { Order } from './order.entity';

export enum CashOperationType {
  SALE = 'sale',
  RETURN = 'return',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

export enum PaymentMethodType {
  CASH = 'cash',
  CARD = 'card',
  QR = 'qr',
}

@Entity('cash_operations')
export class CashOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CashRegister, (register) => register.operations)
  cashRegister: CashRegister;

  @Column()
  cashRegisterId: string;

  @ManyToOne(() => CashShift, (shift) => shift.operations)
  shift: CashShift;

  @Column()
  shiftId: string;

  @ManyToOne(() => Order, { nullable: true })
  order: Order;

  @Column({ nullable: true })
  orderId: string;

  @Column({
    type: 'enum',
    enum: CashOperationType,
  })
  operationType: CashOperationType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
  })
  paymentMethod: PaymentMethodType;

  @CreateDateColumn()
  createdAt: Date;
}
