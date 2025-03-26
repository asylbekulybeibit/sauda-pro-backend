import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Barcode } from './barcode.entity';
import { Warehouse } from './warehouse.entity';

@Entity('warehouse_services')
export class WarehouseService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  barcodeId: string;

  @ManyToOne(() => Barcode)
  @JoinColumn({ name: 'barcodeId' })
  barcode: Barcode;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.warehouseServices)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
