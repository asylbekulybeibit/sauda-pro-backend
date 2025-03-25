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
import { Shop } from '../shops/entities/shop.entity';
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
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly reportGeneratorService: ReportGeneratorService
  ) {}

  async create(
    userId: string,
    createReportDto: CreateReportDto
  ): Promise<Report> {
    await this.validateAccess(userId, createReportDto.shopId);

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

  async findAll(userId: string, shopId: string): Promise<Report[]> {
    await this.validateAccess(userId, shopId);
    return this.reportRepository.find({
      where: { shopId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, shopId: string, id: string): Promise<Report> {
    await this.validateAccess(userId, shopId);

    const report = await this.reportRepository.findOne({
      where: { id, shopId, isActive: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async delete(userId: string, shopId: string, id: string): Promise<void> {
    await this.validateAccess(userId, shopId);

    const report = await this.reportRepository.findOne({
      where: { id, shopId, isActive: true },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    report.isActive = false;
    await this.reportRepository.save(report);
  }

  private async validateAccess(userId: string, shopId: string): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!userRole) {
      throw new ForbiddenException('Access denied');
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
    // Находим склад по магазину
    const warehouses = await this.warehouseRepository.find({
      where: { shopId: report.shopId },
    });

    const warehouseIds = warehouses.map((w) => w.id);

    const warehouseProducts = await this.warehouseProductRepository.find({
      where: { warehouseId: In(warehouseIds) },
      relations: ['barcode', 'barcode.category', 'warehouse'],
    });

    const transactions = await this.transactionRepository.find({
      where: {
        warehouseId: In(warehouseIds),
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
        shopId: report.shopId,
        date: Between(report.startDate, report.endDate),
      },
      relations: ['user'],
    });

    const statsByUser = {};
    stats.forEach((stat) => {
      if (!statsByUser[stat.userId]) {
        statsByUser[stat.userId] = {
          name: stat.user.name,
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
        shopId: report.shopId,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['product'],
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
        product: t.product.name,
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
    const categories = await this.categoryRepository.find({
      where: { shopId: report.shopId },
      relations: ['products'],
    });

    const transactions = await this.transactionRepository.find({
      where: {
        shopId: report.shopId,
        type: TransactionType.SALE,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['product', 'product.category'],
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
        productCount: category.products?.length || 0,
        totalSales: 0,
        totalQuantity: 0,
      };
    });

    transactions.forEach((transaction) => {
      const categoryId = transaction.product?.categoryId;
      if (categoryId && categoryStats[categoryId]) {
        categoryStats[categoryId].totalSales +=
          transaction.quantity * transaction.price;
        categoryStats[categoryId].totalQuantity += transaction.quantity;
      }
    });

    return {
      summary: {
        totalCategories: categories.length,
        totalProducts: categories.reduce(
          (sum, c) => sum + c.products.length,
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
        shopId: report.shopId,
        startDate: Between(report.startDate, report.endDate),
      },
      relations: ['products'],
    });

    const transactions = await this.transactionRepository.find({
      where: {
        shopId: report.shopId,
        type: TransactionType.SALE,
        createdAt: Between(report.startDate, report.endDate),
      },
      relations: ['product'],
    });

    const promotionStats = {};
    promotions.forEach((promotion) => {
      promotionStats[promotion.id] = {
        name: promotion.name,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        discount: promotion.discount,
        productCount: promotion.products.length,
        totalSales: 0,
        totalQuantity: 0,
      };

      const promotionTransactions = transactions.filter(
        (t) =>
          promotion.products.some((p) => p.id === t.productId) &&
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
      const key = t.warehouseProduct.barcode.productName;
      if (!aggregated[key]) {
        aggregated[key] = 0;
      }
      aggregated[key] += t.quantity * t.price;
    });
    return aggregated;
  }

  private aggregateByDate(transactions: InventoryTransaction[]) {
    const aggregated = {};
    transactions.forEach((t) => {
      const key = t.createdAt.toISOString().split('T')[0];
      if (!aggregated[key]) {
        aggregated[key] = 0;
      }
      aggregated[key] += t.quantity * t.price;
    });
    return aggregated;
  }

  private aggregateByCategory(products: WarehouseProduct[]) {
    const aggregated = {};
    products.forEach((p) => {
      const key = p.barcode.category?.name || 'Без категории';
      if (!aggregated[key]) {
        aggregated[key] = 0;
      }
      aggregated[key] += p.quantity;
    });
    return aggregated;
  }

  private aggregateByTransactionType(transactions: InventoryTransaction[]) {
    const aggregated = {};
    transactions.forEach((t) => {
      if (!aggregated[t.type]) {
        aggregated[t.type] = 0;
      }
      aggregated[t.type] += t.quantity;
    });
    return aggregated;
  }
}
