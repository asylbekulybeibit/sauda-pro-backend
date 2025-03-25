import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WarehouseProduct } from './warehouse-product.entity';
import { User } from '../../users/entities/user.entity';

export enum PriceType {
  PURCHASE = 'purchase',
  SELLING = 'selling',
}

@Entity()
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  oldPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  newPrice: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: PriceType,
    default: PriceType.SELLING,
  })
  priceType: PriceType;

  @ManyToOne(
    () => WarehouseProduct,
    (warehouseProduct) => warehouseProduct.priceHistory
  )
  warehouseProduct: WarehouseProduct;

  @Column()
  warehouseProductId: string;

  @ManyToOne(() => User)
  changedBy: User;

  @Column()
  changedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
