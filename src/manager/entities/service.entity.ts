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
import { ServiceType } from './service-type.entity';
import { Client } from './client.entity';
import { Vehicle } from './vehicle.entity';
import { User } from '../../users/entities/user.entity';

export enum ServiceStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  serviceTypeId: string;

  @ManyToOne(() => ServiceType, 'services', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serviceTypeId' })
  serviceType: ServiceType;

  @Column()
  clientId: string;

  @ManyToOne(() => Client, 'services', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  vehicleId: string;

  @ManyToOne(() => Vehicle, 'services', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.PENDING,
  })
  status: ServiceStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  originalPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ nullable: true, type: 'timestamp' })
  startTime: Date;

  @Column({ nullable: true, type: 'timestamp' })
  endTime: Date;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column()
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column({ nullable: true })
  startedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'startedBy' })
  starter: User;

  @Column({ nullable: true })
  completedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'completedBy' })
  completer: User;

  @Column({ nullable: true })
  cashierId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cashierId' })
  cashier: User;

  @OneToMany('ServiceStaff', 'service')
  serviceStaff: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
