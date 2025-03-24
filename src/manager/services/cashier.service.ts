import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, IsNull, LessThan, In } from 'typeorm';
import { CashShift, CashShiftStatus } from '../entities/cash-shift.entity';
import { Service, ServiceStatus } from '../entities/service.entity';
import {
  SalesReceipt,
  SalesReceiptStatus,
} from '../entities/sales-receipt.entity';
import {
  ServiceReceipt,
  ServiceReceiptStatus,
} from '../entities/service-receipt.entity';
import {
  CashOperation,
  CashOperationType,
  PaymentMethodType,
} from '../entities/cash-operation.entity';
import { GetCashierShiftsDto } from '../dto/cashier/get-cashier-shifts.dto';
import { CashierShiftSummaryDto } from '../dto/cashier/cashier-shift-summary.dto';
import { CashierStartServiceDto } from '../dto/cashier/start-service.dto';
import { CashierCompleteServiceDto } from '../dto/cashier/complete-service.dto';
import { ServiceReceiptDetail } from '../entities/service-receipt-detail.entity';
import { SalesReceiptItem } from '../entities/sales-receipt-item.entity';
import { ServiceType } from '../entities/service-type.entity';
import { Client } from '../entities/client.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { User } from '../../users/entities/user.entity';
import { Product } from '../entities/product.entity';

@Injectable()
export class CashierService {
  constructor(
    @InjectRepository(CashShift)
    private readonly cashShiftRepository: Repository<CashShift>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(ServiceType)
    private readonly serviceTypeRepository: Repository<ServiceType>,
    @InjectRepository(SalesReceipt)
    private readonly salesReceiptRepository: Repository<SalesReceipt>,
    @InjectRepository(SalesReceiptItem)
    private readonly salesReceiptItemRepository: Repository<SalesReceiptItem>,
    @InjectRepository(ServiceReceipt)
    private readonly serviceReceiptRepository: Repository<ServiceReceipt>,
    @InjectRepository(ServiceReceiptDetail)
    private readonly serviceReceiptDetailRepository: Repository<ServiceReceiptDetail>,
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) {}

  async getCashierShifts(
    shopId: string,
    userId: string,
    filter: GetCashierShiftsDto
  ): Promise<CashShift[]> {
    const queryBuilder = this.cashShiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.openedBy', 'openedBy')
      .leftJoinAndSelect('shift.closedBy', 'closedBy')
      .leftJoinAndSelect('shift.cashRegister', 'cashRegister')
      .where('shift.shopId = :shopId', { shopId });

    // Фильтр по статусу
    if (filter.status) {
      queryBuilder.andWhere('shift.status = :status', {
        status: filter.status,
      });
    }

    // Фильтр по дате начала
    if (filter.startDateFrom) {
      const startFrom = new Date(filter.startDateFrom);
      queryBuilder.andWhere('shift.startTime >= :startFrom', { startFrom });
    }

    if (filter.startDateTo) {
      const startTo = new Date(filter.startDateTo);
      startTo.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('shift.startTime <= :startTo', { startTo });
    }

    // По умолчанию показываем смены текущего пользователя
    queryBuilder.andWhere(
      '(shift.userId = :userId OR shift.closedById = :userId)',
      { userId }
    );

    queryBuilder.orderBy('shift.startTime', 'DESC');

    return queryBuilder.getMany();
  }

  async getCurrentShift(shopId: string, userId: string): Promise<CashShift> {
    const currentShift = await this.cashShiftRepository.findOne({
      where: {
        shopId,
        userId: userId,
        status: CashShiftStatus.OPEN,
      },
      relations: ['openedBy', 'cashRegister'],
    });

    if (!currentShift) {
      throw new NotFoundException('Активная смена не найдена');
    }

    return currentShift;
  }

