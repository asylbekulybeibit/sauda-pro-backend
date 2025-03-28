import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Report, ReportType } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { Barcode } from '../manager/entities/barcode.entity';
import { WarehouseProduct } from '../manager/entities/warehouse-product.entity';
import { Warehouse } from '../manager/entities/warehouse.entity';
import { Category } from '../manager/entities/category.entity';
import {
  InventoryTransaction,
  TransactionType,
} from '../manager/entities/inventory-transaction.entity';
import { CashierStats } from '../manager/entities/cashier-stats.entity';
import { Promotion } from '../manager/entities/promotion.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { RoleType } from '../auth/types/role.type';
import { ReportGeneratorService } from './services/report-generator.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Barcode)
    private readonly barcodeRepository: Repository<Barcode>,
    @InjectRepository(WarehouseProduct)
    private readonly warehouseProductRepository: Repository<WarehouseProduct>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(InventoryTransaction)
    private readonly transactionRepository: Repository<InventoryTransaction>,
    @InjectRepository(CashierStats)
    private readonly cashierStatsRepository: Repository<CashierStats>,
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly reportGeneratorService: ReportGeneratorService
  ) {}

  async create(
    userId: string,
    createReportDto: CreateReportDto
  ): Promise<Report> {
    await this.validateAccess(userId, createReportDto.warehouseId);

    const report = this.reportRepository.create({
      ...createReportDto,
      createdById: userId,
    });

    // Generate report data based on type
    report.data = await this.generateReportData(report);

    // Save report to get ID
    await this.reportRepository.save(report);

    // Generate file
    report.fileUrl = await this.reportGeneratorService.generateFile(report);

    // Update report with file URL
    return this.reportRepository.save(report);
  }

  async findAll(userId: string, warehouseId: string): Promise<Report[]> {
    await this.validateAccess(userId, warehouseId);
    return this.reportRepository.find({
      where: { warehouseId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    userId: string,
    warehouseId: string,
    id: string
  ): Promise<Report> {
    await this.validateAccess(userId, warehouseId);

    const report = await this.reportRepository.findOne({
      where: { id, warehouseId, isActive: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async delete(userId: string, warehouseId: string, id: string): Promise<void> {
    await this.validateAccess(userId, warehouseId);

    const report = await this.reportRepository.findOne({
      where: { id, warehouseId, isActive: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.isActive = false;
    await this.reportRepository.save(report);
  }

  private async validateAccess(
    userId: string,
    warehouseId: string
  ): Promise<void> {
    // Проверяем доступ к складу
    const hasAccess = await this.userRoleRepository.findOne({
      where: {
        userId,
        warehouse: { id: warehouseId },
        isActive: true,
      },
    });

    if (!hasAccess) {
      throw new ForbiddenException('У вас нет доступа к этому складу');
    }
  }

  private async generateReportData(report: CreateReportDto): Promise<any> {
    switch (report.type) {
      case ReportType.SALES:
        return this.generateSalesReport(report);
      case ReportType.INVENTORY:
        return this.generateInventoryReport(report);
      case ReportType.STAFF:
        return this.generateStaffReport(report);
      case ReportType.FINANCIAL:
        return this.generateFinancialReport(report);
      case ReportType.CATEGORIES:
        return this.generateCategoriesReport(report);
      case ReportType.PROMOTIONS:
        return this.generatePromotionsReport(report);
      default:
        throw new Error(`Unsupported report type: ${report.type}`);
    }
  }

  private async generateSalesReport(report: CreateReportDto) {
    const transactions = await this.transactionRepository.find({
      where: {
        warehouseId: report.warehouseId,
        type: TransactionType.SALE,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['warehouseProduct', 'warehouseProduct.barcode'],
    });

    const totalSales = transactions.reduce(
      (sum, t) => sum + t.quantity * t.price,
      0
    );
    const totalItems = transactions.reduce((sum, t) => sum + t.quantity, 0);
    const uniqueProducts = new Set(
      transactions.map((t) => t.warehouseProductId)
    ).size;

    const salesByProduct = this.aggregateByProduct(transactions);
    const salesByDate = this.aggregateByDate(transactions);

    return {
      summary: {
        totalSales,
        totalItems,
        uniqueProducts,
        averageOrderValue: totalSales / transactions.length || 0,
      },
      details: transactions.map((t) => ({
        date: t.createdAt,
        product: t.warehouseProduct.barcode.productName,
        quantity: t.quantity,
        price: t.price,
        total: t.quantity * t.price,
      })),
      charts: {
        salesByProduct,
        salesByDate,
      },
    };
  }

  private async generateInventoryReport(report: CreateReportDto) {
    // Используем непосредственно warehouseId из отчета
    const warehouseId = report.warehouseId;

    const warehouseProducts = await this.warehouseProductRepository.find({
      where: { warehouseId },
      relations: ['barcode', 'barcode.category', 'warehouse'],
    });

    const transactions = await this.transactionRepository.find({
      where: {
        warehouseId,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['warehouseProduct', 'warehouseProduct.barcode'],
    });

    const lowStockProducts = warehouseProducts.filter(
      (p) => p.quantity > 0 && p.quantity <= p.minQuantity
    );
    const outOfStockProducts = warehouseProducts.filter(
      (p) => p.quantity === 0
    );

    return {
      summary: {
        totalProducts: warehouseProducts.length,
        lowStockProducts: lowStockProducts.length,
        outOfStockProducts: outOfStockProducts.length,
        totalValue: warehouseProducts.reduce(
          (sum, p) => sum + p.quantity * p.sellingPrice,
          0
        ),
      },
      details: warehouseProducts.map((p) => ({
        name: p.barcode.productName,
        category: p.barcode.category?.name || 'Без категории',
        quantity: p.quantity,
        minQuantity: p.minQuantity,
        price: p.sellingPrice,
        value: p.quantity * p.sellingPrice,
        status:
          p.quantity === 0
            ? 'OUT_OF_STOCK'
            : p.quantity <= p.minQuantity
            ? 'LOW_STOCK'
            : 'IN_STOCK',
      })),
      charts: {
        stockByCategory: this.aggregateByCategory(warehouseProducts),
        transactionsByType: this.aggregateByTransactionType(transactions),
      },
    };
  }

  private async generateStaffReport(report: CreateReportDto) {
    const stats = await this.cashierStatsRepository.find({
      where: {
        warehouseId: report.warehouseId,
        date: Between(report.startDate, report.endDate),
      },
      relations: ['user'],
    });

    const statsByUser = {};
    stats.forEach((stat) => {
      if (!statsByUser[stat.userId]) {
        statsByUser[stat.userId] = {
          name:
            stat.user?.firstName + ' ' + stat.user?.lastName ||
            'Неизвестный пользователь',
          totalSales: 0,
          totalTransactions: 0,
          averageTransactionValue: 0,
        };
      }
      statsByUser[stat.userId].totalSales += stat.totalSales;
      statsByUser[stat.userId].totalTransactions += stat.totalTransactions;
    });

    Object.values(statsByUser).forEach((userStats: any) => {
      userStats.averageTransactionValue =
        userStats.totalSales / userStats.totalTransactions || 0;
    });

    return {
      summary: {
        totalStaff: Object.keys(statsByUser).length,
        totalSales: Object.values(statsByUser).reduce(
          (sum: number, stat: any) => sum + stat.totalSales,
          0
        ),
        totalTransactions: Object.values(statsByUser).reduce(
          (sum: number, stat: any) => sum + stat.totalTransactions,
          0
        ),
      },
      details: Object.values(statsByUser),
      charts: {
        salesByStaff: Object.entries(statsByUser).reduce(
          (acc, [_, stat]: [string, any]) => {
            acc[stat.name] = stat.totalSales;
            return acc;
          },
          {}
        ),
      },
    };
  }

  private async generateFinancialReport(report: CreateReportDto) {
    const transactions = await this.transactionRepository.find({
      where: {
        warehouseId: report.warehouseId,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['warehouseProduct', 'warehouseProduct.barcode'],
    });

    const revenue = transactions
      .filter((t) => t.type === TransactionType.SALE)
      .reduce((sum, t) => sum + t.quantity * t.price, 0);

    const costs = transactions
      .filter((t) => t.type === TransactionType.PURCHASE)
      .reduce((sum, t) => sum + t.quantity * t.price, 0);

    const profit = revenue - costs;

    return {
      summary: {
        revenue,
        costs,
        profit,
        profitMargin: (profit / revenue) * 100 || 0,
      },
      details: transactions.map((t) => ({
        date: t.createdAt,
        type: t.type,
        product:
          t.warehouseProduct?.barcode?.productName || 'Неизвестный продукт',
        quantity: t.quantity,
        price: t.price,
        total: t.quantity * t.price,
      })),
      charts: {
        revenueByDate: this.aggregateByDate(
          transactions.filter((t) => t.type === TransactionType.SALE)
        ),
        costsByDate: this.aggregateByDate(
          transactions.filter((t) => t.type === TransactionType.PURCHASE)
        ),
      },
    };
  }

  private async generateCategoriesReport(report: CreateReportDto) {
    // Получаем shopId для работы с категориями
    const shopId = await this.getShopIdByWarehouseId(report.warehouseId);

    // Получаем все категории магазина
    const categories = await this.categoryRepository.find({
      where: { shopId: shopId },
    });

    // Получаем все баркоды для подсчета количества в каждой категории
    const barcodes = await this.barcodeRepository.find({
      where: { shopId: shopId },
      select: ['id', 'categoryId'],
    });

    // Подсчитываем количество баркодов для каждой категории
    const barcodesCountByCategory = barcodes.reduce((acc, barcode) => {
      if (barcode.categoryId) {
        acc[barcode.categoryId] = (acc[barcode.categoryId] || 0) + 1;
      }
      return acc;
    }, {});

    const transactions = await this.transactionRepository.find({
      where: {
        warehouseId: report.warehouseId,
        type: TransactionType.SALE,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['warehouseProduct', 'warehouseProduct.barcode'],
    });

    const categoryStats: Record<
      string,
      {
        name: string;
        productCount: number;
        totalSales: number;
        totalQuantity: number;
      }
    > = {};

    categories.forEach((category) => {
      categoryStats[category.id] = {
        name: category.name || 'Без названия',
        productCount: barcodesCountByCategory[category.id] || 0,
        totalSales: 0,
        totalQuantity: 0,
      };
    });

    transactions.forEach((transaction) => {
      if (transaction.warehouseProduct?.barcode?.categoryId) {
        const categoryId = transaction.warehouseProduct.barcode.categoryId;
        if (categoryId && categoryStats[categoryId]) {
          categoryStats[categoryId].totalSales +=
            transaction.quantity * transaction.price;
          categoryStats[categoryId].totalQuantity += transaction.quantity;
        }
      }
    });

    return {
      summary: {
        totalCategories: categories.length,
        totalProducts: Object.values(barcodesCountByCategory).reduce(
          (sum: number, count: number) => sum + count,
          0
        ),
        topCategory: Object.values(categoryStats).reduce((top, curr) =>
          !top || curr.totalSales > top.totalSales ? curr : top
        )?.name,
      },
      details: Object.values(categoryStats),
      charts: {
        salesByCategory: Object.entries(categoryStats).reduce(
          (acc, [_, stat]) => {
            acc[stat.name] = stat.totalSales;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
    };
  }

  private async generatePromotionsReport(report: CreateReportDto) {
    const promotions = await this.promotionRepository.find({
      where: {
        warehouseId: report.warehouseId,
        startDate: Between(report.startDate, report.endDate),
      },
      relations: ['barcodes'],
    });

    const transactions = await this.transactionRepository.find({
      where: {
        warehouseId: report.warehouseId,
        type: TransactionType.SALE,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['warehouseProduct', 'warehouseProduct.barcode'],
    });

    const promotionStats = {};
    promotions.forEach((promotion) => {
      promotionStats[promotion.id] = {
        name: promotion.name,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        discount: promotion.discount,
        productCount: promotion.barcodes.length,
        totalSales: 0,
        totalQuantity: 0,
      };

      const promotionTransactions = transactions.filter(
        (t) =>
          promotion.barcodes.some(
            (b) => b.id === t.warehouseProduct?.barcode?.id
          ) &&
          t.createdAt >= promotion.startDate &&
          t.createdAt <= promotion.endDate
      );

      promotionTransactions.forEach((transaction) => {
        promotionStats[promotion.id].totalSales +=
          transaction.quantity * transaction.price;
        promotionStats[promotion.id].totalQuantity += transaction.quantity;
      });
    });

    return {
      summary: {
        totalPromotions: promotions.length,
        activePromotions: promotions.filter(
          (p) => p.startDate <= new Date() && p.endDate >= new Date()
        ).length,
        totalDiscountedSales: Object.values(promotionStats).reduce(
          (sum: number, stat: any) => sum + stat.totalSales,
          0
        ),
      },
      details: Object.values(promotionStats),
      charts: {
        salesByPromotion: Object.entries(promotionStats).reduce(
          (acc, [_, stat]: [string, any]) => {
            acc[stat.name] = stat.totalSales;
            return acc;
          },
          {}
        ),
      },
    };
  }

  private aggregateByProduct(transactions: InventoryTransaction[]) {
    const aggregated = {};
    transactions.forEach((t) => {
      if (!t.warehouseProduct?.barcode?.productName) return;

      const key = t.warehouseProduct.barcode.productName;
      if (!aggregated[key]) {
        aggregated[key] = {
          quantity: 0,
          sales: 0,
        };
      }
      aggregated[key].quantity += t.quantity;
      aggregated[key].sales += t.quantity * t.price;
    });
    return aggregated;
  }

  private aggregateByDate(transactions: InventoryTransaction[]) {
    const aggregated = {};
    transactions.forEach((t) => {
      const date = t.createdAt.toISOString().split('T')[0];
      if (!aggregated[date]) {
        aggregated[date] = 0;
      }
      aggregated[date] += t.quantity * t.price;
    });
    return aggregated;
  }

  private aggregateByCategory(products: WarehouseProduct[]) {
    const aggregated = {};
    products.forEach((p) => {
      if (!p.barcode?.category?.name) return;

      const category = p.barcode.category.name || 'Без категории';
      if (!aggregated[category]) {
        aggregated[category] = {
          quantity: 0,
          value: 0,
        };
      }
      aggregated[category].quantity += p.quantity;
      aggregated[category].value += p.quantity * p.sellingPrice;
    });
    return aggregated;
  }

  private aggregateByTransactionType(transactions: InventoryTransaction[]) {
    const aggregated = {};
    transactions.forEach((t) => {
      const type = t.type;
      if (!aggregated[type]) {
        aggregated[type] = 0;
      }
      aggregated[type] += t.quantity;
    });
    return aggregated;
  }

  // Добавляем метод для получения shopId по warehouseId
  private async getShopIdByWarehouseId(warehouseId: string): Promise<string> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${warehouseId} not found`);
    }

    return warehouse.shopId;
  }
}
