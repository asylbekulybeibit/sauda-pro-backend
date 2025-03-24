import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { CashRegister } from './cash-register.entity';
import { CashShift } from './cash-shift.entity';
import { Order } from './order.entity';
import { User } from '../../users/entities/user.entity';

export enum CashOperationType {
  SALE = 'sale',
  RETURN = 'return',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  SERVICE = 'service',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
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

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @ManyToOne(() => CashRegister, (register) => register.operations)
  cashRegister: CashRegister;

  @Column()
  cashRegisterId: string;

  @ManyToOne(() => CashShift, (shift) => shift.operations)
  shift: CashShift;

  @Column()
  shiftId: string;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @Column({ nullable: true })
  userId: string;

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

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
