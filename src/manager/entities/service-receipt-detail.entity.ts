import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { User } from '../../users/entities/user.entity';
import { ServiceReceipt } from './service-receipt.entity';

@Entity('service_receipt_details')
export class ServiceReceiptDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  serviceReceiptId: string;

  @ManyToOne(() => ServiceReceipt, (receipt) => receipt.details, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serviceReceiptId' })
  serviceReceipt: ServiceReceipt;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  staffId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'staffId' })
  staff: User;

  @Column({ nullable: true })
  role: string;

  @CreateDateColumn()
  createdAt: Date;
}