  async getShiftSummary(
    shopId: string,
    shiftId: string
  ): Promise<CashierShiftSummaryDto> {
    const shift = await this.cashShiftRepository.findOne({
      where: { id: shiftId, shopId },
      relations: ['user', 'closedBy', 'cashRegister'],
    });

    if (!shift) {
      throw new NotFoundException('Смена не найдена');
    }

    // Получаем все кассовые операции за смену
    const operations = await this.cashOperationRepository.find({
      where: { shiftId, shopId },
    });

    // Получаем чеки продаж за смену
    const salesReceipts = await this.salesReceiptRepository.find({
      where: { cashShiftId: shiftId, shopId },
      relations: ['items'],
    });

    // Получаем чеки услуг за смену
    const serviceReceipts = await this.serviceReceiptRepository.find({
      where: { cashShiftId: shiftId, shopId },
      relations: ['details'],
    });

    // Рассчитываем метрики смены
    let cashIncome = 0;
    let cardIncome = 0;
    let qrIncome = 0;
    let salesCount = 0;
    let servicesCount = 0;
    let returnsCount = 0;
    let cashWithdraws = 0;
    let cashDeposits = 0;

    operations.forEach((op) => {
      if (
        op.operationType === CashOperationType.SALE ||
        op.operationType === CashOperationType.SERVICE
      ) {
        switch (op.paymentMethod) {
          case PaymentMethodType.CASH:
            cashIncome += op.amount;
            break;
          case PaymentMethodType.CARD:
            cardIncome += op.amount;
            break;
          case PaymentMethodType.QR:
            qrIncome += op.amount;
            break;
        }

        if (op.operationType === CashOperationType.SALE) {
          salesCount++;
        } else if (op.operationType === CashOperationType.SERVICE) {
          servicesCount++;
        }
      } else if (op.operationType === CashOperationType.RETURN) {
        returnsCount++;
      } else if (op.operationType === CashOperationType.WITHDRAWAL) {
        cashWithdraws += op.amount;
      } else if (op.operationType === CashOperationType.DEPOSIT) {
        cashDeposits += op.amount;
      }
    });

    // Формируем итоговый объект
    const summary: CashierShiftSummaryDto = {
      id: shift.id,
      cashRegisterId: shift.cashRegisterId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      initialAmount: shift.initialAmount,
      finalAmount: shift.finalAmount,
      status: shift.status,
      salesCount,
      servicesCount,
      totalIncome: cashIncome + cardIncome + qrIncome,
      cashIncome,
      cardIncome,
      qrIncome,
      cashWithdraws,
      cashDeposits,
      returnsCount,
      notes: shift.notes,
      openedBy: {
        id: shift.user.id,
        name: shift.user.firstName + ' ' + shift.user.lastName,
      },
      closedBy: shift.closedBy
        ? {
            id: shift.closedBy.id,
            name: shift.closedBy.firstName + ' ' + shift.closedBy.lastName,
          }
        : null,
      cashRegister: {
        id: shift.cashRegister.id,
        name: shift.cashRegister.name,
      },
    };

    return summary;
  }

  async startService(
    startServiceDto: CashierStartServiceDto,
    shopId: string,
    userId: string
  ): Promise<Service> {
    // Проверка существования открытой смены у кассира
    const currentShift = await this.cashShiftRepository.findOne({
      where: {
        shopId,
        userId: userId,
        status: CashShiftStatus.OPEN,
      },
    });

    if (!currentShift) {
      throw new BadRequestException('У кассира нет открытой смены');
    }

    // Проверка существования типа услуги
    const serviceType = await this.serviceTypeRepository.findOne({
      where: { id: startServiceDto.serviceTypeId, shopId },
    });

    if (!serviceType) {
      throw new NotFoundException('Тип услуги не найден');
    }

    // Проверка существования клиента
    const client = await this.clientRepository.findOne({
      where: { id: startServiceDto.clientId, shopId },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    // Проверка существования автомобиля
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: startServiceDto.vehicleId, shopId },
    });

    if (!vehicle) {
      throw new NotFoundException('Автомобиль не найден');
    }

    // Проверка существования сотрудников
    const staffUsers = await this.userRepository.find({
      where: startServiceDto.staffIds.map((id) => ({ id, shopId })),
    });

    if (staffUsers.length !== startServiceDto.staffIds.length) {
      throw new BadRequestException(
        'Один или несколько сотрудников не найдены'
      );
    }

    // Создаем новую услугу
    const service = await this.serviceRepository.save({
      serviceTypeId: startServiceDto.serviceTypeId,
      clientId: startServiceDto.clientId,
      vehicleId: startServiceDto.vehicleId,
      startedBy: userId,
      startTime: new Date(),
      status: ServiceStatus.ACTIVE,
      shopId,
      cashShiftId: currentShift.id,
      // Установим начальные значения для других обязательных полей
      originalPrice: serviceType.price || 0,
      finalPrice: serviceType.price || 0,
      createdBy: userId,
    });

    // Добавляем связи с сотрудниками
    // Предполагаем, что есть таблица связи service_staff или аналогичная
    // Здесь нужно добавить код для создания связей услуги с сотрудниками

