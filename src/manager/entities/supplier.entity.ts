import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';

@Entity()
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'jsonb', nullable: true })
  contacts: {
    name: string;
    position: string;
    phone: string;
    email?: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  paymentInfo: {
    type: string; // Тип оплаты (нал, безнал и т.д.)
    bankDetails?: string;
    terms?: string; // Условия оплаты
  };

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Shop)
  shop: Shop;

  @Column()
  shopId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
