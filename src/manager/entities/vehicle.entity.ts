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
import { Client } from './client.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { Warehouse } from './warehouse.entity';

/**
 * Vehicles are currently associated with the entire shop,
 * but this entity includes warehouseId for future warehouse-specific vehicles.
 */
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  clientId: string;

  @ManyToOne(() => Client, 'vehicles', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'clientId' })
  client: Client;

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
  make: string;

  @Column({ nullable: true })
  model: string;

  @Column({ nullable: true })
  year: number;

  @Column()
  bodyType: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  engineVolume: number;

  @Column()
  licensePlate: string;

  @Column({ nullable: true })
  vin: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany('Service', 'vehicle')
  services: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
