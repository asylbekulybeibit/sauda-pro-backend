import { Injectable } from '@nestjs/common';

interface LowStockNotification {
  productName: string;
  currentQuantity: number;
  minQuantity: number;
}

@Injectable()
export class WhatsappService {
  async sendLowStockNotification(data: LowStockNotification) {
    try {
      console.log(
        '[WhatsappService] Отправка уведомления о низком количестве товара:',
        {
          productName: data.productName,
          currentQuantity: data.currentQuantity,
          minQuantity: data.minQuantity,
        }
      );

      // TODO: Реализовать отправку через WhatsApp API
      // Здесь будет код для отправки уведомления через WhatsApp

      return true;
    } catch (error) {
      console.error(
        '[WhatsappService] Ошибка при отправке уведомления:',
        error
      );
      throw error;
    }
  }
}
