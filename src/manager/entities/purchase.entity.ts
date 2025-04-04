import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { User } from '../../users/entities/user.entity';
import { Supplier } from './supplier.entity';
import { InventoryTransaction } from './inventory-transaction.entity';

export enum PurchaseStatus {
  DRAFT = 'draft',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse)
  warehouse: Warehouse;

  @Column({ nullable: true })
  supplierId: string;

  @ManyToOne(() => Supplier)
  supplier: Supplier;

  @Column({ nullable: true })
  invoiceNumber: string;

  @Column('timestamp')
  date: Date;

  @Column({
    type: 'enum',
    enum: PurchaseStatus,
    default: PurchaseStatus.COMPLETED,
  })
  status: PurchaseStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  remainingAmount: number;

  @Column('int', { default: 0 })
  totalItems: number;

  @Column({ nullable: true })
  comment: string;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  createdBy: User;

  @OneToMany(() => InventoryTransaction, (transaction) => transaction.purchase)
  transactions: InventoryTransaction[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
