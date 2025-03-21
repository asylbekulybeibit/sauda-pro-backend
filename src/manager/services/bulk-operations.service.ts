import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Injectable()
export class BulkOperationsService {
  async generateTemplate(type: string): Promise<Buffer> {
    if (type !== 'products') {
      throw new BadRequestException('Unsupported template type');
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Define template headers and example data
    const headers = [
      'name',
      'sku',
      'price',
      'quantity',
      'category',
      'description',
    ];

    const exampleData = [
      {
        name: 'Пример товара',
        sku: 'SKU123',
        price: '1000',
        quantity: '10',
        category: 'Категория',
        description: 'Описание товара',
      },
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exampleData, {
      header: headers,
    });

    // Add column widths
    const colWidths = [
      { wch: 30 }, // name
      { wch: 15 }, // sku
      { wch: 10 }, // price
      { wch: 10 }, // quantity
      { wch: 20 }, // category
      { wch: 40 }, // description
    ];
    ws['!cols'] = colWidths;

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Товары');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }
}
