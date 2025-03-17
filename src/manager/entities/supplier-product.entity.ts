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
import { Product } from './product.entity';

@Entity('supplier_products')
export class SupplierProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  supplierId: string;

  @Column()
  productId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('int', { nullable: true })
  minimumOrder: number;

  @Column({ nullable: true })
  lastDeliveryDate: Date;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
