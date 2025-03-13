import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as bwipjs from 'bwip-js';
import { Product } from '../entities/product.entity';
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
      where: { userId, shopId, type: RoleType.MANAGER, isActive: true },
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
            value: '{{barcodes[0]}}',
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
    type: 'ean13' | 'qr',
    value: string,
    options?: any
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid: type === 'ean13' ? 'ean13' : 'qrcode',
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
      .replace('{{barcodes[0]}}', product.barcodes?.[0] || '')
      .replace('{{category}}', product.category?.name || '')
      .replace('{{description}}', product.description || '');
  }

  private async generatePDF(
    product: Product,
    template: LabelTemplate
  ): Promise<Buffer> {
    return new Promise(async (resolve) => {
      const doc = new PDFDocument({
        size: [template.template.width * 2.83, template.template.height * 2.83],
        margin: 0,
      });

      const buffers: any[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      for (const element of template.template.elements) {
        switch (element.type) {
          case 'text':
            doc
              .font(element.style?.bold ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(element.style?.fontSize || 12)
              .text(
                this.replaceVariables(element.value, product),
                element.x * 2.83,
                element.y * 2.83,
                { lineBreak: false }
              );
            break;
          case 'barcode':
            if (product.barcodes?.[0]) {
              const barcodeBuffer = await this.generateBarcode(
                'ean13',
                product.barcodes[0],
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

    const template = await this.templateRepository.findOne({
      where: { id: generateLabelsDto.templateId, shopId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const productIds = generateLabelsDto.products.map((p) => p.productId);
    const products = await this.productRepository.find({
      where: {
        id: In(productIds),
        shopId,
        isActive: true,
      },
      relations: ['category'],
    });

    if (products.length !== generateLabelsDto.products.length) {
      throw new BadRequestException('Some products not found');
    }

    return new Promise(async (resolve) => {
      const doc = new PDFDocument({
        size: [template.template.width * 2.83, template.template.height * 2.83],
        margin: 0,
      });

      const buffers: any[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let x = 10;
      let y = 10;

      for (const productData of generateLabelsDto.products) {
        const product = products.find((p) => p.id === productData.productId);
        if (!product) continue;

        for (let i = 0; i < productData.quantity; i++) {
          if (x + template.template.width * 2.83 > doc.page.width) {
            x = 10;
            y += template.template.height * 2.83 + 10;
          }

          if (y + template.template.height * 2.83 > doc.page.height) {
            doc.addPage();
            x = 10;
            y = 10;
          }

          const labelBuffer = await this.generatePDF(product, template);
          doc.image(labelBuffer, x, y);
          x += template.template.width * 2.83 + 10;
        }
      }

      doc.end();
    });
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

    const product = await this.productRepository.findOne({
      where: {
        shopId,
        isActive: true,
        barcodes: Like(`%${barcode}%`),
      },
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
