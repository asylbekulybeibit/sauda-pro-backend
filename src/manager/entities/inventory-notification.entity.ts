import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { NotificationRule } from './notification-rule.entity';
import { WarehouseProduct } from './warehouse-product.entity';
import { Warehouse } from './warehouse.entity';

@Entity('inventory_notifications')
export class InventoryNotification extends NotificationRule {
  @ManyToOne(() => WarehouseProduct)
  @JoinColumn({ name: 'warehouseProductId' })
  warehouseProduct: WarehouseProduct;

  @Column()
  warehouseProductId: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column()
  warehouseId: string;

  @Column('int')
  minQuantity: number;

  constructor() {
    super();
    this.type = 'inventory';
  }
}
