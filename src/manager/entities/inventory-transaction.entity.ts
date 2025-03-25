import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { User } from '../../users/entities/user.entity';
import { Purchase } from './purchase.entity';

export enum TransactionType {
  PURCHASE = 'PURCHASE', // Приход товара
  SALE = 'SALE', // Продажа
  ADJUSTMENT = 'ADJUSTMENT', // Корректировка (инвентаризация)
  WRITE_OFF = 'WRITE_OFF', // Списание
  TRANSFER = 'TRANSFER', // Перемещение между складами
  RETURN = 'RETURN', // Возврат товара
}

@Entity()
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(
    () => WarehouseProduct,
    (warehouseProduct) => warehouseProduct.inventoryTransactions
  )
  warehouseProduct: WarehouseProduct;

  @Column()
  warehouseProductId: string;

  @ManyToOne(() => Warehouse)
  warehouse: Warehouse;

  @Column()
  warehouseId: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  createdById: string;

  @ManyToOne(() => Purchase, (purchase) => purchase.transactions, {
    nullable: true,
  })
  purchase: Purchase;

  @Column({ nullable: true })
  purchaseId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
