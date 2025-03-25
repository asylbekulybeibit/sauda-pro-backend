import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Transfer } from './transfer.entity';
import { WarehouseProduct } from './warehouse-product.entity';

@Entity('transfer_items')
export class TransferItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  transferId: string;

  @Column()
  warehouseProductId: string;

  @Column('int')
  quantity: number;

  @Column({ nullable: true })
  comment?: string;

  @ManyToOne(() => Transfer, (transfer) => transfer.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transferId' })
  transfer: Transfer;

  @ManyToOne(() => WarehouseProduct)
  @JoinColumn({ name: 'warehouseProductId' })
  warehouseProduct: WarehouseProduct;
}
