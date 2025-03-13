import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../../roles/entities/user-role.entity';
import { Product } from '../../manager/entities/product.entity';
import { InventoryTransaction } from '../../manager/entities/inventory-transaction.entity';

export enum ShopType {
  SHOP = 'shop',
  WAREHOUSE = 'warehouse',
  POINT_OF_SALE = 'point_of_sale',
}

@Entity('shops')
export class Shop {
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

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: ShopType,
    default: ShopType.SHOP,
  })
  type: ShopType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.shop)
  userRoles: UserRole[];

  @OneToMany(() => Product, (product) => product.shop)
  products: Product[];

  @OneToMany(() => InventoryTransaction, (transaction) => transaction.shop)
  transactions: InventoryTransaction[];
}
