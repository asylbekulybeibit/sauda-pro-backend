import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WarehouseProduct } from './warehouse-product.entity';
import { CashRegister } from './cash-register.entity';
import { Shop } from '../../shops/entities/shop.entity';
import { WarehouseService } from './warehouse-service.entity';

@Entity('warehouses')
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: false })
  isMain: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  shopId: string;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @OneToMany(
    () => WarehouseProduct,
    (warehouseProduct) => warehouseProduct.warehouse
  )
  warehouseProducts: WarehouseProduct[];

  @OneToMany(
    () => WarehouseService,
    (warehouseService) => warehouseService.warehouse
  )
  warehouseServices: WarehouseService[];

  @OneToMany(() => CashRegister, (cashRegister) => cashRegister.warehouse)
  cashRegisters: CashRegister[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
