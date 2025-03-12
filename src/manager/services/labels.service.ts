import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { Product } from '../entities/product.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { LabelTemplate } from '../entities/label-template.entity';
import { GenerateLabelsDto } from '../dto/products/generate-labels.dto';
import { CreateTemplateDto } from '../dto/products/create-template.dto';
import {
  LabelTemplateDto,
  LabelType,
} from '../dto/products/label-template.dto';

@Injectable()
export class LabelsService {
  private templates: Map<string, LabelTemplateDto> = new Map();

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(LabelTemplate)
    private readonly templateRepository: Repository<LabelTemplate>
  ) {
    // Инициализируем базовые шаблоны
    this.initializeDefaultTemplates();
  }

  private async validateManagerAccess(
    userId: string,
    shopId: string
  ): Promise<void> {
    const hasAccess = await this.userRoleRepository.findOne({
      where: { userId, shopId, role: 'manager', isActive: true },
    });

    if (!hasAccess) {
      throw new BadRequestException('No access to this shop');
    }
  }

  private initializeDefaultTemplates(): void {
    // Шаблон простого ценника
    const priceTagTemplate: LabelTemplateDto = {
      name: 'Стандартный ценник',
      type: LabelType.PRICE_TAG,
      size: 'small',
      template: {
        width: 58,
        height: 40,
        elements: [
          {
            type: 'text',
            x: 2,
            y: 2,
            value: '{{name}}',
            style: { fontSize: 12, bold: true },
          },
          {
            type: 'text',
            x: 2,
            y: 20,
            value: '{{price}} ₽',
            style: { fontSize: 16, bold: true },
          },
          {
            type: 'barcode',
            x: 2,
            y: 25,
            value: '{{barcode}}',
            style: { width: 54, height: 15 },
          },
        ],
      },
    };

    this.templates.set('price-tag-default', priceTagTemplate);
  }

  async createTemplate(
    userId: string,
    createTemplateDto: CreateTemplateDto
  ): Promise<LabelTemplate> {
    await this.validateManagerAccess(userId, createTemplateDto.shopId);

    const template = this.templateRepository.create(createTemplateDto);
    return this.templateRepository.save(template);
  }

  async findTemplates(
    userId: string,
    shopId: string
  ): Promise<LabelTemplate[]> {
    await this.validateManagerAccess(userId, shopId);

    return this.templateRepository.find({
      where: { shopId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findTemplate(
    userId: string,
    shopId: string,
    id: string
  ): Promise<LabelTemplate> {
    await this.validateManagerAccess(userId, shopId);

    const template = await this.templateRepository.findOne({
      where: { id, shopId, isActive: true },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async deleteTemplate(
    userId: string,
    shopId: string,
    id: string
  ): Promise<void> {
    await this.validateManagerAccess(userId, shopId);

    const template = await this.findTemplate(userId, shopId, id);
    template.isActive = false;
    await this.templateRepository.save(template);
  }

  private async generateBarcode(
    type: 'ean13' | 'code128' | 'qr',
    value: string,
    options: any
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid: type,
          text: value,
          scale: 3,
          height: 10,
          includetext: true,
          ...options,
        },
        (err, png) => {
          if (err) reject(err);
          else resolve(png);
        }
      );
    });
  }

  private replaceVariables(text: string, product: Product): string {
    return text
      .replace('{{name}}', product.name)
      .replace('{{price}}', product.price.toString())
      .replace('{{barcode}}', product.barcode || '')
      .replace('{{category}}', product.category?.name || '')
      .replace('{{description}}', product.description || '');
  }

  private async generatePDF(
    product: Product,
    template: LabelTemplate
  ): Promise<Buffer> {
    return new Promise(async (resolve) => {
      const doc = new PDFDocument({
        size: [template.template.width * 2.83, template.template.height * 2.83], // конвертация мм в пункты
        margin: 0,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Отрисовка элементов шаблона
      for (const element of template.template.elements) {
        switch (element.type) {
          case 'text':
            doc
              .font(element.style?.bold ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(element.style?.fontSize || 12)
              .text(
                this.replaceVariables(element.value, product),
                element.x * 2.83,
                element.y * 2.83
              );
            break;
          case 'barcode':
            if (product.barcode) {
              const barcodeBuffer = await this.generateBarcode(
                'ean13',
                product.barcode,
                element.style
              );
              doc.image(barcodeBuffer, element.x * 2.83, element.y * 2.83);
            }
            break;
          case 'qr':
            const qrBuffer = await this.generateBarcode(
              'qr',
              this.replaceVariables(element.value, product),
              element.style
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
    shopId: string,
    generateLabelsDto: GenerateLabelsDto
  ): Promise<Buffer> {
    await this.validateManagerAccess(userId, shopId);

    const template = await this.findTemplate(
      userId,
      shopId,
      generateLabelsDto.templateId
    );

    const products = await this.productRepository.findByIds(
      generateLabelsDto.products.map((p) => p.productId),
      {
        where: { shopId, isActive: true },
        relations: ['category'],
      }
    );

    if (products.length !== generateLabelsDto.products.length) {
      throw new BadRequestException('Some products not found');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 10 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => Buffer.concat(chunks));

    let x = 10;
    let y = 10;
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const labelWidth = template.template.width * 2.83;
    const labelHeight = template.template.height * 2.83;
    const labelsPerRow = Math.floor((pageWidth - 20) / labelWidth);

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = generateLabelsDto.products[i].quantity;

      for (let j = 0; j < quantity; j++) {
        if (y + labelHeight > pageHeight - 10) {
          doc.addPage();
          x = 10;
          y = 10;
        }

        const labelBuffer = await this.generatePDF(product, template);
        doc.image(labelBuffer, x, y, {
          width: labelWidth,
          height: labelHeight,
        });

        x += labelWidth + 5;
        if (x + labelWidth > pageWidth - 10) {
          x = 10;
          y += labelHeight + 5;
        }
      }
    }

    doc.end();
    return Buffer.concat(chunks);
  }

  async validateBarcode(barcode: string): Promise<boolean> {
    if (!barcode || barcode.length < 8) {
      return false;
    }

    // Базовая проверка EAN-13
    if (barcode.length === 13) {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const checksum = (10 - (sum % 10)) % 10;
      return checksum === parseInt(barcode[12]);
    }

    return true; // Для других форматов
  }

  async findProductByBarcode(
    userId: string,
    shopId: string,
    barcode: string
  ): Promise<Product> {
    await this.validateManagerAccess(userId, shopId);

    if (!(await this.validateBarcode(barcode))) {
      throw new BadRequestException('Invalid barcode');
    }

    const product = await this.productRepository.findOne({
      where: [
        { barcode, shopId, isActive: true },
        { barcodes: () => `barcodes @> ARRAY['${barcode}']::text[]` },
      ],
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async generatePreview(
    userId: string,
    shopId: string,
    productId: string,
    templateId: string
  ): Promise<Buffer> {
    await this.validateManagerAccess(userId, shopId);

    const [product, template] = await Promise.all([
      this.productRepository.findOne({
        where: { id: productId, shopId, isActive: true },
        relations: ['category'],
      }),
      this.findTemplate(userId, shopId, templateId),
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
