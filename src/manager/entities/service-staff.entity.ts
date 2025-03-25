import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Service } from './service.entity';
import { Staff } from './staff.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { Warehouse } from './warehouse.entity';

@Entity('service_staff')
export class ServiceStaff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  serviceId: string;

  @ManyToOne(() => Service, 'serviceStaff', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column()
  staffId: string;

  @ManyToOne(() => Staff, 'serviceStaff', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'staffId' })
  staff: Staff;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assignedAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  startedWork: Date;

  @Column({ nullable: true, type: 'timestamp' })
  completedWork: Date;

  @CreateDateColumn()
  createdAt: Date;
}
