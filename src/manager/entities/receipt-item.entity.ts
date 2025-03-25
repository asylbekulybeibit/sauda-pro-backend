import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WarehouseProduct } from './warehouse-product.entity';
import { Service } from './service.entity';

export enum ReceiptItemType {
  PRODUCT = 'product',
  SERVICE = 'service',
}

@Entity('receipt_items')
export class ReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  receiptId: string;

  @ManyToOne('Receipt', 'items', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receiptId' })
  receipt: any;

  @Column({
    type: 'enum',
    enum: ReceiptItemType,
  })
  type: ReceiptItemType;

  @Column({ nullable: true })
  warehouseProductId: string;

  @ManyToOne(() => WarehouseProduct, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'warehouseProductId' })
  warehouseProduct: WarehouseProduct;

  @Column({ nullable: true })
  serviceId: string;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // В будущем эти поля будут использоваться для скидок на уровне товара
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalAmount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
