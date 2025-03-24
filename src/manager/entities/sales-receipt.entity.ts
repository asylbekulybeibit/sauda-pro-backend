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
import { User } from '../../users/entities/user.entity';
import { CashShift } from './cash-shift.entity';
import { Client } from './client.entity';
import { CashOperation } from './cash-operation.entity';

export enum SalesReceiptStatus {
  CREATED = 'created',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('sales_receipts')
export class SalesReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  cashShiftId: string;

  @ManyToOne(() => CashShift, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cashShiftId' })
  cashShift: CashShift;

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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalAmount: number;

  @Column()
  paymentMethod: string;

  @Column()
  receiptNumber: string;

  @Column({
    type: 'enum',
    enum: SalesReceiptStatus,
    default: SalesReceiptStatus.CREATED,
  })
  status: SalesReceiptStatus;

  @Column({ nullable: true })
  cashOperationId: string;

  @ManyToOne(() => CashOperation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cashOperationId' })
  cashOperation: CashOperation;

  @OneToMany('SalesReceiptItem', 'salesReceipt')
  items: any[];

  @CreateDateColumn()
  createdAt: Date;
}
