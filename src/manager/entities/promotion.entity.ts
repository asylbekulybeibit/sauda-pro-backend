import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from './warehouse.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { Barcode } from './barcode.entity';

export enum PromotionType {
  PERCENTAGE = 'percentage', // Скидка в процентах
  FIXED = 'fixed', // Фиксированная скидка
  SPECIAL_PRICE = 'special_price', // Специальная цена
}

export enum PromotionTarget {
  PRODUCT = 'product', // Скидка на конкретный товар
  CATEGORY = 'category', // Скидка на категорию
  CART = 'cart', // Скидка на корзину
}

@Entity()
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PromotionType,
    default: PromotionType.PERCENTAGE,
  })
  type: PromotionType;

  @Column({
    type: 'enum',
    enum: PromotionTarget,
    default: PromotionTarget.PRODUCT,
  })
  target: PromotionTarget;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number; // Значение скидки (процент или сумма)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minCartAmount: number; // Минимальная сумма корзины

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  discount: number;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => WarehouseProduct)
  @JoinTable()
  products: WarehouseProduct[];

  @ManyToMany(() => Category)
  @JoinTable()
  categories: Category[];

  @ManyToMany(() => Barcode)
  @JoinTable()
  barcodes: Barcode[];

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column()
  warehouseId: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
