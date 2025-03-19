import { Injectable, Logger } from '@nestjs/common';
import { Report, ReportFormat } from '../entities/report.entity';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private readonly REPORTS_DIR = 'reports';
  private readonly FONTS_PATH = path.join(process.cwd(), 'dist', 'fonts');

  constructor() {
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
    }

    // Копируем шрифты в папку dist при инициализации
    this.copyFontsToDistFolder();
  }

  private copyFontsToDistFolder() {
    const fs = require('fs');
    const sourceFontsPath = path.join(process.cwd(), 'backend/fonts');

    try {
      // Проверяем наличие исходной папки со шрифтами
      if (!fs.existsSync(sourceFontsPath)) {
        this.logger.error('Source fonts folder not found:', sourceFontsPath);
        return;
      }

      // Создаем папку dist/fonts, если её нет
      if (!fs.existsSync(this.FONTS_PATH)) {
        fs.mkdirSync(this.FONTS_PATH, { recursive: true });
      }

      // Копируем файлы шрифтов
      ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].forEach((fontFile) => {
        const sourceFile = path.join(sourceFontsPath, fontFile);
        const targetFile = path.join(this.FONTS_PATH, fontFile);

        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, targetFile);
          this.logger.log(`Font file copied: ${fontFile}`);
        } else {
          this.logger.error(`Font file not found: ${sourceFile}`);
        }
      });
    } catch (error) {
      this.logger.error('Error copying fonts:', error);
    }
  }

  private async registerFonts(doc: PDFKit.PDFDocument) {
    try {
      // Регистрируем шрифты
      doc.registerFont(
        'DejaVuSans',
        path.join(this.FONTS_PATH, 'DejaVuSans.ttf')
      );
      doc.registerFont(
        'DejaVuSans-Bold',
        path.join(this.FONTS_PATH, 'DejaVuSans-Bold.ttf')
      );

      // Устанавливаем шрифт по умолчанию
      doc.font('DejaVuSans');
    } catch (error) {
      this.logger.error('Error registering fonts:', error);
      // В случае ошибки используем встроенный шрифт
      doc.font('Helvetica');
    }
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
        case ReportFormat.CSV:
          await this.generateCSV(report, filePath);
          break;
      }

      return filePath;
    } catch (error) {
      this.logger.error(
        `Failed to generate report file: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private generateFileName(report: Report): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = report.format.toLowerCase();
    return `${report.type}_${report.shopId}_${timestamp}.${extension}`;
  }

  private async generateExcel(report: Report, filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Add summary section
    worksheet.addRow(['Summary']);
    Object.entries(report.data.summary).forEach(([key, value]) => {
      worksheet.addRow([key, value]);
    });

    worksheet.addRow([]);

    // Add details section
    if (report.data.details && report.data.details.length > 0) {
      worksheet.addRow(['Details']);
      const headers = Object.keys(report.data.details[0]);
      worksheet.addRow(headers);
      report.data.details.forEach((detail) => {
        worksheet.addRow(Object.values(detail));
      });
    }

    // Add charts section if exists
    if (report.data.charts) {
      worksheet.addRow([]);
      worksheet.addRow(['Charts']);
      Object.entries(report.data.charts).forEach(([chartName, chartData]) => {
        worksheet.addRow([chartName]);
        Object.entries(chartData).forEach(([key, value]) => {
          worksheet.addRow([key, value]);
        });
        worksheet.addRow([]);
      });
    }

    await workbook.xlsx.writeFile(filePath);
  }

  private async generatePDF(report: Report, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        lang: 'ru',
      });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Регистрируем шрифты и устанавливаем DejaVu по умолчанию
      this.registerFonts(doc);

      // Устанавливаем кодировку UTF-8 и метаданные
      doc.info.Producer = 'SaudaPro Reports';
      doc.info.Creator = 'SaudaPro';

      // Функция для форматирования денежных значений
      const formatCurrency = (value: any): string => {
        if (typeof value !== 'number') {
          if (!isNaN(Number(value))) {
            value = Number(value);
          } else {
            return String(value);
          }
        }
        return new Intl.NumberFormat('ru-KZ', {
          style: 'currency',
          currency: 'KZT',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      };

      // Функция для форматирования дат
      const formatDate = (dateString: string): string => {
        try {
          const date = new Date(dateString);
          if (isNaN(date.getTime())) return dateString;

          return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(date);
        } catch (error) {
          return dateString;
        }
      };

      // Функция для определения, является ли значение денежным
      const isCurrencyKey = (key: string): boolean => {
        const currencyKeys = [
          'price',
          'value',
          'total',
          'amount',
          'revenue',
          'profit',
          'costs',
          'balance',
          'totalValue',
          'averageValue',
        ];
        return currencyKeys.some((ck) =>
          key.toLowerCase().includes(ck.toLowerCase())
        );
      };

      // Функция для определения, является ли значение датой
      const isDateKey = (key: string): boolean => {
        const dateKeys = [
          'date',
          'createdAt',
          'updatedAt',
          'startDate',
          'endDate',
        ];
        return dateKeys.some((dk) =>
          key.toLowerCase().includes(dk.toLowerCase())
        );
      };

      // Локализация типа отчета
      const reportTypeToRu = {
        SALES: 'ПРОДАЖИ',
        INVENTORY: 'ИНВЕНТАРЬ',
        STAFF: 'ПЕРСОНАЛ',
        FINANCIAL: 'ФИНАНСЫ',
        CATEGORIES: 'КАТЕГОРИИ',
        PROMOTIONS: 'АКЦИИ',
      };

      // Добавляем заголовок с типом отчета
      const reportTitle = reportTypeToRu[report.type] || report.type;
      doc.fontSize(16).text(reportTitle, { align: 'center' });
      doc.moveDown();

      // Добавление информации о периоде отчета
      const startDate = report.startDate
        ? formatDate(report.startDate.toString())
        : '';
      const endDate = report.endDate
        ? formatDate(report.endDate.toString())
        : '';
      if (startDate && endDate) {
        doc
          .fontSize(12)
          .text(`Период: ${startDate} - ${endDate}`, { align: 'center' });
        doc.moveDown();
      }

      // Добавляем раздел с итоговыми показателями
      doc.fontSize(14).font('DejaVuSans-Bold').text('Сводка');
      doc.moveDown();
      doc.font('DejaVuSans');

      // Локализация ключей сводки
      const summaryKeyToRu = {
        totalProducts: 'Всего товаров',
        lowStockProducts: 'Мало на складе',
        outOfStockProducts: 'Отсутствует на складе',
        totalValue: 'Общая стоимость',
        totalSales: 'Общие продажи',
        totalOrders: 'Всего заказов',
        averageOrderValue: 'Средний чек',
        uniqueProducts: 'Уникальных товаров',
        totalItems: 'Всего позиций',
        totalStaff: 'Всего сотрудников',
        totalPromotions: 'Всего акций',
        activePromotions: 'Активные акции',
        revenue: 'Выручка',
        costs: 'Затраты',
        profit: 'Прибыль',
        profitMargin: 'Маржа прибыли',
      };

      // Создаем таблицу для итоговых показателей
      const summaryTableWidth = 400;
      const summaryTableX = (doc.page.width - summaryTableWidth) / 2;
      let summaryTableY = doc.y;

      Object.entries(report.data.summary).forEach(([key, value], index) => {
        const localizedKey = summaryKeyToRu[key] || key;
        let formattedValue = value;

        // Форматируем значение в зависимости от типа
        if (isCurrencyKey(key)) {
          formattedValue = formatCurrency(value);
        } else if (isDateKey(key)) {
          formattedValue = formatDate(String(value));
        } else if (
          key.toLowerCase().includes('margin') ||
          key.toLowerCase().includes('percentage')
        ) {
          formattedValue = `${Number(value).toFixed(2)}%`;
        }

        // Четные и нечетные строки разными цветами для лучшей читаемости
        const bgColor = index % 2 === 0 ? '#f9f9f9' : '#ffffff';

        // Рисуем ячейку с ключом
        doc
          .rect(summaryTableX, summaryTableY, 200, 20)
          .fillAndStroke(bgColor, '#dddddd');
        doc
          .fillColor('#000000')
          .fontSize(10)
          .text(localizedKey, summaryTableX + 5, summaryTableY + 5, {
            width: 190,
            height: 20,
          });

        // Рисуем ячейку со значением
        doc
          .rect(summaryTableX + 200, summaryTableY, 200, 20)
          .fillAndStroke(bgColor, '#dddddd');
        doc
          .fillColor('#000000')
          .fontSize(10)
          .text(
            String(formattedValue),
            summaryTableX + 205,
            summaryTableY + 5,
            {
              width: 190,
              height: 20,
              align: isCurrencyKey(key) ? 'right' : 'left',
            }
          );

        summaryTableY += 20;
      });

      doc.moveDown(2);

      // Добавляем раздел с детализацией
      if (report.data.details && report.data.details.length > 0) {
        doc.fontSize(14).font('DejaVuSans-Bold').text('Детализация');
        doc.moveDown();
        doc.font('DejaVuSans');

        // Локализация заголовков столбцов
        const headersKeyToRu = {
          name: 'Наименование',
          category: 'Категория',
          quantity: 'Количество',
          price: 'Цена',
          value: 'Стоимость',
          status: 'Статус',
          date: 'Дата',
          product: 'Товар',
          total: 'Сумма',
          method: 'Способ оплаты',
          type: 'Тип',
          description: 'Описание',
          comment: 'Комментарий',
        };

        const headers = Object.keys(report.data.details[0]);
        const localizedHeaders = headers.map((h) => headersKeyToRu[h] || h);

        // Определяем ширину каждой колонки
        const tableWidth = 500;
        const colWidths = headers.map((header) => {
          // Для длинных заголовков даем больше места
          if (
            ['name', 'description', 'product', 'comment'].includes(
              header.toLowerCase()
            )
          ) {
            return 150;
          }
          // Для денежных значений чуть меньше
          else if (isCurrencyKey(header)) {
            return 80;
          }
          // Для дат
          else if (isDateKey(header)) {
            return 100;
          }
          // Для остальных
          else {
            return 70;
          }
        });

        // Ограничиваем количество записей для предотвращения слишком больших PDF
        const maxRecords = 50;
        const limitedDetails = report.data.details.slice(0, maxRecords);

        // Рисуем заголовки таблицы
        let tableX = 50;
        let tableY = doc.y;
        let currentX = tableX;

        // Рисуем фон заголовков
        doc.rect(tableX, tableY, tableWidth, 20).fill('#f2f2f2');

        // Рисуем заголовки
        headers.forEach((header, index) => {
          const width = colWidths[index];
          doc
            .font('DejaVuSans-Bold')
            .fontSize(10)
            .fillColor('#000000')
            .text(localizedHeaders[index], currentX + 5, tableY + 5, {
              width: width - 10,
              height: 20,
            });
          currentX += width;
        });

        tableY += 20;

        // Рисуем детали
        limitedDetails.forEach((detail, rowIndex) => {
          currentX = tableX;

          // Чередование цветов строк
          const rowColor = rowIndex % 2 === 0 ? '#ffffff' : '#f9f9f9';
          doc.rect(tableX, tableY, tableWidth, 20).fill(rowColor);

          // Заполняем ячейки данными
          headers.forEach((header, colIndex) => {
            const width = colWidths[colIndex];
            let value = detail[header];

            // Форматируем значение в зависимости от типа
            if (isCurrencyKey(header)) {
              value = formatCurrency(value);
            } else if (isDateKey(header)) {
              value = formatDate(String(value));
            }

            doc
              .font('DejaVuSans')
              .fontSize(9)
              .fillColor('#000000')
              .text(String(value || ''), currentX + 5, tableY + 5, {
                width: width - 10,
                height: 20,
                align: isCurrencyKey(header) ? 'right' : 'left',
              });
            currentX += width;
          });

          tableY += 20;

          // Если таблица достигла конца страницы, добавляем новую страницу
          if (tableY > doc.page.height - 50) {
            doc.addPage();
            tableY = 50;
          }
        });

        // Если были ограничены записи, добавляем сообщение
        if (report.data.details.length > maxRecords) {
          doc
            .moveDown()
            .font('DejaVuSans-Bold')
            .fontSize(10)
            .text(
              `Показано ${maxRecords} записей из ${report.data.details.length}. Используйте Excel или CSV формат для полного отчета.`,
              {
                align: 'center',
              }
            );
        }

        doc.moveDown(2);
      }

      // Добавляем раздел с графиками и диаграммами
      if (report.data.charts) {
        doc.fontSize(14).font('DejaVuSans-Bold').text('Графики');
        doc.moveDown();
        doc.font('DejaVuSans');

        // Локализация названий графиков
        const chartNameToRu = {
          salesByProduct: 'Продажи по товарам',
          salesByDate: 'Продажи по датам',
          stockByCategory: 'Запасы по категориям',
          transactionsByType: 'Транзакции по типам',
          salesByCategory: 'Продажи по категориям',
          salesByPromotion: 'Продажи по акциям',
          expensesByCategory: 'Расходы по категориям',
        };

        Object.entries(report.data.charts).forEach(([chartName, chartData]) => {
          const localizedChartName = chartNameToRu[chartName] || chartName;
          doc.fontSize(12).font('DejaVuSans-Bold').text(localizedChartName);
          doc.moveDown();
          doc.font('DejaVuSans');

          // Создаем простую таблицу для данных графика
          let chartTableY = doc.y;
          const chartTableX = 100;
          const chartTableWidth = 400;

          let chartEntries = Object.entries(chartData);
          // Сортируем записи по значению (по убыванию)
          chartEntries.sort((a, b) => Number(b[1]) - Number(a[1]));

          // Ограничиваем количество записей для графика
          chartEntries = chartEntries.slice(0, 10);

          chartEntries.forEach(([key, value], index) => {
            const rowColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';

            // Рисуем ячейку с ключом
            doc
              .rect(chartTableX, chartTableY, 200, 20)
              .fillAndStroke(rowColor, '#dddddd');
            doc
              .fillColor('#000000')
              .fontSize(10)
              .text(key, chartTableX + 5, chartTableY + 5, {
                width: 190,
                height: 20,
              });

            // Рисуем ячейку со значением
            doc
              .rect(chartTableX + 200, chartTableY, 100, 20)
              .fillAndStroke(rowColor, '#dddddd');

            // Форматируем значение если это денежное
            let formattedValue = value;
            if (isCurrencyKey(chartName)) {
              formattedValue = formatCurrency(value);
            }

            doc
              .fillColor('#000000')
              .fontSize(10)
              .text(
                String(formattedValue),
                chartTableX + 205,
                chartTableY + 5,
                {
                  width: 90,
                  height: 20,
                  align: 'right',
                }
              );

            // Рисуем графический индикатор (полоску) для визуализации
            const maxBarWidth = 100;
            const maxValue = Math.max(
              ...chartEntries.map((entry) => Number(entry[1]))
            );
            let barWidth = (Number(value) / maxValue) * maxBarWidth;
            if (isNaN(barWidth)) barWidth = 0;

            doc
              .rect(chartTableX + 300, chartTableY + 5, barWidth, 10)
              .fill(
                index % 3 === 0
                  ? '#4a7ebb'
                  : index % 3 === 1
                  ? '#6bbd63'
                  : '#e05e3d'
              );

            chartTableY += 20;
          });

          doc.moveDown(2);
        });
      }

      // Добавляем нижний колонтитул с датой создания
      const currentDate = new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      doc
        .fontSize(8)
        .text(`Отчет сгенерирован: ${currentDate}`, 50, doc.page.height - 50, {
          align: 'center',
        });

      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
  }

  private async generateCSV(report: Report, filePath: string): Promise<void> {
    const lines: string[] = [];

    // Add summary section
    lines.push('Summary');
    Object.entries(report.data.summary).forEach(([key, value]) => {
      lines.push(`${key},${value}`);
    });
    lines.push('');

    // Add details section
    if (report.data.details && report.data.details.length > 0) {
      lines.push('Details');
      const headers = Object.keys(report.data.details[0]);
      lines.push(headers.join(','));
      report.data.details.forEach((detail) => {
        lines.push(Object.values(detail).join(','));
      });
      lines.push('');
    }

    // Add charts section
    if (report.data.charts) {
      lines.push('Charts');
      Object.entries(report.data.charts).forEach(([chartName, chartData]) => {
        lines.push(chartName);
        Object.entries(chartData).forEach(([key, value]) => {
          lines.push(`${key},${value}`);
        });
        lines.push('');
      });
    }

    await fs.promises.writeFile(filePath, lines.join('\n'));
  }
}
