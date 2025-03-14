import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { Category } from './category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  sku: string;

  @Column('decimal', { precision: 10, scale: 2 })
  sellingPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  purchasePrice: number;

  @Column('int')
  quantity: number;

  @Column('int', { default: 0 })
  minQuantity: number;

  @Column({ nullable: true })
  categoryId: string;

  @Column()
  shopId: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'jsonb', nullable: true })
  barcodes: string[]; // Массив штрих-кодов для разных фасовок

  @Column({ type: 'jsonb', nullable: true })
  labels: {
    type: string; // Тип этикетки (ценник, этикетка со штрих-кодом и т.д.)
    template: string; // Шаблон для печати
    data: Record<string, any>; // Дополнительные данные для печати
  }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
