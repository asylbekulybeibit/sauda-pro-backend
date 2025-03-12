import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { Category } from './category.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int', nullable: true })
  minQuantity: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  barcode: string;

  @Column({ type: 'jsonb', nullable: true })
  barcodes: string[]; // Массив штрих-кодов для разных фасовок

  @Column({ type: 'jsonb', nullable: true })
  labels: {
    type: string; // Тип этикетки (ценник, этикетка со штрих-кодом и т.д.)
    template: string; // Шаблон для печати
    data: Record<string, any>; // Дополнительные данные для печати
  }[];

  @ManyToOne(() => Shop)
  shop: Shop;

  @Column()
  shopId: string;

  @ManyToOne(() => Category)
  category: Category;

  @Column({ nullable: true })
  categoryId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
