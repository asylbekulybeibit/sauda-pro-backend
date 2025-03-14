import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transfer } from './transfer.entity';
import { Product } from './product.entity';

@Entity('transfer_items')
export class TransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  transferId: string;

  @Column()
  productId: string;

  @Column('int')
  quantity: number;

  @Column({ nullable: true })
  comment?: string;

  @ManyToOne(() => Transfer, (transfer) => transfer.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transferId' })
  transfer: Transfer;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;
}
