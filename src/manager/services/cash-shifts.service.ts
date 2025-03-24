import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, Not, In } from 'typeorm';
import { CashShift, CashShiftStatus } from '../entities/cash-shift.entity';
import {
  CashRegister,
  CashRegisterStatus,
} from '../entities/cash-register.entity';
import {
  CashOperation,
  CashOperationType,
  PaymentMethodType,
} from '../entities/cash-operation.entity';
import { CashierStats } from '../entities/cashier-stats.entity';
import { CreateCashShiftDto } from '../dto/cash-shifts/create-cash-shift.dto';
import { CloseCashShiftDto } from '../dto/cash-shifts/close-cash-shift.dto';
import { GetCashShiftsFilterDto } from '../dto/cash-shifts/get-cash-shifts-filter.dto';
import { CashierStatsService } from './cashier-stats.service';

@Injectable()
export class CashShiftsService {
  constructor(
    @InjectRepository(CashShift)
    private readonly cashShiftRepository: Repository<CashShift>,
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(CashierStats)
    private readonly cashierStatsRepository: Repository<CashierStats>,
    private readonly cashierStatsService: CashierStatsService
  ) {}

  async create(
    createCashShiftDto: CreateCashShiftDto,
    shopId: string,
    userId: string
  ): Promise<CashShift> {
    // Проверяем, существует ли касса
    const cashRegister = await this.cashRegisterRepository.findOne({
      where: { id: createCashShiftDto.cashRegisterId, shopId },
    });

    if (!cashRegister) {
      throw new NotFoundException('Касса не найдена');
    }

    // Проверяем, что касса активна
    if (cashRegister.status !== CashRegisterStatus.ACTIVE) {
      throw new BadRequestException('Касса не активна или на обслуживании');
    }

    // Проверяем, что смена на этой кассе еще не открыта
    const openShiftOnRegister = await this.cashShiftRepository.findOne({
      where: {
        cashRegisterId: cashRegister.id,
        status: CashShiftStatus.OPEN,
      },
    });

    if (openShiftOnRegister) {
      throw new ConflictException('На этой кассе уже открыта смена');
    }

    // Проверяем, что кассир не работает на другой кассе
    const activeUserShift = await this.cashShiftRepository.findOne({
      where: {
        userId: userId,
        status: CashShiftStatus.OPEN,
      },
    });

    if (activeUserShift) {
      throw new ConflictException(
        'У вас уже есть активная смена на другой кассе'
      );
    }

    // Создаем и сохраняем смену
    const cashShift = new CashShift();
    cashShift.cashRegisterId = cashRegister.id;
    cashShift.userId = userId;
    cashShift.startTime = new Date();
    cashShift.initialAmount = createCashShiftDto.initialAmount;
    cashShift.status = CashShiftStatus.OPEN;

    const savedShift = await this.cashShiftRepository.save(cashShift);

    // Создаем операцию внесения начальной суммы
    if (createCashShiftDto.initialAmount > 0) {
      const cashOperation = new CashOperation();
      cashOperation.cashRegisterId = cashRegister.id;
      cashOperation.shiftId = savedShift.id;
      cashOperation.operationType = CashOperationType.DEPOSIT;
      cashOperation.amount = createCashShiftDto.initialAmount;
      cashOperation.paymentMethod = PaymentMethodType.CASH;

      await this.cashOperationRepository.save(cashOperation);
    }

    // Обновляем статус кассы
    cashRegister.status = CashRegisterStatus.ACTIVE;
    await this.cashRegisterRepository.save(cashRegister);

    return savedShift;
  }

