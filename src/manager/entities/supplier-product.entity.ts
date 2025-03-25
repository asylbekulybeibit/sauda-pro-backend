import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { Barcode } from './barcode.entity';

@Entity('supplier_products')
export class SupplierProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  supplierId: string;

  @Column()
  barcodeId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('int', { nullable: true })
  minimumOrder: number;

  @Column({ nullable: true })
  lastDeliveryDate: Date;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => Barcode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'barcodeId' })
  barcode: Barcode;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
