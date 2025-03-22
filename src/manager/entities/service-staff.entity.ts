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

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assignedAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  startedWork: Date;

  @Column({ nullable: true, type: 'timestamp' })
  completedWork: Date;

  @CreateDateColumn()
  createdAt: Date;
}
