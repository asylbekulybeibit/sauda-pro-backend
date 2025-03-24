import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CashierStats } from '../entities/cashier-stats.entity';
import { CashShift } from '../entities/cash-shift.entity';
import {
  CashOperation,
  CashOperationType,
} from '../entities/cash-operation.entity';
import { SalesReceipt } from '../entities/sales-receipt.entity';
import { ServiceReceipt } from '../entities/service-receipt.entity';

@Injectable()
export class CashierStatsService {
  private readonly logger = new Logger(CashierStatsService.name);

  constructor(
    @InjectRepository(CashierStats)
    private readonly cashierStatsRepository: Repository<CashierStats>,
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(SalesReceipt)
    private readonly salesReceiptRepository: Repository<SalesReceipt>,
    @InjectRepository(ServiceReceipt)
    private readonly serviceReceiptRepository: Repository<ServiceReceipt>
  ) {}

  /**
   * Обновляет статистику кассира на основе закрытой смены
   * @param shift Закрытая смена
   */
  async updateStatsFromShift(shift: CashShift): Promise<void> {
    try {
      this.logger.log(`Updating cashier stats for shift: ${shift.id}`);

      // Получаем дату для статистики (начало дня даты смены)
      const date = new Date(shift.startTime);
      date.setHours(0, 0, 0, 0);

      // Получаем ID магазина из кассы
      const shopId = shift.cashRegister?.shopId;
      if (!shopId) {
        this.logger.error(
          `Cannot update stats: missing shopId for register ${shift.cashRegisterId}`
        );
        return;
      }

      // Находим или создаем запись статистики для этого кассира на этот день
      let stats = await this.cashierStatsRepository.findOne({
        where: {
          userId: shift.userId,
          shopId: shopId,
          date: date,
        },
      });

      if (!stats) {
        stats = this.cashierStatsRepository.create({
          userId: shift.userId,
          shopId: shopId,
          date: date,
          totalSales: 0,
          totalTransactions: 0,
          workMinutes: 0,
        });
      }

      // Рассчитываем статистику за смену
      const { totalSales, totalTransactions } = await this.calculateShiftStats(
        shift.id
      );
      const workMinutes = this.calculateWorkMinutes(
        shift.startTime,
        shift.endTime
      );

      // Обновляем статистику
      stats.totalSales += totalSales;
      stats.totalTransactions += totalTransactions;
      stats.workMinutes += workMinutes;

      // Сохраняем обновленную статистику
      await this.cashierStatsRepository.save(stats);

      this.logger.log(
        `Successfully updated cashier stats for shift ${shift.id}`
      );
    } catch (error) {
      this.logger.error(
        `Error updating cashier stats for shift ${shift.id}:`,
        error
      );
    }
  }

  /**
   * Рассчитывает статистику за смену
   * @param shiftId ID смены
   * @returns Объект с данными статистики
   */
  private async calculateShiftStats(
    shiftId: string
  ): Promise<{ totalSales: number; totalTransactions: number }> {
    // Получаем все операции продаж за смену
    const operations = await this.cashOperationRepository.find({
      where: {
        shiftId,
        operationType: CashOperationType.SALE,
      },
    });

    // Рассчитываем общую сумму продаж
    const totalSales = operations.reduce(
      (sum, op) => sum + Number(op.amount),
      0
    );

    // Количество транзакций - это количество операций продаж
    const totalTransactions = operations.length;

    return { totalSales, totalTransactions };
  }

  /**
   * Рассчитывает продолжительность работы в минутах
   * @param startTime Время начала
   * @param endTime Время окончания
   * @returns Продолжительность в минутах
   */
  private calculateWorkMinutes(startTime: Date, endTime: Date): number {
    if (!endTime) return 0;

    const diffMs = endTime.getTime() - startTime.getTime();
    return Math.floor(diffMs / (1000 * 60)); // Конвертация из миллисекунд в минуты
  }

  /**
   * Получает статистику кассира за указанный период
   * @param userId ID кассира
   * @param fromDate Начальная дата
   * @param toDate Конечная дата
   * @returns Массив записей статистики
   */
  async getCashierStats(
    userId: string,
    fromDate: Date,
    toDate: Date,
    shopId?: string
  ): Promise<CashierStats[]> {
    // Формируем условие запроса
    const whereCondition: any = {
      userId,
      date: Between(fromDate, toDate),
    };

    // Если указан shopId, добавляем его в условие запроса
    if (shopId) {
      whereCondition.shopId = shopId;
    }

    // Получаем статистику кассира в заданном диапазоне дат
    const stats = await this.cashierStatsRepository.find({
      where: whereCondition,
      order: {
        date: 'ASC',
      },
    });

    return stats;
  }

  async getDailySummary(shopId: string, date: Date): Promise<any> {
    // Создаем дату без учета времени
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Получаем статистику всех кассиров за конкретную дату
    const stats = await this.cashierStatsRepository.find({
      where: {
        shopId,
        date: targetDate,
      },
      relations: ['user'],
    });

    // Суммируем показатели
    let totalSales = 0;
    let totalTransactions = 0;
    let totalWorkMinutes = 0;

    stats.forEach((stat) => {
      totalSales += stat.totalSales;
      totalTransactions += stat.totalTransactions;
      totalWorkMinutes += stat.workMinutes;
    });

    return {
      date: targetDate,
      totalSales,
      totalTransactions,
      totalWorkMinutes,
      cashiersCount: stats.length,
      averageSales: stats.length > 0 ? totalSales / stats.length : 0,
      averageTransactions:
        stats.length > 0 ? totalTransactions / stats.length : 0,
      cashiers: stats.map((stat) => ({
        userId: stat.userId,
        name: stat.user?.name || 'Unknown',
        totalSales: stat.totalSales,
        totalTransactions: stat.totalTransactions,
        workMinutes: stat.workMinutes,
        productivity:
          stat.workMinutes > 0 ? stat.totalSales / stat.workMinutes : 0,
      })),
    };
  }

  async getUserSummary(
    userId: string,
    fromDate: Date,
    toDate: Date,
    shopId?: string
  ): Promise<any> {
    // Получаем статистику конкретного кассира за период
    const stats = await this.getCashierStats(userId, fromDate, toDate, shopId);

    if (stats.length === 0) {
      throw new NotFoundException(
        'Статистика не найдена для данного кассира и периода'
      );
    }

    // Суммируем показатели
    let totalSales = 0;
    let totalTransactions = 0;
    let totalWorkMinutes = 0;

    stats.forEach((stat) => {
      totalSales += stat.totalSales;
      totalTransactions += stat.totalTransactions;
      totalWorkMinutes += stat.workMinutes;
    });

    // Рассчитываем дополнительные метрики
    const workDays = stats.length;
    const averageDailySales = workDays > 0 ? totalSales / workDays : 0;
    const averageDailyTransactions =
      workDays > 0 ? totalTransactions / workDays : 0;
    const productivity =
      totalWorkMinutes > 0 ? totalSales / totalWorkMinutes : 0;

    return {
      userId,
      fromDate,
      toDate,
      totalSales,
      totalTransactions,
      totalWorkMinutes,
      workDays,
      averageDailySales,
      averageDailyTransactions,
      productivity,
      dailyStats: stats.map((stat) => ({
        date: stat.date,
        sales: stat.totalSales,
        transactions: stat.totalTransactions,
        workMinutes: stat.workMinutes,
      })),
    };
  }
}
