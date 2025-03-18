import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order } from '../manager/entities/order.entity';
import { OrderItem } from '../manager/entities/order-item.entity';
import { Product } from '../manager/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Shop } from '../shops/entities/shop.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { CacheService } from '../common/services/cache.service';
import { Cached, InvalidateCache } from '../common/decorators/cache.decorator';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly cacheService: CacheService
  ) {}

  @Cached('sales', 5 * 60 * 1000) // кэш на 5 минут
  async getSalesAnalytics(shopId: string, startDate: Date, endDate: Date) {
    const orders = await this.orderRepository.find({
      where: {
        shop: { id: shopId },
        createdAt: Between(startDate, endDate),
        status: 'completed',
      },
      relations: ['items', 'items.product', 'cashier'],
    });

    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalSales / totalOrders || 0;

    const salesByDay = this.groupOrdersByDay(orders);
    const salesByCategory = this.groupOrdersByCategory(orders);
    const topProducts = this.getTopProducts(orders);

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      salesByDay,
      salesByCategory,
      topProducts,
    };
  }

  @Cached('inventory', 10 * 60 * 1000) // кэш на 10 минут
  async getInventoryAnalytics(shopId: string) {
    try {
      const products = await this.productRepository.find({
        where: { shop: { id: shopId } },
        relations: ['category'],
      });

      const totalItems = products.reduce(
        (sum, product) => sum + product.quantity,
        0
      );
      const totalValue = products.reduce(
        (sum, product) => sum + product.quantity * product.sellingPrice,
        0
      );

      const lowStockProducts = products
        .filter((product) => product.quantity <= product.minQuantity)
        .map((product) => ({
          id: product.id,
          name: product.name,
          quantity: product.quantity,
          minQuantity: product.minQuantity,
          price: product.sellingPrice,
        }));

      const stockByCategory = this.groupProductsByCategory(products);

      return {
        totalItems,
        totalValue,
        lowStockProducts,
        stockByCategory,
      };
    } catch (error) {
      console.error('Error in getInventoryAnalytics:', error);
      throw error;
    }
  }

  @Cached('staff', 5 * 60 * 1000) // кэш на 5 минут
  async getStaffPerformance(shopId: string, startDate: Date, endDate: Date) {
    const orders = await this.orderRepository.find({
      where: {
        shop: { id: shopId },
        createdAt: Between(startDate, endDate),
        status: 'completed',
      },
      relations: ['cashier'],
    });

    const staffStats = this.calculateStaffStats(orders);
    const salesByHour = this.groupOrdersByHour(orders);

    return {
      totalStaff: staffStats.length,
      totalSales: orders.reduce((sum, order) => sum + order.total, 0),
      averageSalesPerEmployee:
        orders.reduce((sum, order) => sum + order.total, 0) /
          staffStats.length || 0,
      bestPerformer: staffStats[0] || null,
      staffStats,
      salesByHour,
    };
  }

  @Cached('financial', 15 * 60 * 1000) // кэш на 15 минут
  async getFinancialMetrics(shopId: string, startDate: Date, endDate: Date) {
    const [orders, expenses] = await Promise.all([
      this.orderRepository.find({
        where: {
          shop: { id: shopId },
          createdAt: Between(startDate, endDate),
          status: 'completed',
        },
        relations: ['items', 'items.product'],
      }),
      this.expenseRepository.find({
        where: {
          shop: { id: shopId },
          date: Between(startDate, endDate),
        },
      }),
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    const totalProfit = totalRevenue - totalExpenses;

    const expensesByCategory = this.groupExpensesByCategory(expenses);
    const dailyMetrics = this.calculateDailyMetrics(orders, expenses);
    const topProducts = this.getTopProductsByRevenue(orders);

    // Получаем данные за предыдущий период для расчета роста
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(
      previousPeriodStart.getDate() -
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const previousOrders = await this.orderRepository.find({
      where: {
        shop: { id: shopId },
        createdAt: Between(previousPeriodStart, startDate),
        status: 'completed',
      },
    });

    const previousRevenue = previousOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const revenueGrowth =
      ((totalRevenue - previousRevenue) / previousRevenue) * 100;

    return {
      totalRevenue,
      totalProfit,
      averageMargin: totalProfit / totalRevenue || 0,
      revenueGrowth,
      profitGrowth: revenueGrowth, // Упрощенный расчет
      expensesByCategory,
      dailyMetrics,
      topProducts,
    };
  }

  private groupOrdersByDay(orders: Order[]) {
    const salesByDay = new Map<string, number>();

    orders.forEach((order) => {
      const day = order.createdAt.toISOString().split('T')[0];
      salesByDay.set(day, (salesByDay.get(day) || 0) + order.total);
    });

    return Array.from(salesByDay.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));
  }

  private groupOrdersByCategory(orders: Order[]) {
    const salesByCategory = new Map<string, number>();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const category = item.product.category?.name || 'Без категории';
        salesByCategory.set(
          category,
          (salesByCategory.get(category) || 0) + item.quantity * item.price
        );
      });
    });

    return Array.from(salesByCategory.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));
  }

  private getTopProducts(orders: Order[]) {
    const productStats = new Map<
      string,
      {
        id: string;
        name: string;
        quantity: number;
        revenue: number;
      }
    >();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const product = item.product;
        const stats = productStats.get(product.id) || {
          id: product.id,
          name: product.name,
          quantity: 0,
          revenue: 0,
        };

        stats.quantity += item.quantity;
        stats.revenue += item.quantity * item.price;
        productStats.set(product.id, stats);
      });
    });

    return Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private groupProductsByCategory(products: Product[]) {
    const stockByCategory = new Map<
      string,
      {
        quantity: number;
        value: number;
      }
    >();

    products.forEach((product) => {
      const category = product.category?.name || 'Без категории';
      const stats = stockByCategory.get(category) || {
        quantity: 0,
        value: 0,
      };

      stats.quantity += product.quantity;
      stats.value += product.quantity * product.sellingPrice;
      stockByCategory.set(category, stats);
    });

    return Array.from(stockByCategory.entries()).map(([category, stats]) => ({
      category,
      ...stats,
    }));
  }

  private calculateStaffStats(orders: Order[]) {
    const staffStats = new Map<
      string,
      {
        id: string;
        name: string;
        position: string;
        sales: number;
        transactions: number;
        returns: number;
        workingHours: number;
      }
    >();

    orders.forEach((order) => {
      const cashier = order.cashier;
      const stats = staffStats.get(cashier.id) || {
        id: cashier.id,
        name: `${cashier.firstName} ${cashier.lastName}`,
        position: 'cashier', // Default role for cashiers
        sales: 0,
        transactions: 0,
        returns: 0,
        workingHours: 8, // Упрощенное значение
      };

      stats.sales += order.total;
      stats.transactions += 1;
      if (order.status === 'returned') {
        stats.returns += 1;
      }

      staffStats.set(cashier.id, stats);
    });

    return Array.from(staffStats.values())
      .map((stats) => ({
        ...stats,
        efficiency: stats.sales / (stats.workingHours * 3600), // Продажи в секунду
      }))
      .sort((a, b) => b.sales - a.sales);
  }

  private groupOrdersByHour(orders: Order[]) {
    const salesByHour = new Map<
      number,
      {
        sales: number;
        transactions: number;
      }
    >();

    orders.forEach((order) => {
      const hour = order.createdAt.getHours();
      const stats = salesByHour.get(hour) || {
        sales: 0,
        transactions: 0,
      };

      stats.sales += order.total;
      stats.transactions += 1;
      salesByHour.set(hour, stats);
    });

    return Array.from(salesByHour.entries()).map(([hour, stats]) => ({
      hour,
      ...stats,
    }));
  }

  private groupExpensesByCategory(expenses: Expense[]) {
    const expensesByCategory = new Map<string, number>();

    expenses.forEach((expense) => {
      expensesByCategory.set(
        expense.category,
        (expensesByCategory.get(expense.category) || 0) + expense.amount
      );
    });

    return Array.from(expensesByCategory.entries()).map(
      ([category, amount]) => ({
        category,
        amount,
      })
    );
  }

  private calculateDailyMetrics(orders: Order[], expenses: Expense[]) {
    const dailyMetrics = new Map<
      string,
      {
        revenue: number;
        expenses: number;
      }
    >();

    orders.forEach((order) => {
      const day = order.createdAt.toISOString().split('T')[0];
      const metrics = dailyMetrics.get(day) || {
        revenue: 0,
        expenses: 0,
      };

      metrics.revenue += order.total;
      dailyMetrics.set(day, metrics);
    });

    expenses.forEach((expense) => {
      const day = expense.date.toISOString().split('T')[0];
      const metrics = dailyMetrics.get(day) || {
        revenue: 0,
        expenses: 0,
      };

      metrics.expenses += expense.amount;
      dailyMetrics.set(day, metrics);
    });

    return Array.from(dailyMetrics.entries()).map(([date, metrics]) => ({
      date,
      ...metrics,
      profit: metrics.revenue - metrics.expenses,
    }));
  }

  private getTopProductsByRevenue(orders: Order[]) {
    const productStats = new Map<
      string,
      {
        id: string;
        name: string;
        revenue: number;
        profit: number;
        quantity: number;
      }
    >();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const product = item.product;
        const stats = productStats.get(product.id) || {
          id: product.id,
          name: product.name,
          revenue: 0,
          profit: 0,
          quantity: 0,
        };

        const revenue = item.quantity * item.price;
        const cost = item.quantity * product.purchasePrice;

        stats.revenue += revenue;
        stats.profit += revenue - cost;
        stats.quantity += item.quantity;

        productStats.set(product.id, stats);
      });
    });

    return Array.from(productStats.values())
      .map((stats) => ({
        ...stats,
        margin: stats.profit / stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }
}
