import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { Barcode } from './barcode.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Shop)
  shop: Shop;

  @Column()
  shopId: string;

  @ManyToOne(() => Category, { nullable: true })
  parent: Category;

  @Column({ nullable: true })
  parentId: string;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany(() => Barcode, (barcode) => barcode.category)
  barcodes: Barcode[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
