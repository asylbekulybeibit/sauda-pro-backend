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
import { Service } from './service.entity';
import { CashShift } from './cash-shift.entity';
import { CashOperation } from './cash-operation.entity';

export enum ServiceReceiptStatus {
  CREATED = 'created',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('service_receipts')
export class ServiceReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

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
    enum: ServiceReceiptStatus,
    default: ServiceReceiptStatus.CREATED,
  })
  status: ServiceReceiptStatus;

  @Column({ nullable: true })
  cashOperationId: string;

  @ManyToOne(() => CashOperation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cashOperationId' })
  cashOperation: CashOperation;

  @OneToMany('ServiceReceiptDetail', 'serviceReceipt')
  details: any[];

  @CreateDateColumn()
  createdAt: Date;
}
