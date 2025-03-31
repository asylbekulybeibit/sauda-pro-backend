import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { Purchase } from './purchase.entity';
import { User } from '../../users/entities/user.entity';

export enum DebtType {
  PAYABLE = 'payable', // Мы должны (кредиторская задолженность)
  RECEIVABLE = 'receivable', // Нам должны (дебиторская задолженность)
}

export enum DebtStatus {
  ACTIVE = 'active',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Entity('debts')
export class Debt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: DebtType,
    default: DebtType.PAYABLE,
  })
  type: DebtType;

  @Column({
    type: 'enum',
    enum: DebtStatus,
    default: DebtStatus.ACTIVE,
  })
  status: DebtStatus;

  @Column()
  warehouseId: string;

  @Column({ nullable: true })
  supplierId: string;

  @ManyToOne(() => Supplier)
  supplier: Supplier;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column('decimal', { precision: 10, scale: 2 })
  remainingAmount: number;

  @Column({ nullable: true })
  dueDate: Date;

  @Column({ nullable: true })
  purchaseId: string;

  @ManyToOne(() => Purchase)
  purchase: Purchase;

  @Column({ nullable: true })
  comment: string;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
