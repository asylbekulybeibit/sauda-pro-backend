import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  CashOperation,
  CashOperationType,
  PaymentMethodType,
} from '../entities/cash-operation.entity';
import { CashShift, CashShiftStatus } from '../entities/cash-shift.entity';
import { CreateCashOperationDto } from '../dto/cash-operations/create-cash-operation.dto';
import { GetCashOperationsFilterDto } from '../dto/cash-operations/get-cash-operations-filter.dto';

@Injectable()
export class CashOperationsService {
  constructor(
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(CashShift)
    private readonly cashShiftRepository: Repository<CashShift>
  ) {}

  async create(
    createCashOperationDto: CreateCashOperationDto,
    shopId: string,
    userId: string
  ): Promise<CashOperation> {
    // Проверка существования и статуса смены
    const cashShift = await this.cashShiftRepository.findOne({
      where: {
        id: createCashOperationDto.shiftId,
        shopId,
        status: CashShiftStatus.OPEN,
      },
    });

    if (!cashShift) {
      throw new BadRequestException(
        'Кассовая смена не найдена или уже закрыта'
      );
    }

    // Проверка, что сумма операции не отрицательная
    if (createCashOperationDto.amount < 0) {
      throw new BadRequestException(
        'Сумма операции не может быть отрицательной'
      );
    }

    // Создаем и сохраняем операцию
    const cashOperation = await this.cashOperationRepository.save({
      shiftId: cashShift.id,
      cashRegisterId: cashShift.cashRegisterId,
      userId,
      shopId,
      operationType: createCashOperationDto.operationType,
      amount: createCashOperationDto.amount,
      paymentMethod: createCashOperationDto.paymentMethod,
      description: `Операция ${createCashOperationDto.operationType} на сумму ${createCashOperationDto.amount}`,
      orderId: createCashOperationDto.orderId || null,
    });

    // Если операция - внесение наличных или операция SALE/SERVICE с оплатой наличными, обновляем сумму в кассе
    if (
      createCashOperationDto.operationType === CashOperationType.DEPOSIT ||
      ((createCashOperationDto.operationType === CashOperationType.SALE ||
        createCashOperationDto.operationType === CashOperationType.SERVICE) &&
        createCashOperationDto.paymentMethod === PaymentMethodType.CASH)
    ) {
      cashShift.currentAmount += createCashOperationDto.amount;
      await this.cashShiftRepository.save(cashShift);
    }

    // Если операция - изъятие наличных или возврат наличными, уменьшаем сумму в кассе
    if (
      createCashOperationDto.operationType === CashOperationType.WITHDRAWAL ||
      createCashOperationDto.operationType === CashOperationType.RETURN
    ) {
      cashShift.currentAmount -= createCashOperationDto.amount;
      await this.cashShiftRepository.save(cashShift);
    }

    return cashOperation;
  }

  async findAll(
    shopId: string,
    filter?: GetCashOperationsFilterDto
  ): Promise<CashOperation[]> {
    const queryBuilder = this.cashOperationRepository
      .createQueryBuilder('operation')
      .leftJoinAndSelect('operation.shift', 'shift')
      .leftJoinAndSelect('operation.user', 'user')
      .leftJoinAndSelect('operation.order', 'order')
      .where('operation.shopId = :shopId', { shopId });

    if (filter?.shiftId) {
      queryBuilder.andWhere('operation.shiftId = :shiftId', {
        shiftId: filter.shiftId,
      });
    }

    if (filter?.cashRegisterId) {
      queryBuilder.andWhere('operation.cashRegisterId = :cashRegisterId', {
        cashRegisterId: filter.cashRegisterId,
      });
    }

    if (filter?.operationType) {
      queryBuilder.andWhere('operation.operationType = :operationType', {
        operationType: filter.operationType,
      });
    }

    if (filter?.paymentMethod) {
      queryBuilder.andWhere('operation.paymentMethod = :paymentMethod', {
        paymentMethod: filter.paymentMethod,
      });
    }

    if (filter?.orderId) {
      queryBuilder.andWhere('operation.orderId = :orderId', {
        orderId: filter.orderId,
      });
    }

    if (filter?.dateFrom) {
      const fromDate = new Date(filter.dateFrom);
      queryBuilder.andWhere('operation.createdAt >= :fromDate', { fromDate });
    }

    if (filter?.dateTo) {
      const toDate = new Date(filter.dateTo);
      toDate.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('operation.createdAt <= :toDate', { toDate });
    }

    queryBuilder.orderBy('operation.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, shopId: string): Promise<CashOperation> {
    const operation = await this.cashOperationRepository
      .createQueryBuilder('operation')
      .leftJoinAndSelect('operation.shift', 'shift')
      .leftJoinAndSelect('operation.user', 'user')
      .leftJoinAndSelect('operation.order', 'order')
      .where('operation.id = :id', { id })
      .andWhere('operation.shopId = :shopId', { shopId })
      .getOne();

    if (!operation) {
      throw new NotFoundException('Операция не найдена');
    }

    return operation;
  }

  async findByShift(shiftId: string, shopId: string): Promise<CashOperation[]> {
    return this.cashOperationRepository
      .createQueryBuilder('operation')
      .leftJoinAndSelect('operation.user', 'user')
      .leftJoinAndSelect('operation.order', 'order')
      .where('operation.shiftId = :shiftId', { shiftId })
      .andWhere('operation.shopId = :shopId', { shopId })
      .orderBy('operation.createdAt', 'DESC')
      .getMany();
  }

  async findByRegister(
    registerId: string,
    shopId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<CashOperation[]> {
    const queryBuilder = this.cashOperationRepository
      .createQueryBuilder('operation')
      .leftJoinAndSelect('operation.shift', 'shift')
      .leftJoinAndSelect('operation.user', 'user')
      .where('operation.cashRegisterId = :registerId', { registerId })
      .andWhere('operation.shopId = :shopId', { shopId });

    if (fromDate) {
      queryBuilder.andWhere('operation.createdAt >= :fromDate', { fromDate });
    }

    if (toDate) {
      queryBuilder.andWhere('operation.createdAt <= :toDate', { toDate });
    }

    queryBuilder.orderBy('operation.createdAt', 'DESC');

    return queryBuilder.getMany();
  }
}
