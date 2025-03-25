import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { User } from '../../users/entities/user.entity';
import { Warehouse } from '../../manager/entities/warehouse.entity';

export enum ReportType {
  // Operational reports
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  STAFF = 'STAFF',
  CATEGORIES = 'CATEGORIES',
  PROMOTIONS = 'PROMOTIONS',

  // Financial reports
  FINANCIAL = 'FINANCIAL',

  // Summary reports
  WAREHOUSE_SUMMARY = 'WAREHOUSE_SUMMARY',
  NETWORK_SUMMARY = 'NETWORK_SUMMARY',
}

export enum ReportPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
}

@Entity()
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ReportType,
  })
  type: ReportType;

  @Column({
    type: 'enum',
    enum: ReportPeriod,
  })
  period: ReportPeriod;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ReportFormat,
    default: ReportFormat.PDF,
  })
  format: ReportFormat;

  @Column({ type: 'jsonb' })
  filters: {
    categories?: string[];
    products?: string[];
    staff?: string[];
    promotions?: string[];
    minAmount?: number;
    maxAmount?: number;
    [key: string]: any;
  };

  @Column({ type: 'jsonb' })
  data: {
    summary?: {
      total: number;
      average: number;
      growth: number;
      [key: string]: any;
    };
    details: any[];
    charts?: {
      type: string;
      data: any;
      [key: string]: any;
    }[];
    [key: string]: any;
  };

  @Column({ nullable: true })
  fileUrl: string;

  @ManyToOne(() => Shop, { nullable: true })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column({ nullable: true })
  shopId: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column()
  warehouseId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: true })
  isActive: boolean;
}
