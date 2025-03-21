import { Purchase, PurchaseStatus } from '../entities/purchase.entity';
import { User } from '../../users/entities/user.entity';

export interface PurchaseWithItems
  extends Omit<Purchase, 'items' | 'createdBy'> {
  items: Array<{
    productId: string;
    product: {
      name: string;
      sku: string;
    };
    quantity: number;
    price: number;
    total: number;
    serialNumber?: string;
    expiryDate?: string;
    comment?: string;
  }>;
  createdBy?: User;
}
