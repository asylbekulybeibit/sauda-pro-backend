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
import { Warehouse } from './warehouse.entity';
import { User } from '../../users/entities/user.entity';
import { Client } from './client.entity';
import { CashShift } from './cash-shift.entity';
import { CashRegister } from './cash-register.entity';
import { CashOperation } from './cash-operation.entity';

export enum ReceiptStatus {
  CREATED = 'created',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  MIXED = 'mixed',
}

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column()
  cashShiftId: string;

  @ManyToOne(() => CashShift, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cashShiftId' })
  cashShift: CashShift;

  @Column()
  cashRegisterId: string;

  @ManyToOne(() => CashRegister, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cashRegisterId' })
  cashRegister: CashRegister;

  @Column()
  cashierId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cashierId' })
  cashier: User;

  @Column({ nullable: true })
  clientId: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  receiptNumber: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.CREATED,
  })
  status: ReceiptStatus;

  @Column({ nullable: true })
  cashOperationId: string;

  @ManyToOne(() => CashOperation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cashOperationId' })
  cashOperation: CashOperation;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @OneToMany('ReceiptItem', 'receipt', {
    cascade: true,
  })
  items: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
