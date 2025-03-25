import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { WarehouseProduct } from '../entities/warehouse-product.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { LabelTemplate } from '../entities/label-template.entity';
import { GenerateLabelsDto } from '../dto/products/generate-labels.dto';
import { CreateTemplateDto } from '../dto/products/create-template.dto';
import {
  LabelTemplateDto,
  LabelType,
  LabelSize,
} from '../dto/products/label-template.dto';
import { createCanvas } from 'canvas';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import * as path from 'path';

@Injectable()
export class LabelsService {
  private templates: Map<string, LabelTemplateDto> = new Map();
  private readonly FONTS_PATH = path.join(process.cwd(), 'dist', 'fonts');

  constructor(
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(LabelTemplate)
    private readonly templateRepository: Repository<LabelTemplate>
  ) {
    // Инициализируем базовые шрифты и шаблоны
    this.initializeDefaultTemplates();
    this.copyFontsToDistFolder();
  }

  private copyFontsToDistFolder() {
    const fs = require('fs');
    const sourceFontsPath = path.join(process.cwd(), 'fonts');

    try {
      // Проверяем наличие исходной папки со шрифтами
      if (!fs.existsSync(sourceFontsPath)) {
        console.error('Source fonts folder not found:', sourceFontsPath);
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
          console.log(`Font file copied: ${fontFile}`);
        } else {
          console.error(`Font file not found: ${sourceFile}`);
        }
      });
    } catch (error) {
      console.error('Error copying fonts:', error);
    }
  }

  private async registerFonts(doc: typeof PDFDocument) {
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
      console.error('Error registering fonts:', error);
      // В случае ошибки используем встроенный шрифт Times-Roman
      doc.font('Times-Roman');
    }
  }

  private async validateManagerAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: { userId, warehouseId, type: RoleType.MANAGER, isActive: true },
    });

    if (!hasAccess) {
      throw new BadRequestException('No access to this warehouse');
    }
  }

  private initializeDefaultTemplates(): void {
    // Шаблон простого ценника
    const priceTagTemplate: LabelTemplateDto = {
      name: 'Стандартный ценник',
      type: LabelType.PRICE_TAG,
      size: LabelSize.SMALL,
      template: {
        width: 58,
        height: 40,
        elements: [
          {
            type: 'text',
            x: 2,
            y: 2,
            value: '{{name}}',
            style: { fontSize: 10, bold: true },
          },
          {
            type: 'text',
            x: 2,
            y: 12,
            value: 'Цена: {{price}} ₸',
            style: { fontSize: 14, bold: true },
          },
          {
            type: 'barcode',
            x: 2,
            y: 22,
            value: '{{barcodes[0]}}',
            style: { width: 54, height: 12 },
          },
        ],
      },
    };

    // Полный ценник с QR-кодом
    const fullPriceTagTemplate: LabelTemplateDto = {
      name: 'Полный ценник',
      type: LabelType.PRICE_TAG,
      size: LabelSize.MEDIUM,
      template: {
        width: 58,
        height: 60,
        elements: [
          // Название товара
          {
            type: 'text',
            x: 2,
            y: 2,
            value: '{{name}}',
            style: { fontSize: 10, bold: true },
          },
          // Категория
          {
            type: 'text',
            x: 2,
            y: 12,
            value: 'Категория: {{category}}',
            style: { fontSize: 8 },
          },
          // QR-код по центру
          {
            type: 'qr',
            x: 17,
            y: 22,
            value: 'https://shop.example.com/product/{{barcodes[0]}}',
            style: { width: 24, height: 24 },
          },
          // Цена крупно под QR-кодом
          {
            type: 'text',
            x: 2,
            y: 44,
            value: 'Цена: {{price}} ₸',
            style: { fontSize: 14, bold: true },
          },
        ],
      },
    };

    // Информационная этикетка
    const infoLabelTemplate: LabelTemplateDto = {
      name: 'Информационная этикетка',
      type: LabelType.INFO,
      size: LabelSize.MEDIUM,
      template: {
        width: 58,
        height: 60,
        elements: [
          // Заголовок
          {
            type: 'text',
            x: 2,
            y: 2,
            value: '{{name}}',
            style: { fontSize: 12, bold: true },
          },
          // QR-код по центру
          {
            type: 'qr',
            x: 17,
            y: 16,
            value: 'https://shop.example.com/info/{{barcodes[0]}}',
            style: { width: 24, height: 24 },
          },
          // Описание под QR-кодом
          {
            type: 'text',
            x: 2,
            y: 42,
            value: 'Описание: {{description}}',
            style: { fontSize: 8 },
          },
          // Категория
          {
            type: 'text',
            x: 2,
            y: 52,
            value: 'Категория: {{category}}',
            style: { fontSize: 8 },
          },
        ],
      },
    };

    // Полочный ценник
    const shelfLabelTemplate: LabelTemplateDto = {
      name: 'Полочный ценник',
      type: LabelType.SHELF,
      size: LabelSize.LARGE,
      template: {
        width: 58,
        height: 80,
        elements: [
          // Название товара крупно
          {
            type: 'text',
            x: 2,
            y: 2,
            value: '{{name}}',
            style: { fontSize: 14, bold: true },
          },
          // QR-код по центру
          {
            type: 'qr',
            x: 17,
            y: 16,
            value: 'https://shop.example.com/product/{{barcodes[0]}}',
            style: { width: 24, height: 24 },
          },
          // Категория
          {
            type: 'text',
            x: 2,
            y: 42,
            value: 'Категория: {{category}}',
            style: { fontSize: 10 },
          },
          // Цена очень крупно
          {
            type: 'text',
            x: 2,
            y: 54,
            value: 'Цена: {{price}} ₸',
            style: { fontSize: 18, bold: true },
          },
          // Штрих-код внизу
          {
            type: 'barcode',
            x: 2,
            y: 65,
            value: '{{barcodes[0]}}',
            style: { width: 54, height: 12 },
          },
        ],
      },
    };

    this.templates.set('price-tag-default', priceTagTemplate);
    this.templates.set('price-tag-full', fullPriceTagTemplate);
    this.templates.set('info-label', infoLabelTemplate);
    this.templates.set('shelf-label', shelfLabelTemplate);
  }

  async createTemplate(
    userId: string,
    createTemplateDto: CreateTemplateDto
  ): Promise<LabelTemplate> {
    await this.validateManagerAccess(userId, createTemplateDto.warehouseId);

    const template = this.templateRepository.create(createTemplateDto);
    return this.templateRepository.save(template);
  }

  async findTemplates(
    userId: string,
    warehouseId: string
  ): Promise<LabelTemplate[]> {
    await this.validateManagerAccess(userId, warehouseId);

    return this.templateRepository.find({
      where: { warehouseId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findTemplate(
    userId: string,
    warehouseId: string,
    id: string
  ): Promise<LabelTemplate> {
    await this.validateManagerAccess(userId, warehouseId);

    const template = await this.templateRepository.findOne({
      where: { id, warehouseId, isActive: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async updateTemplate(
    userId: string,
    id: string,
    updateTemplateDto: Partial<LabelTemplate>
  ): Promise<LabelTemplate> {
    // Проверяем доступ менеджера
    await this.validateManagerAccess(userId, updateTemplateDto.warehouseId);

    // Находим существующий шаблон
    const template = await this.templateRepository.findOne({
      where: { id, warehouseId: updateTemplateDto.warehouseId, isActive: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Обновляем поля шаблона
    Object.assign(template, updateTemplateDto);

    // Сохраняем обновленный шаблон
    return this.templateRepository.save(template);
  }

  async deleteTemplate(
    userId: string,
    warehouseId: string,
    id: string
  ): Promise<void> {
    await this.validateManagerAccess(userId, warehouseId);

    const template = await this.findTemplate(userId, warehouseId, id);
    template.isActive = false;
    await this.templateRepository.save(template);
  }

  private calculateEAN13Checksum(code: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10;
  }

  private validateEAN13(barcode: string): boolean {
    // Проверяем длину
    if (!barcode || barcode.length !== 13) {
      return false;
    }

    // Проверяем, что все символы - цифры
    if (!/^\d{13}$/.test(barcode)) {
      return false;
    }

    // Проверяем контрольную сумму
    const checksum = this.calculateEAN13Checksum(barcode);
    return checksum === parseInt(barcode[12]);
  }

  private async generateBarcode(
    type: 'ean13' | 'qr',
    value: string,
    options?: any,
    templateWidth?: number
  ): Promise<Buffer> {
    // Проверяем, что значение не пустое
    if (!value) {
      value = type === 'qr' ? 'https://shop.example.com' : '0000000000000';
    }

    // Для EAN-13 проводим валидацию
    if (type === 'ean13') {
      if (!this.validateEAN13(value)) {
        console.warn(`Invalid EAN-13 barcode: ${value}, using default`);
        value = '4600000000000';
        const checksum = this.calculateEAN13Checksum(value);
        value = value.slice(0, -1) + checksum;
      }
    }

    return new Promise((resolve, reject) => {
      // Рассчитываем масштаб на основе ширины шаблона
      const baseWidth = 58; // Базовая ширина шаблона
      const scale = templateWidth ? templateWidth / baseWidth : 1;

      // Рассчитываем размер QR-кода в зависимости от размера этикетки
      const qrSize = templateWidth ? Math.min(templateWidth * 0.4, 25) : 20; // 40% от ширины этикетки, но не больше 25мм

      const defaultOptions =
        type === 'ean13'
          ? {
              bcid: 'ean13',
              text: value,
              scale: 2 * scale,
              height: 8 * scale,
              includetext: true,
              textxalign: 'center',
              width: 1.5 * scale,
              includecheck: true,
              guardwhitespace: true,
              guardwidth: 3,
            }
          : {
              bcid: 'qrcode',
              text: value,
              scale: 1 * scale,
              height: qrSize,
              width: qrSize,
              padding: 0,
              eclevel: 'M',
            };

      bwipjs.toBuffer(
        {
          ...defaultOptions,
          ...options,
        },
        (err, png) => {
          if (err) {
            console.error(
              'Error generating barcode:',
              err,
              'Type:',
              type,
              'Value:',
              value
            );
            reject(err);
          } else {
            resolve(png);
          }
        }
      );
    });
  }

  private replaceVariables(text: string, product: WarehouseProduct): string {
    if (!text) return '';

    return text
      .replace('{{name}}', product.barcode?.productName || '')
      .replace('{{price}}', (product.sellingPrice || 0).toString())
      .replace('{{barcodes[0]}}', product.barcode?.code || '')
      .replace('{{category}}', product.barcode?.category?.name || '')
      .replace('{{description}}', product.barcode?.description || '');
  }

  private async generatePDF(
    product: WarehouseProduct,
    template: LabelTemplate
  ): Promise<Buffer> {
    return new Promise(async (resolve) => {
      const doc = new PDFDocument({
        size: [template.template.width * 2.83, template.template.height * 2.83],
        margin: 0,
        lang: 'ru',
      });

      await this.registerFonts(doc);

      // Устанавливаем кодировку UTF-8
      doc.info.Producer = 'SaudaPro Labels';
      doc.info.Creator = 'SaudaPro';

      const buffers: any[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      for (const element of template.template.elements) {
        switch (element.type) {
          case 'text':
            doc
              .font(element.style?.bold ? 'DejaVuSans-Bold' : 'DejaVuSans')
              .fontSize(element.style?.fontSize || 12)
              .text(
                this.replaceVariables(element.value, product),
                element.x * 2.83,
                element.y * 2.83,
                {
                  lineBreak: false,
                  width: element.style?.width
                    ? element.style.width * 2.83
                    : undefined,
                  align: element.style?.align || 'left',
                }
              );
            break;
          case 'barcode':
            if (product.barcode?.code) {
              const barcodeBuffer = await this.generateBarcode(
                'ean13',
                product.barcode.code,
                element.style,
                template.template.width
              );
              doc.image(barcodeBuffer, element.x * 2.83, element.y * 2.83);
            }
            break;
          case 'qr':
            const qrBuffer = await this.generateBarcode(
              'qr',
              this.replaceVariables(element.value, product),
              element.style,
              template.template.width
            );
            doc.image(qrBuffer, element.x * 2.83, element.y * 2.83);
            break;
        }
      }

      doc.end();
    });
  }

  async generateBatchLabels(
    userId: string,
    warehouseId: string,
    generateLabelsDto: GenerateLabelsDto
  ): Promise<Buffer> {
    await this.validateManagerAccess(userId, warehouseId);

    const template = await this.templateRepository.findOne({
      where: { id: generateLabelsDto.templateId, warehouseId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const productIds = generateLabelsDto.products.map((p) => p.productId);
    const products = await this.warehouseProductRepository.find({
      where: {
        id: In(productIds),
        warehouseId,
        isActive: true,
      },
      relations: ['barcode', 'barcode.category'],
    });

    if (products.length !== generateLabelsDto.products.length) {
      throw new BadRequestException('Some products not found');
    }

    return new Promise(async (resolve) => {
      const pageWidth = 595.28; // A4 ширина в точках (72 DPI)
      const pageHeight = 841.89; // A4 высота в точках

      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: true,
        lang: 'ru',
      });

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

      // Устанавливаем кодировку UTF-8
      doc.info.Producer = 'SaudaPro Labels';
      doc.info.Creator = 'SaudaPro';

      const buffers: any[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let x = 10;
      let y = 10;
      const labelWidth = template.template.width * 2.83;
      const labelHeight = template.template.height * 2.83;

      for (const productData of generateLabelsDto.products) {
        const product = products.find((p) => p.id === productData.productId);
        if (!product) continue;

        for (let i = 0; i < productData.quantity; i++) {
          if (x + labelWidth > pageWidth - 10) {
            x = 10;
            y += labelHeight + 10;
          }

          if (y + labelHeight > pageHeight - 10) {
            doc.addPage();
            x = 10;
            y = 10;
          }

          doc.rect(x, y, labelWidth, labelHeight).stroke();

          for (const element of template.template.elements) {
            const posX = x + element.x * 2.83;
            const posY = y + element.y * 2.83;

            switch (element.type) {
              case 'text':
                doc
                  .font(element.style?.bold ? 'DejaVuSans-Bold' : 'DejaVuSans')
                  .fontSize(element.style?.fontSize || 12)
                  .text(
                    this.replaceVariables(element.value, product),
                    posX,
                    posY,
                    {
                      lineBreak: false,
                      width: element.style?.width
                        ? element.style.width * 2.83
                        : undefined,
                      align: element.style?.align || 'left',
                    }
                  );
                break;
              case 'barcode':
                if (product.barcode?.code) {
                  try {
                    const barcodeBuffer = await this.generateBarcode(
                      'ean13',
                      product.barcode.code,
                      element.style,
                      template.template.width
                    );
                    doc.image(barcodeBuffer, posX, posY);
                  } catch (error) {
                    console.error('Error generating barcode:', error);
                  }
                }
                break;
              case 'qr':
                try {
                  const qrBuffer = await this.generateBarcode(
                    'qr',
                    this.replaceVariables(element.value, product),
                    element.style,
                    template.template.width
                  );
                  doc.image(qrBuffer, posX, posY);
                } catch (error) {
                  console.error('Error generating QR code:', error);
                }
                break;
            }
          }

          x += labelWidth + 10;
        }
      }

      doc.end();
    });
  }

  async validateBarcode(barcode: string): Promise<boolean> {
    if (!barcode || barcode.length < 8) {
      return false;
    }

    // Проверка EAN-13
    if (barcode.length === 13) {
      return this.validateEAN13(barcode);
    }

    // Для других форматов можно добавить дополнительные проверки
    return true;
  }

  async findProductByBarcode(
    userId: string,
    warehouseId: string,
    barcode: string
  ): Promise<WarehouseProduct> {
    await this.validateManagerAccess(userId, warehouseId);

    const product = await this.warehouseProductRepository.findOne({
      where: {
        warehouseId,
        isActive: true,
        barcode: {
          code: Like(`%${barcode}%`),
        },
      },
      relations: ['barcode', 'barcode.category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async generatePreview(
    userId: string,
    warehouseId: string,
    productId: string,
    templateId: string
  ): Promise<Buffer> {
    await this.validateManagerAccess(userId, warehouseId);

    const [product, template] = await Promise.all([
      this.warehouseProductRepository.findOne({
        where: { id: productId, warehouseId, isActive: true },
        relations: ['barcode', 'barcode.category'],
      }),
      this.findTemplate(userId, warehouseId, templateId),
    ]);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.generatePDF(product, template);
  }

  getTemplates(): LabelTemplateDto[] {
    return Array.from(this.templates.values());
  }

  getTemplate(templateId: string): LabelTemplateDto {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }
}
