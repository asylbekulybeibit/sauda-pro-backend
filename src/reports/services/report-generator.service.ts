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

  constructor() {
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR, { recursive: true });
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
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Add title
      doc.fontSize(16).text(report.type, { align: 'center' });
      doc.moveDown();

      // Add summary section
      doc.fontSize(14).text('Summary');
      doc.moveDown();
      Object.entries(report.data.summary).forEach(([key, value]) => {
        doc.fontSize(12).text(`${key}: ${value}`);
      });
      doc.moveDown();

      // Add details section
      if (report.data.details && report.data.details.length > 0) {
        doc.fontSize(14).text('Details');
        doc.moveDown();

        const headers = Object.keys(report.data.details[0]);
        doc.fontSize(12).text(headers.join(', '));
        doc.moveDown();

        report.data.details.forEach((detail) => {
          doc.text(Object.values(detail).join(', '));
        });
        doc.moveDown();
      }

      // Add charts section
      if (report.data.charts) {
        doc.fontSize(14).text('Charts');
        doc.moveDown();

        Object.entries(report.data.charts).forEach(([chartName, chartData]) => {
          doc.fontSize(12).text(chartName);
          doc.moveDown();
          Object.entries(chartData).forEach(([key, value]) => {
            doc.text(`${key}: ${value}`);
          });
          doc.moveDown();
        });
      }

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
