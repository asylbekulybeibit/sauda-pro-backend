import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from './warehouse.entity';
import { LabelType, LabelSize } from '../dto/products/label-template.dto';

@Entity()
export class LabelTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: LabelType,
    default: LabelType.PRICE_TAG,
  })
  type: LabelType;

  @Column({
    type: 'enum',
    enum: LabelSize,
    default: LabelSize.SMALL,
  })
  size: LabelSize;

  @Column({ type: 'jsonb' })
  template: {
    width: number;
    height: number;
    elements: {
      type: 'text' | 'barcode' | 'qr' | 'image';
      x: number;
      y: number;
      value: string;
      style?: Record<string, any>;
    }[];
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Warehouse)
  warehouse: Warehouse;

  @Column()
  warehouseId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
