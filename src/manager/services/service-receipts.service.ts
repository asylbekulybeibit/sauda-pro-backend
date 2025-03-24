import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  ServiceReceipt,
  ServiceReceiptStatus,
} from '../entities/service-receipt.entity';
import { ServiceReceiptDetail } from '../entities/service-receipt-detail.entity';
import { CreateServiceReceiptDto } from '../dto/service-receipts/create-service-receipt.dto';
import { UpdateServiceReceiptDto } from '../dto/service-receipts/update-service-receipt.dto';
import {
  CashOperation,
  CashOperationType,
  PaymentMethodType,
} from '../entities/cash-operation.entity';
import { CashShift, CashShiftStatus } from '../entities/cash-shift.entity';
import { Service, ServiceStatus } from '../entities/service.entity';

@Injectable()
export class ServiceReceiptsService {
  constructor(
    @InjectRepository(ServiceReceipt)
    private readonly serviceReceiptRepository: Repository<ServiceReceipt>,
    @InjectRepository(ServiceReceiptDetail)
    private readonly serviceReceiptDetailRepository: Repository<ServiceReceiptDetail>,
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(CashShift)
    private readonly cashShiftRepository: Repository<CashShift>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>
  ) {}

  async create(
    createServiceReceiptDto: CreateServiceReceiptDto,
    shopId: string,
    cashierId: string
  ): Promise<ServiceReceipt> {
    // Проверяем существование смены
    const cashShift = await this.cashShiftRepository.findOne({
      where: { id: createServiceReceiptDto.cashShiftId, shopId },
    });

    if (!cashShift) {
      throw new NotFoundException(
        `Смена с ID ${createServiceReceiptDto.cashShiftId} не найдена`
      );
    }

    // Проверяем существование услуги
    const service = await this.serviceRepository.findOne({
      where: { id: createServiceReceiptDto.serviceId, shopId },
      relations: ['serviceType', 'client', 'vehicle'],
    });

    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }

    // Создаем чек услуги
    const serviceReceipt = await this.serviceReceiptRepository.save({
      ...createServiceReceiptDto,
      shopId,
      cashierId,
      status: createServiceReceiptDto.status || ServiceReceiptStatus.CREATED,
    });

    // Создаем детали чека
    if (
      createServiceReceiptDto.details &&
      createServiceReceiptDto.details.length > 0
    ) {
      const detailPromises = createServiceReceiptDto.details.map(
        async (detail) => {
          return await this.serviceReceiptDetailRepository.save({
            ...detail,
            serviceReceiptId: serviceReceipt.id,
            shopId,
          });
        }
      );

      await Promise.all(detailPromises);
    }

    // Если статус чека "Оплачен", создаем кассовую операцию
    if (serviceReceipt.status === ServiceReceiptStatus.PAID) {
      await this.createCashOperation(serviceReceipt);
    }

