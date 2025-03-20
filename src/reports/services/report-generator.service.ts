import { Injectable, Logger } from '@nestjs/common';
import { Report, ReportFormat } from '../entities/report.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private readonly REPORTS_DIR = 'reports';

  constructor() {
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
    }
  }

  private isCurrencyKey(key: string): boolean {
    const currencyKeywords = [
      'price',
      'cost',
      'amount',
      'total',
      'revenue',
      'profit',
      'margin',
      'value',
      'sum',
      'payment',
      'fee',
      'charge',
      'expense',
      'income',
      'salary',
      'wage',
      'bonus',
      'discount',
      'tax',
      'vat',
      'currency',
      'tenge',
      '₸',
    ];
    return currencyKeywords.some((keyword) =>
      key.toLowerCase().includes(keyword)
    );
  }

  private isDateKey(key: string): boolean {
    const dateKeywords = [
      'date',
      'created',
      'updated',
      'start',
      'end',
      'period',
      'time',
      'timestamp',
      'deadline',
      'expiry',
      'valid',
      'issued',
      'received',
      'delivered',
      'shipped',
    ];
    return dateKeywords.some((keyword) => key.toLowerCase().includes(keyword));
  }

  async generateFile(report: Report): Promise<string> {
    const fileName = this.generateFileName(report);
    const filePath = path.join(this.REPORTS_DIR, fileName);

    try {
      switch (report.format) {
        case ReportFormat.EXCEL:
          await this.generateExcel(report, filePath);
          break;
        case ReportFormat.PDF:
          await this.generatePDF(report, filePath);
          break;
      }

      // Проверяем, что файл был успешно создан
      if (fs.existsSync(filePath)) {
        this.logger.log(`Successfully generated report file: ${filePath}`);
        return filePath;
      } else {
        throw new Error(`Failed to generate report file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate report file: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private generateFileName(report: Report): string {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    let extension = report.format.toLowerCase();

    // Убедимся, что для Excel файлов используется правильное расширение
    if (report.format === ReportFormat.EXCEL) {
      extension = 'xlsx';
    } else if (report.format === ReportFormat.PDF) {
      extension = 'pdf';
    }

    return `report_${report.type}_${dateStr}.${extension}`;
  }

  private async generateExcel(report: Report, filePath: string): Promise<void> {
    this.logger.log(`Generating Excel report: ${filePath}`);

    // Создаем новую книгу Excel
    const workbook = new ExcelJS.Workbook();

    // Добавляем метаданные
    workbook.creator = 'SaudaPro';
    workbook.lastModifiedBy = 'SaudaPro';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Маппинг названий отчетов на русский
    const reportTypeMap = {
      SALES: 'Продажи',
      INVENTORY: 'Инвентарь',
      STAFF: 'Персонал',
      FINANCIAL: 'Финансы',
      CATEGORIES: 'Категории',
      PROMOTIONS: 'Акции',
    };

    // Получаем локализованное название отчета
    const reportName = reportTypeMap[report.type] || report.type;

    // Создаем новый лист
    const worksheet = workbook.addWorksheet(reportName);

    // Функция для форматирования валюты в Excel
    const formatCurrency = (value) => {
      if (typeof value === 'number') {
        // Использовать ru-KZ локаль для тенге
        return `${value.toLocaleString('ru-KZ')} ₸`;
      }
      return value;
    };

    // Функция для форматирования даты
    const formatDate = (dateString) => {
      if (dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
      }
      return dateString;
    };

    // Определяем, связан ли ключ с валютой
    const isCurrencyKey = (key) => {
      return (
        key.toLowerCase().includes('price') ||
        key.toLowerCase().includes('cost') ||
        key.toLowerCase().includes('value') ||
        key.toLowerCase().includes('sum') ||
        key.toLowerCase().includes('total') ||
        key.toLowerCase().includes('revenue') ||
        key.toLowerCase().includes('profit') ||
        key.toLowerCase().includes('amount') ||
        key.toLowerCase().includes('margin') ||
        key.toLowerCase().includes('payment') ||
        key.toLowerCase().includes('fee') ||
        key.toLowerCase().includes('charge') ||
        key.toLowerCase().includes('expense') ||
        key.toLowerCase().includes('income') ||
        key.toLowerCase().includes('salary') ||
        key.toLowerCase().includes('wage') ||
        key.toLowerCase().includes('bonus') ||
        key.toLowerCase().includes('discount') ||
        key.toLowerCase().includes('tax') ||
        key.toLowerCase().includes('vat') ||
        key.toLowerCase().includes('currency') ||
        key.toLowerCase().includes('tenge') ||
        key.toLowerCase().includes('₸')
      );
    };

    // Определяем, связан ли ключ с датой
    const isDateKey = (key) => {
      return (
        key.toLowerCase().includes('date') ||
        key.toLowerCase().includes('created') ||
        key.toLowerCase().includes('updated')
      );
    };

    // Маппинг ключей сводки на русский
    const summaryKeyMap = {
      totalProducts: 'Всего товаров',
      totalValue: 'Общая стоимость',
      averagePrice: 'Средняя цена',
      totalSales: 'Общий объем продаж',
      totalRevenue: 'Общий доход',
      profitMargin: 'Маржа прибыли',
      topCategory: 'Топ категория',
      salesGrowth: 'Рост продаж',
      totalStaff: 'Общее количество персонала',
      activeStaff: 'Активный персонал',
      productCount: 'Количество товаров',
      productsInStock: 'Товаров в наличии',
      lowStockProducts: 'Товаров с низким запасом',
      outOfStockProducts: 'Товаров нет в наличии',
    };

    // Маппинг статусов на русский
    const statusMap: Record<string, string> = {
      OUT_OF_STOCK: 'Нет в наличии',
      LOW_STOCK: 'Мало на складе',
      IN_STOCK: 'В наличии',
    };

    // Устанавливаем заголовок отчета
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `Отчет: ${reportName}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    // Устанавливаем период отчета
    worksheet.mergeCells('A2:D2');
    const periodCell = worksheet.getCell('A2');
    periodCell.value = `Период: ${formatDate(report.startDate)} - ${formatDate(
      report.endDate
    )}`;
    periodCell.font = { size: 12 };
    periodCell.alignment = { horizontal: 'center' };

    // Добавляем секцию сводки
    worksheet.addRow([]);
    const summaryTitleRow = worksheet.addRow(['Сводка']);
    summaryTitleRow.font = { bold: true, size: 14 };

    // Устанавливаем стили для сводки
    worksheet.addRow([]);

    // Создаем таблицу сводки
    let rowIndex = 6;
    let isAlternate = false;

    // Используем реальные данные сводки из отчета
    const summaryData = report.data.summary || {};

    for (const [key, value] of Object.entries(summaryData)) {
      const displayKey = summaryKeyMap[key] || key;
      const row = worksheet.addRow([displayKey, '', '']);

      // Форматируем значение в зависимости от типа
      let displayValue: any = value;
      if (isCurrencyKey(key)) {
        displayValue = formatCurrency(value);
      } else if (this.isDateKey(key)) {
        displayValue = formatDate(value);
      } else if (
        typeof value === 'number' &&
        key.toLowerCase().includes('percent')
      ) {
        displayValue = `${value}%`;
      } else if (
        key.toLowerCase().includes('status') &&
        typeof value === 'string'
      ) {
        displayValue = statusMap[value] || value;
      }

      row.getCell(3).value = displayValue;

      // Добавляем чередующийся цвет строк
      if (isAlternate) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEEEEEE' },
        };
      }

      // Выделяем ячейки и устанавливаем границы
      ['A', 'B', 'C'].forEach((col) => {
        const cell = worksheet.getCell(`${col}${rowIndex}`);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      isAlternate = !isAlternate;
      rowIndex++;
    }

    // Устанавливаем ширину столбцов
    worksheet.getColumn('A').width = 20;
    worksheet.getColumn('B').width = 10;
    worksheet.getColumn('C').width = 20;

    // Добавляем секцию детализации, если есть данные
    const detailsData = report.data.details || [];

    if (detailsData.length > 0) {
      worksheet.addRow([]);
      const detailsTitleRow = worksheet.addRow(['Детализация']);
      detailsTitleRow.font = { bold: true, size: 14 };
      worksheet.addRow([]);

      // Получаем заголовки из первого объекта данных
      const headers = Object.keys(detailsData[0]);

      // Маппинг заголовков на русский язык
      const headerMap = {
        name: 'Название',
        category: 'Категория',
        quantity: 'Количество',
        minQuant: 'Мин. кол-во',
        price: 'Цена',
        value: 'Стоимость',
        status: 'Статус',
        date: 'Дата',
        user: 'Пользователь',
        product: 'Товар',
        sales: 'Продажи',
        revenue: 'Выручка',
        profit: 'Прибыль',
        stock: 'Остаток',
        discount: 'Скидка',
        amount: 'Сумма',
        cashier: 'Кассир',
        phone: 'Телефон',
        email: 'Email',
        address: 'Адрес',
        description: 'Описание',
        comment: 'Комментарий',
      };

      // Заголовки на русском
      const localizedHeaders = headers.map(
        (header) => headerMap[header] || header
      );
      const headersRow = worksheet.addRow(localizedHeaders);
      headersRow.font = { bold: true };
      headersRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDDDDDD' },
        };
      });

      // Добавляем данные детализации
      detailsData.forEach((detail, index) => {
        const rowValues = headers.map((header) => {
          const value = detail[header];
          if (
            this.isCurrencyKey(header) &&
            (typeof value === 'number' || !isNaN(Number(value)))
          ) {
            return formatCurrency(value);
          } else if (this.isDateKey(header) && value) {
            return formatDate(value);
          }
          return value;
        });

        const row = worksheet.addRow(rowValues);

        // Чередующиеся цвета строк
        if (index % 2 === 1) {
          row.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFEEEEEE' },
            };
          });
        }

        // Границы ячеек
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });
    }

    // Добавляем дату создания отчета в футер
    worksheet.addRow([]);
    worksheet.addRow([]);
    const footerRow = worksheet.addRow([
      `Отчет сгенерирован: ${new Date().toLocaleDateString('ru-RU')}`,
    ]);
    footerRow.font = { italic: true };

    // Сохраняем файл
    await workbook.xlsx.writeFile(filePath);

    // Проверяем, что файл был создан
    if (!fs.existsSync(filePath)) {
      throw new Error(`Failed to create Excel file: ${filePath}`);
    }
  }

  private async generatePDF(report: Report, filePath: string): Promise<void> {
    this.logger.log(`Generating PDF report: ${filePath}`);

    // Маппинг названий отчетов на русский
    const reportTypeMap = {
      SALES: 'Продажи',
      INVENTORY: 'Инвентарь',
      STAFF: 'Персонал',
      FINANCIAL: 'Финансы',
      CATEGORIES: 'Категории',
      PROMOTIONS: 'Акции',
    };

    // Получаем локализованное название отчета
    const reportName = reportTypeMap[report.type] || report.type;

    // Создаем документ PDF с поддержкой кириллицы
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      info: {
        Title: `Отчет: ${reportName}`,
        Author: 'SaudaPro',
        Subject: `Отчет по ${reportName.toLowerCase()}`,
        Keywords: 'отчет, sauda, pro',
        Producer: 'SaudaPro Reporting System',
        CreationDate: new Date(),
      },
      lang: 'ru',
    });

    // Регистрируем шрифты для корректного отображения кириллицы
    try {
      doc.registerFont('DejaVuSans', 'fonts/DejaVuSans.ttf');
      doc.registerFont('DejaVuSans-Bold', 'fonts/DejaVuSans-Bold.ttf');
      doc.registerFont('DejaVuSans-Oblique', 'fonts/DejaVuSans-Oblique.ttf');
      doc.registerFont(
        'DejaVuSans-BoldOblique',
        'fonts/DejaVuSans-BoldOblique.ttf'
      );
    } catch (e) {
      this.logger.warn(
        'Не удалось загрузить шрифты DejaVu. Используются стандартные шрифты.',
        e
      );
    }

    // Создаем поток записи
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Ширина страницы (учитывая отступы)
    const pageWidth = doc.page.width - 80; // Отступы 40 слева и справа

    // Функция для форматирования валюты в PDF
    const formatCurrency = (value) => {
      if (typeof value === 'number') {
        // Использовать ru-KZ локаль для тенге
        return `${value.toLocaleString('ru-KZ')} ₸`;
      }
      return value;
    };

    // Функция для форматирования даты
    const formatDate = (dateString) => {
      if (dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
      }
      return dateString;
    };

    // Маппинг ключей сводки на русский
    const summaryKeyMap = {
      totalProducts: 'Всего товаров',
      totalValue: 'Общая стоимость',
      averagePrice: 'Средняя цена',
      totalSales: 'Общий объем продаж',
      totalRevenue: 'Общий доход',
      profitMargin: 'Маржа прибыли',
      topCategory: 'Топ категория',
      salesGrowth: 'Рост продаж',
      totalStaff: 'Общее количество персонала',
      activeStaff: 'Активный персонал',
      productCount: 'Количество товаров',
      productsInStock: 'Товаров в наличии',
      lowStockProducts: 'Товаров с низким запасом',
      outOfStockProducts: 'Товаров нет в наличии',
    };

    // Маппинг статусов на русский
    const statusMap: Record<string, string> = {
      OUT_OF_STOCK: 'Нет в наличии',
      LOW_STOCK: 'Мало на складе',
      IN_STOCK: 'В наличии',
    };

    // Маппинг заголовков на русский язык
    const headerMap = {
      name: 'Название',
      category: 'Категория',
      quantity: 'Количество',
      minQuant: 'Мин. кол-во',
      price: 'Цена',
      value: 'Стоимость',
      status: 'Статус',
      date: 'Дата',
      user: 'Пользователь',
      product: 'Товар',
      sales: 'Продажи',
      revenue: 'Выручка',
      profit: 'Прибыль',
      stock: 'Остаток',
      discount: 'Скидка',
      amount: 'Сумма',
      cashier: 'Кассир',
      phone: 'Телефон',
      email: 'Email',
      address: 'Адрес',
      description: 'Описание',
      comment: 'Комментарий',
    };

    // Заголовок отчета
    doc
      .fontSize(18)
      .font('DejaVuSans-Bold')
      .text(`Отчет: ${reportName}`, { align: 'center' });

    doc
      .moveDown()
      .fontSize(12)
      .font('DejaVuSans')
      .text(
        `Период: ${formatDate(report.startDate)} - ${formatDate(
          report.endDate
        )}`,
        { align: 'center' }
      );

    doc.moveDown().moveDown();

    // Используем реальные данные сводки из отчета
    const summaryData = report.data.summary || {};

    // Секция сводки
    doc.fontSize(16).font('DejaVuSans-Bold').text('Сводка', { align: 'left' });

    doc.moveDown();

    // Таблица сводки
    let yPos = doc.y;
    const rowHeight = 25;
    let isAlternate = false;

    // Проверяем, достаточно ли места на странице для таблицы сводки
    if (
      yPos + Object.keys(summaryData).length * rowHeight >
      doc.page.height - 100
    ) {
      doc.addPage();
      yPos = doc.y;
    }

    for (const [key, value] of Object.entries(summaryData)) {
      const displayKey = summaryKeyMap[key] || key;

      // Форматируем значение в зависимости от типа
      let displayValue: any = value;
      if (this.isCurrencyKey(key)) {
        displayValue = formatCurrency(value);
      } else if (this.isDateKey(key)) {
        displayValue = formatDate(value);
      } else if (
        typeof value === 'number' &&
        key.toLowerCase().includes('percent')
      ) {
        displayValue = `${value}%`;
      } else if (
        key.toLowerCase().includes('status') &&
        typeof value === 'string'
      ) {
        displayValue = statusMap[value] || value;
      }

      // Рисуем фон для строки
      if (isAlternate) {
        doc.rect(40, yPos, pageWidth, rowHeight).fill('#eeeeee');
      }

      // Рисуем границы ячеек
      doc.rect(40, yPos, pageWidth * 0.6, rowHeight).stroke();
      doc.rect(40 + pageWidth * 0.6, yPos, pageWidth * 0.4, rowHeight).stroke();

      // Добавляем текст
      doc
        .font('DejaVuSans')
        .fontSize(11)
        .text(displayKey, 45, yPos + 7, { width: pageWidth * 0.6 - 10 });

      doc.text(displayValue.toString(), 45 + pageWidth * 0.6, yPos + 7, {
        width: pageWidth * 0.4 - 10,
        align: 'right',
      });

      yPos += rowHeight;
      isAlternate = !isAlternate;

      // Проверяем, достаточно ли места для следующей строки
      if (yPos + rowHeight > doc.page.height - 100) {
        doc.addPage();
        yPos = 50;
      }
    }

    doc.moveDown().moveDown();

    // Используем реальные данные детализации из отчета
    const detailsData = report.data.details || [];

    // Проверяем наличие данных для детализации
    if (detailsData.length > 0) {
      // Проверяем, достаточно ли места для секции детализации
      if (doc.y + 150 > doc.page.height - 100) {
        doc.addPage();
      }

      // Секция детализации
      doc
        .fontSize(14)
        .font('DejaVuSans-Bold')
        .text('Детализация', { align: 'left' });

      doc.moveDown();

      // Получаем заголовки из первого объекта данных
      const headers = Object.keys(detailsData[0]);

      // Ширины столбцов таблицы - адаптируем для помещения на страницу
      // Динамически распределяем ширину в зависимости от количества столбцов
      let colWidths = [];
      const totalCols = headers.length;

      if (totalCols <= 4) {
        // Для таблиц с небольшим количеством столбцов
        headers.forEach((header) => {
          // Проверяем, является ли столбец широким (название/описание)
          if (
            header.toLowerCase().includes('name') ||
            header.toLowerCase().includes('description') ||
            header.toLowerCase().includes('comment')
          ) {
            colWidths.push(pageWidth * 0.4);
          } else if (this.isCurrencyKey(header)) {
            colWidths.push(pageWidth * 0.2);
          } else {
            colWidths.push(pageWidth * 0.2);
          }
        });
      } else {
        // Для таблиц с большим количеством столбцов
        // Устанавливаем разные ширины в зависимости от типа столбца
        headers.forEach((header) => {
          if (header.toLowerCase().includes('name')) {
            colWidths.push(pageWidth * 0.25); // Больше места для названий
          } else if (
            header.toLowerCase().includes('category') ||
            header.toLowerCase().includes('description') ||
            header.toLowerCase().includes('comment')
          ) {
            colWidths.push(pageWidth * 0.2); // Средне для категорий и описаний
          } else if (
            this.isCurrencyKey(header) ||
            header.toLowerCase().includes('quantity') ||
            header.toLowerCase().includes('status')
          ) {
            colWidths.push(pageWidth * 0.15); // Меньше для цен и количеств
          } else {
            colWidths.push(pageWidth * 0.1); // Минимум для прочих столбцов
          }
        });

        // Корректируем колонки, если их общая ширина превышает pageWidth
        const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
        if (totalWidth > pageWidth) {
          const factor = pageWidth / totalWidth;
          colWidths = colWidths.map((width) => width * factor);
        }
      }

      // Заголовки столбцов
      yPos = doc.y;

      // Рисуем фон для заголовков
      doc.rect(40, yPos, pageWidth, rowHeight).fill('#dddddd');

      // Рисуем границы ячеек заголовков
      let xPos = 40;
      colWidths.forEach((width) => {
        doc.rect(xPos, yPos, width, rowHeight).stroke();
        xPos += width;
      });

      // Добавляем текст заголовков
      xPos = 40;
      headers.forEach((header, i) => {
        const displayHeader = headerMap[header] || header;
        doc
          .font('DejaVuSans-Bold')
          .fontSize(10) // Уменьшаем шрифт заголовков для лучшего размещения
          .text(displayHeader, xPos + 3, yPos + 7, {
            width: colWidths[i] - 6,
            align: 'center',
          });

        xPos += colWidths[i];
      });

      yPos += rowHeight;

      // Добавляем данные детализации
      detailsData.forEach((detail, index) => {
        // Проверяем, достаточно ли места для строки
        if (yPos + rowHeight > doc.page.height - 100) {
          doc.addPage();
          yPos = 50;

          // Повторяем заголовки таблицы на новой странице
          doc.rect(40, yPos, pageWidth, rowHeight).fill('#dddddd');

          xPos = 40;
          colWidths.forEach((width) => {
            doc.rect(xPos, yPos, width, rowHeight).stroke();
            xPos += width;
          });

          xPos = 40;
          headers.forEach((header, i) => {
            const displayHeader = headerMap[header] || header;
            doc
              .font('DejaVuSans-Bold')
              .fontSize(10) // Уменьшаем шрифт заголовков для лучшего размещения
              .text(displayHeader, xPos + 3, yPos + 7, {
                width: colWidths[i] - 6,
                align: 'center',
              });

            xPos += colWidths[i];
          });

          yPos += rowHeight;
        }

        // Рисуем фон для строки детализации
        if (index % 2 === 1) {
          doc.rect(40, yPos, pageWidth, rowHeight).fill('#eeeeee');
        }

        // Рисуем границы ячеек
        xPos = 40;
        colWidths.forEach((width) => {
          doc.rect(xPos, yPos, width, rowHeight).stroke();
          xPos += width;
        });

        // Добавляем текст
        xPos = 40;
        headers.forEach((header, i) => {
          let value = detail[header];

          // Форматируем значение в зависимости от типа
          let cellValue = '';
          if (
            this.isCurrencyKey(header) &&
            (typeof value === 'number' || !isNaN(Number(value)))
          ) {
            cellValue = formatCurrency(value);
          } else if (this.isDateKey(header) && value) {
            cellValue = formatDate(value);
          } else if (header === 'status' && typeof value === 'string') {
            cellValue = statusMap[value] || value;
          }

          doc
            .font('DejaVuSans')
            .fontSize(9) // Уменьшаем размер шрифта для содержимого
            .text(
              cellValue !== null && cellValue !== undefined
                ? String(cellValue)
                : '-',
              xPos + 3, // Меньший отступ
              yPos + 7,
              {
                width: colWidths[i] - 6,
                align:
                  header === 'name' || header === 'category'
                    ? 'left'
                    : 'center',
              }
            );

          xPos += colWidths[i];
        });

        yPos += rowHeight;
      });
    }

    // Добавляем дату создания отчета в футер
    const footerY = doc.page.height - 50;
    doc
      .font('DejaVuSans-Oblique')
      .fontSize(10)
      .text(
        `Отчет сгенерирован: ${new Date().toLocaleDateString('ru-RU')}`,
        40,
        footerY
      );

    // Добавляем номер страницы
    const pageRange = doc.bufferedPageRange();
    const totalPages = pageRange.count;

    if (totalPages > 1) {
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc
          .font('DejaVuSans')
          .fontSize(10)
          .text(`Страница ${i + 1} из ${totalPages}`, pageWidth, footerY, {
            align: 'right',
          });
      }
    } else {
      doc
        .font('DejaVuSans')
        .fontSize(10)
        .text(`Страница 1 из 1`, pageWidth, footerY, {
          align: 'right',
        });
    }

    // Закрываем документ и сохраняем файл
    doc.end();

    // Ждем завершения записи в файл
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        if (fs.existsSync(filePath)) {
          resolve();
        } else {
          reject(new Error(`Failed to create PDF file: ${filePath}`));
        }
      });
      stream.on('error', reject);
    });
  }
}