    return service;
  }

  async completeService(
    completeServiceDto: CashierCompleteServiceDto,
    shopId: string,
    userId: string
  ): Promise<ServiceReceipt> {
    // Проверка существования открытой смены у кассира
    const currentShift = await this.cashShiftRepository.findOne({
      where: {
        shopId,
        userId: userId,
        status: CashShiftStatus.OPEN,
      },
    });

    if (!currentShift) {
      throw new BadRequestException('У кассира нет открытой смены');
    }

    // Проверка существования услуги
    const service = await this.serviceRepository.findOne({
      where: { id: completeServiceDto.serviceId, shopId },
      relations: ['serviceType', 'serviceStaff', 'client', 'vehicle'],
    });

    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }

    if (service.status !== ServiceStatus.ACTIVE) {
      throw new BadRequestException(
        'Можно завершить только услугу в процессе выполнения'
      );
    }

    // Обновляем статус услуги
    service.status = ServiceStatus.COMPLETED;
    service.completedBy = userId;
    service.endTime = new Date();
    service.finalPrice = completeServiceDto.finalPrice;

    await this.serviceRepository.save(service);

    // Создаем чек услуги
    const serviceReceipt = await this.serviceReceiptRepository.save({
      serviceId: service.id,
      cashShiftId: currentShift.id,
      cashierId: userId,
      shopId,
      totalAmount: completeServiceDto.finalPrice,
      finalAmount: completeServiceDto.finalPrice,
      paymentMethod: completeServiceDto.paymentMethod,
      receiptNumber: `SRV-${Date.now()}`, // Генерируем номер чека
      status: ServiceReceiptStatus.PAID,
    });

    // Создаем детали чека для каждого сотрудника услуги
    if (service.serviceStaff && service.serviceStaff.length > 0) {
      const detailPromises = service.serviceStaff.map(async (staffItem) => {
        return await this.serviceReceiptDetailRepository.save({
          serviceReceiptId: serviceReceipt.id,
          staffId: staffItem.staffId,
          description: `Услуга: ${service.serviceType.name}`,
          amount: completeServiceDto.finalPrice / service.serviceStaff.length,
          shopId,
        });
      });

      await Promise.all(detailPromises);
    }

    // Создаем кассовую операцию
    let paymentMethodType: PaymentMethodType;
    switch (completeServiceDto.paymentMethod.toLowerCase()) {
      case 'cash':
        paymentMethodType = PaymentMethodType.CASH;
        break;
      case 'card':
        paymentMethodType = PaymentMethodType.CARD;
        break;
      case 'qr':
        paymentMethodType = PaymentMethodType.QR;
        break;
      default:
        paymentMethodType = PaymentMethodType.CASH;
    }

    const cashOperation = await this.cashOperationRepository.save({
      cashRegisterId: currentShift.cashRegisterId,
      shiftId: currentShift.id,
      operationType: CashOperationType.SERVICE,
      amount: completeServiceDto.finalPrice,
      paymentMethod: paymentMethodType,
      orderId: service.id,
      shopId,
      userId,
    });

    // Привязываем операцию к чеку
    serviceReceipt.cashOperationId = cashOperation.id;
    await this.serviceReceiptRepository.save(serviceReceipt);

    // Если метод оплаты - наличные, обновляем сумму в кассе
    if (paymentMethodType === PaymentMethodType.CASH) {
      currentShift.currentAmount += completeServiceDto.finalPrice;
      await this.cashShiftRepository.save(currentShift);
    }

    // Возвращаем созданный чек с подробностями
    return this.serviceReceiptRepository.findOne({
      where: { id: serviceReceipt.id },
      relations: [
        'details',
        'service',
        'cashier',
        'cashShift',
        'cashOperation',
      ],
    });
  }

  async getActiveServices(shopId: string): Promise<Service[]> {
    return this.serviceRepository.find({
      where: {
        shopId,
        status: ServiceStatus.ACTIVE,
      },
      relations: [
        'serviceType',
        'client',
        'vehicle',
        'serviceStaff',
        'startedBy',
      ],
      order: { startTime: 'ASC' },
    });
  }

  async quickSale(
    shopId: string,
    userId: string,
    productId: string,
    quantity: number,
    paymentMethod: string
  ): Promise<SalesReceipt> {
    // Проверка существования открытой смены у кассира
    const currentShift = await this.cashShiftRepository.findOne({
      where: {
        shopId,
        userId: userId,
        status: CashShiftStatus.OPEN,
      },
    });

    if (!currentShift) {
      throw new BadRequestException('У кассира нет открытой смены');
    }

    // Проверка существования товара
    const product = await this.productRepository.findOne({
      where: { id: productId, shopId },
    });

    if (!product) {
      throw new NotFoundException('Товар не найден');
    }

    // Проверка наличия товара
    if (product.quantity < quantity) {
      throw new BadRequestException(
        'Недостаточное количество товара на складе'
      );
    }

    // Рассчитываем итоговую сумму
    const totalAmount = product.sellingPrice * quantity;

    // Создаем чек продажи
    const salesReceipt = await this.salesReceiptRepository.save({
      cashShiftId: currentShift.id,
      cashierId: userId,
      shopId,
      totalAmount: totalAmount,
      finalAmount: totalAmount,
      paymentMethod,
      receiptNumber: `SALE-${Date.now()}`, // Генерируем номер чека
      status: SalesReceiptStatus.PAID,
    });

    // Создаем позицию чека
    await this.salesReceiptItemRepository.save({
      salesReceiptId: salesReceipt.id,
      productId,
      quantity,
      price: product.sellingPrice,
      amount: totalAmount,
      totalPrice: totalAmount,
      finalAmount: totalAmount,
      productName: product.name,
      shopId,
    });

    // Создаем кассовую операцию
    let paymentMethodType: PaymentMethodType;
    switch (paymentMethod.toLowerCase()) {
      case 'cash':
        paymentMethodType = PaymentMethodType.CASH;
        break;
      case 'card':
        paymentMethodType = PaymentMethodType.CARD;
        break;
      case 'qr':
        paymentMethodType = PaymentMethodType.QR;
        break;
      default:
        paymentMethodType = PaymentMethodType.CASH;
    }

    const cashOperation = await this.cashOperationRepository.save({
      cashRegisterId: currentShift.cashRegisterId,
      shiftId: currentShift.id,
      operationType: CashOperationType.SALE,
      amount: totalAmount,
      paymentMethod: paymentMethodType,
      shopId,
      userId,
    });

    // Привязываем операцию к чеку
    salesReceipt.cashOperationId = cashOperation.id;
    await this.salesReceiptRepository.save(salesReceipt);

    // Если метод оплаты - наличные, обновляем сумму в кассе
    if (paymentMethodType === PaymentMethodType.CASH) {
      currentShift.currentAmount += totalAmount;
      await this.cashShiftRepository.save(currentShift);
    }

    // Обновляем количество товара на складе
    product.quantity -= quantity;
    await this.productRepository.save(product);

    // Возвращаем созданный чек с подробностями
    return this.salesReceiptRepository.findOne({
      where: { id: salesReceipt.id },
      relations: ['items', 'cashier', 'cashShift', 'cashOperation'],
    });
  }

  async getDailySummary(shopId: string, date: string): Promise<any> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // Получаем все смены за день
    const shifts = await this.cashShiftRepository.find({
      where: [
        { shopId, startTime: Between(targetDate, endDate) },
        { shopId, endTime: Between(targetDate, endDate) },
        {
          shopId,
          startTime: LessThan(targetDate),
          endTime: IsNull(), // открытые смены, начавшиеся до указанной даты
        },
      ],
      relations: ['openedBy', 'closedBy', 'cashRegister'],
    });

    // Получаем все операции за день
    const operations = await this.cashOperationRepository.find({
      where: { shopId, createdAt: Between(targetDate, endDate) },
    });

    // Рассчитываем метрики за день
    let totalCashSales = 0;
    let totalCardSales = 0;
    let totalQrSales = 0;
    let totalSalesCount = 0;
    let totalServicesCount = 0;
    let totalReturnsCount = 0;
    let totalCashWithdraws = 0;
    let totalCashDeposits = 0;

    operations.forEach((op) => {
      if (op.operationType === CashOperationType.SALE) {
        totalSalesCount++;
        switch (op.paymentMethod) {
          case PaymentMethodType.CASH:
            totalCashSales += op.amount;
            break;
          case PaymentMethodType.CARD:
            totalCardSales += op.amount;
            break;
          case PaymentMethodType.QR:
            totalQrSales += op.amount;
            break;
        }
      } else if (op.operationType === CashOperationType.SERVICE) {
        totalServicesCount++;
        switch (op.paymentMethod) {
          case PaymentMethodType.CASH:
            totalCashSales += op.amount;
            break;
          case PaymentMethodType.CARD:
            totalCardSales += op.amount;
            break;
          case PaymentMethodType.QR:
            totalQrSales += op.amount;
            break;
        }
      } else if (op.operationType === CashOperationType.RETURN) {
        totalReturnsCount++;
      } else if (op.operationType === CashOperationType.WITHDRAWAL) {
        totalCashWithdraws += op.amount;
      } else if (op.operationType === CashOperationType.DEPOSIT) {
        totalCashDeposits += op.amount;
      }
    });

    return {
      date: targetDate,
      totalSales: totalCashSales + totalCardSales + totalQrSales,
      cashSales: totalCashSales,
      cardSales: totalCardSales,
      qrSales: totalQrSales,
      salesCount: totalSalesCount,
      servicesCount: totalServicesCount,
      totalTransactionsCount: totalSalesCount + totalServicesCount,
      returnsCount: totalReturnsCount,
      cashWithdraws: totalCashWithdraws,
      cashDeposits: totalCashDeposits,
      shiftsCount: shifts.length,
      activeShifts: shifts.filter((s) => s.status === CashShiftStatus.OPEN)
        .length,
    };
  }
}
