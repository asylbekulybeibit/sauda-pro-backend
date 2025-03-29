import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Barcode } from './barcode.entity';
import { Warehouse } from './warehouse.entity';
import { PriceHistory } from './price-history.entity';
import { InventoryTransaction } from './inventory-transaction.entity';

@Entity('warehouse_products')
export class WarehouseProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  barcodeId: string;

  @ManyToOne(() => Barcode, (barcode) => barcode.warehouseProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'barcodeId' })
  barcode: Barcode;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.warehouseProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  purchasePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minQuantity: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isService: boolean;

  @OneToMany(
    () => PriceHistory,
    (priceHistory) => priceHistory.warehouseProduct
  )
  priceHistory: PriceHistory[];

  @OneToMany(
    () => InventoryTransaction,
    (transaction) => transaction.warehouseProduct
  )
  inventoryTransactions: InventoryTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
