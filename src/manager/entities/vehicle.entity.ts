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

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, 'vehicles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  make: string;

  @Column()
  model: string;

  @Column({ nullable: true })
  year: number;

  @Column()
  bodyType: string;

  @Column({ type: 'decimal', precision: 3, scale: 1 })
  engineVolume: number;

  @Column()
  licensePlate: string;

  @Column({ nullable: true })
  vin: string;

  @OneToMany('Service', 'vehicle')
  services: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