    // Возвращаем созданный чек с позициями
    return this.findOne(serviceReceipt.id, shopId);
  }

  async findAll(
    shopId: string,
    cashShiftId?: string,
    serviceId?: string,
    status?: string,
    fromDate?: string,
    toDate?: string
  ): Promise<ServiceReceipt[]> {
    const queryBuilder = this.serviceReceiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.details', 'details')
      .leftJoinAndSelect('receipt.cashier', 'cashier')
      .leftJoinAndSelect('receipt.service', 'service')
      .leftJoinAndSelect('receipt.cashShift', 'cashShift')
      .where('receipt.shopId = :shopId', { shopId });

    if (cashShiftId) {
      queryBuilder.andWhere('receipt.cashShiftId = :cashShiftId', {
        cashShiftId,
      });
    }

    if (serviceId) {
      queryBuilder.andWhere('receipt.serviceId = :serviceId', { serviceId });
    }

    if (status) {
      queryBuilder.andWhere('receipt.status = :status', { status });
    }

    if (fromDate) {
      const from = new Date(fromDate);
      queryBuilder.andWhere('receipt.createdAt >= :fromDate', {
        fromDate: from,
      });
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('receipt.createdAt <= :toDate', { toDate: to });
    }

    queryBuilder.orderBy('receipt.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, shopId: string): Promise<ServiceReceipt> {
    const receipt = await this.serviceReceiptRepository.findOne({
      where: { id, shopId },
      relations: [
        'details',
        'details.staff',
        'cashier',
        'service',
        'cashShift',
        'cashOperation',
      ],
    });

    if (!receipt) {
      throw new NotFoundException('Чек услуги не найден');
    }

    return receipt;
  }

  async update(
    id: string,
    updateServiceReceiptDto: UpdateServiceReceiptDto,
    shopId: string
  ): Promise<ServiceReceipt> {
    const receipt = await this.findOne(id, shopId);

    // Запрещаем изменение статуса чека в определенных случаях
    if (
      updateServiceReceiptDto.status &&
      receipt.status !== ServiceReceiptStatus.CREATED &&
      receipt.status !== updateServiceReceiptDto.status
    ) {
      throw new BadRequestException(
        `Невозможно изменить статус чека из ${receipt.status} в ${updateServiceReceiptDto.status}`
      );
    }

    // Обновляем поля чека
    Object.assign(receipt, updateServiceReceiptDto);

    // Сохраняем обновленный чек
    const updatedReceipt = await this.serviceReceiptRepository.save(receipt);

    // Если статус чека изменен на PAID, создаем кассовую операцию
    if (
      updateServiceReceiptDto.status === ServiceReceiptStatus.PAID &&
      !receipt.cashOperationId
    ) {
      await this.createCashOperation(updatedReceipt);
    }

    return this.findOne(id, shopId);
  }

  async cancel(id: string, shopId: string): Promise<ServiceReceipt> {
    const receipt = await this.findOne(id, shopId);

    if (receipt.status !== ServiceReceiptStatus.CREATED) {
      throw new BadRequestException(
        'Можно отменить только чек в статусе "Создан"'
      );
    }

    receipt.status = ServiceReceiptStatus.CANCELLED;
    return this.serviceReceiptRepository.save(receipt);
  }

  async refund(id: string, shopId: string): Promise<ServiceReceipt> {
    const receipt = await this.findOne(id, shopId);

    if (receipt.status !== ServiceReceiptStatus.PAID) {
      throw new BadRequestException('Можно возвратить только оплаченный чек');
    }

    receipt.status = ServiceReceiptStatus.REFUNDED;

    // Создаем операцию возврата
    if (receipt.cashOperationId) {
      const cashOperation = await this.cashOperationRepository.findOne({
        where: { id: receipt.cashOperationId },
      });

      if (cashOperation) {
        const refundOperation = this.cashOperationRepository.create({
          cashRegisterId: cashOperation.cashRegisterId,
          shiftId: cashOperation.shiftId,
          operationType: CashOperationType.RETURN,
          amount: cashOperation.amount,
          paymentMethod: cashOperation.paymentMethod,
        });

        await this.cashOperationRepository.save(refundOperation);
      }
    }

    return this.serviceReceiptRepository.save(receipt);
  }

  private async createCashOperation(receipt: ServiceReceipt): Promise<void> {
    let paymentMethodType: PaymentMethodType;

    // Маппинг методов оплаты из чека в типы операций
    switch (receipt.paymentMethod.toLowerCase()) {
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

    // Найдем информацию о смене для получения cashRegisterId, если нужно
    const cashShift = await this.cashShiftRepository.findOne({
      where: { id: receipt.cashShiftId },
    });

    if (!cashShift) {
      throw new NotFoundException('Кассовая смена не найдена');
    }

    // Создаем операцию
    const cashOperation = await this.cashOperationRepository.save({
      cashRegisterId: cashShift.cashRegisterId,
      shiftId: receipt.cashShiftId,
      orderId: receipt.serviceId, // ID услуги как orderId
      operationType: CashOperationType.SERVICE,
      amount: receipt.finalAmount,
      paymentMethod: paymentMethodType,
      shopId: receipt.shopId,
      userId: receipt.cashierId,
    });

    // Привязываем операцию к чеку
    receipt.cashOperationId = cashOperation.id;
    await this.serviceReceiptRepository.save(receipt);

    // Если метод оплаты - наличные, обновляем сумму в кассе
    if (paymentMethodType === PaymentMethodType.CASH) {
      cashShift.currentAmount += receipt.finalAmount;
      await this.cashShiftRepository.save(cashShift);
    }

    // Обновляем информацию о кассире в услуге
    await this.serviceRepository.update(receipt.serviceId, {
      cashierId: receipt.cashierId,
    });
  }
}
