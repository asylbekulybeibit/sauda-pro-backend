import { Purchase } from '../entities/purchase.entity';
import { PurchaseItem } from '../entities/purchase-item.entity';

export interface PurchaseWithItems extends Omit<Purchase, 'items'> {
  items: Array<
    Partial<PurchaseItem> & {
      product: {
        name: string;
        sku: string;
      };
      total: number;
    }
  >;
}
