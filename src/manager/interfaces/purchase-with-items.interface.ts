import { Purchase } from '../entities/purchase.entity';

export interface PurchaseWithItems extends Purchase {
  items: Array<{
    productId: string;
    product: {
      name: string;
      sku: string;
    };
    quantity: number;
    price: number;
    total: number;
    serialNumber?: any;
    expiryDate?: any;
    comment?: string;
  }>;
}
