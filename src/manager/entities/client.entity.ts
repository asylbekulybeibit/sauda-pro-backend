import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { Warehouse } from './warehouse.entity';

/**
 * Clients are currently associated with the entire shop,
 * but this entity includes warehouseId for future warehouse-specific clients.
 */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column({ nullable: true })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ default: false })
  isWarehouseSpecific: boolean;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany('Service', 'client')
  services: any[];

  @OneToMany('Vehicle', 'client')
  vehicles: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