  async findAll(
    shopId: string,
    filter: GetCashShiftsFilterDto
  ): Promise<CashShift[]> {
    const queryBuilder = this.cashShiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.user', 'user')
      .leftJoinAndSelect('shift.cashRegister', 'cashRegister')
      .where('shift.shopId = :shopId', { shopId });

    if (filter.cashRegisterId) {
      queryBuilder.andWhere('shift.cashRegisterId = :cashRegisterId', {
        cashRegisterId: filter.cashRegisterId,
      });
    }

    if (filter.userId) {
      queryBuilder.andWhere('shift.userId = :userId', {
        userId: filter.userId,
      });
    }

    if (filter.status) {
      queryBuilder.andWhere('shift.status = :status', {
        status: filter.status,
      });
    }

    if (filter.startDateFrom) {
      const fromDate = new Date(filter.startDateFrom);
      queryBuilder.andWhere('shift.startTime >= :fromDate', { fromDate });
    }

    if (filter.startDateTo) {
      const toDate = new Date(filter.startDateTo);
      toDate.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('shift.startTime <= :toDate', { toDate });
    }

    if (filter.endDateFrom) {
      const fromEndDate = new Date(filter.endDateFrom);
      queryBuilder.andWhere('shift.endTime >= :fromEndDate', { fromEndDate });
    }

    if (filter.endDateTo) {
      const toEndDate = new Date(filter.endDateTo);
      toEndDate.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('shift.endTime <= :toEndDate', { toEndDate });
    }

    queryBuilder.orderBy('shift.startTime', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, shopId: string): Promise<CashShift> {
    const shift = await this.cashShiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.user', 'user')
      .leftJoinAndSelect('shift.cashRegister', 'cashRegister')
      .where('shift.id = :id', { id })
      .andWhere('shift.shopId = :shopId', { shopId })
      .getOne();

    if (!shift) {
      throw new NotFoundException('Смена не найдена');
    }

    return shift;
  }

  async close(
    id: string,
    closeCashShiftDto: CloseCashShiftDto,
    shopId: string,
    userId: string
  ): Promise<CashShift> {
    // Находим смену
    const shift = await this.findOne(id, shopId);

    // Проверяем, что смена открыта
    if (shift.status !== CashShiftStatus.OPEN) {
      throw new BadRequestException('Смена уже закрыта');
    }

    // Находим кассу для обновления статуса
    const cashRegister = await this.cashRegisterRepository.findOne({
      where: { id: shift.cashRegisterId },
    });

    if (!cashRegister) {
      throw new NotFoundException('Касса не найдена');
    }

    // Проверяем, соответствует ли фактическая сумма текущей
    // Если есть расхождение, создаем операцию корректировки
    const discrepancy = closeCashShiftDto.finalAmount - shift.initialAmount;
    if (discrepancy !== 0) {
      let operationType: CashOperationType;
      let amount: number;

      if (discrepancy > 0) {
        // Излишек
        operationType = CashOperationType.DEPOSIT;
        amount = discrepancy;
      } else {
        // Недостача
        operationType = CashOperationType.WITHDRAWAL;
        amount = Math.abs(discrepancy);
      }

      const cashOperation = new CashOperation();
      cashOperation.cashRegisterId = cashRegister.id;
      cashOperation.shiftId = shift.id;
      cashOperation.operationType = operationType;
      cashOperation.amount = amount;
      cashOperation.paymentMethod = PaymentMethodType.CASH;

      await this.cashOperationRepository.save(cashOperation);
    }

    // Закрываем смену
    shift.status = CashShiftStatus.CLOSED;
    shift.endTime = new Date();
    shift.finalAmount = closeCashShiftDto.finalAmount;

    const closedShift = await this.cashShiftRepository.save(shift);

    // Обновляем статус кассы (возвращаем к активному)
    cashRegister.status = CashRegisterStatus.ACTIVE;
    await this.cashRegisterRepository.save(cashRegister);

    // Обновляем статистику кассира
    await this.updateCashierStats(closedShift);

    return closedShift;
  }

  async getCurrentShifts(shopId: string): Promise<CashShift[]> {
    return this.cashShiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.user', 'user')
      .leftJoinAndSelect('shift.cashRegister', 'cashRegister')
      .where('shift.shopId = :shopId', { shopId })
      .andWhere('shift.status = :status', { status: CashShiftStatus.OPEN })
      .getMany();
  }

  async getShiftOperations(
    shiftId: string,
    shopId: string
  ): Promise<CashOperation[]> {
    return this.cashOperationRepository
      .createQueryBuilder('operation')
      .leftJoinAndSelect('operation.order', 'order')
      .where('operation.shiftId = :shiftId', { shiftId })
      .andWhere('operation.shopId = :shopId', { shopId })
      .orderBy('operation.createdAt', 'ASC')
      .getMany();
  }

  private async updateCashierStats(shift: CashShift): Promise<void> {
    try {
      // Получаем операции за смену
      const operations = await this.cashOperationRepository.find({
        where: { shiftId: shift.id },
      });

      // Рассчитываем метрики
      let totalSales = 0;
      let totalTransactions = 0;

      operations.forEach((op) => {
        if (op.operationType === CashOperationType.SALE) {
          totalSales += op.amount;
          totalTransactions++;
        }
      });

      // Вычисляем продолжительность смены в минутах
      const startTime = new Date(shift.startTime);
      const endTime = shift.endTime ? new Date(shift.endTime) : new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const workMinutes = Math.floor(durationMs / (1000 * 60));

      // Получаем дату для группировки
      const date = new Date(startTime);
      date.setHours(0, 0, 0, 0);

      // Проверяем, есть ли уже статистика за этот день
      const stats = await this.cashierStatsRepository
        .createQueryBuilder('stats')
        .where('stats.shopId = :shopId', { shopId: shift.shopId })
        .andWhere('stats.userId = :userId', { userId: shift.userId })
        .andWhere('stats.date = :date', { date })
        .getOne();

      if (stats) {
        // Обновляем существующую запись
        stats.totalSales += totalSales;
        stats.totalTransactions += totalTransactions;
        stats.workMinutes += workMinutes;
        await this.cashierStatsRepository.save(stats);
      } else {
        // Создаем новую запись
        const newStats = new CashierStats();
        newStats.shopId = shift.shopId;
        newStats.userId = shift.userId;
        newStats.date = date;
        newStats.totalSales = totalSales;
        newStats.totalTransactions = totalTransactions;
        newStats.workMinutes = workMinutes;
        await this.cashierStatsRepository.save(newStats);
      }
    } catch (error) {
      // Логируем ошибку, но не прерываем процесс закрытия смены
      console.error('Ошибка при обновлении статистики кассира:', error);
    }
  }
}
