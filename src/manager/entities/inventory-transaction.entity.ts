import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { User } from '../../users/entities/user.entity';

export enum TransactionType {
  PURCHASE = 'PURCHASE', // Приход товара
  SALE = 'SALE', // Продажа
  ADJUSTMENT = 'ADJUSTMENT', // Корректировка (инвентаризация)
  WRITE_OFF = 'WRITE_OFF', // Списание
  TRANSFER = 'TRANSFER', // Перемещение между магазинами
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

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Product)
  product: Product;

  @Column()
  productId: string;

  @ManyToOne(() => Shop)
  shop: Shop;

  @Column()
  shopId: string;

  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
