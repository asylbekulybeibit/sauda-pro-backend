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
import { Category } from './category.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { Shop } from '../../shops/entities/shop.entity';

@Entity('barcodes')
export class Barcode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  productName: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  shopId: string;

  @Column({ default: false })
  isService: boolean;

  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @OneToMany(
    () => WarehouseProduct,
    (warehouseProduct) => warehouseProduct.barcode
  )
  warehouseProducts: WarehouseProduct[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
