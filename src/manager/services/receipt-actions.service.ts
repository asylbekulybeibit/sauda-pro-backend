import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ReceiptAction,
  ReceiptActionType,
  ReceiptActionStatus,
  ReceiptType,
} from '../entities/receipt-action.entity';
import { CreateReceiptActionDto } from '../dto/receipt-actions/create-receipt-action.dto';
import { UpdateReceiptActionDto } from '../dto/receipt-actions/update-receipt-action.dto';
import {
  SalesReceipt,
  SalesReceiptStatus,
} from '../entities/sales-receipt.entity';
import {
  ServiceReceipt,
  ServiceReceiptStatus,
} from '../entities/service-receipt.entity';

@Injectable()
export class ReceiptActionsService {
  constructor(
    @InjectRepository(ReceiptAction)
    private readonly receiptActionRepository: Repository<ReceiptAction>,
    @InjectRepository(SalesReceipt)
    private readonly salesReceiptRepository: Repository<SalesReceipt>,
    @InjectRepository(ServiceReceipt)
    private readonly serviceReceiptRepository: Repository<ServiceReceipt>
  ) {}

  async create(
    createReceiptActionDto: CreateReceiptActionDto,
    shopId: string,
    userId: string
  ): Promise<ReceiptAction> {
    // Проверка существования чека
    if (createReceiptActionDto.receiptType === ReceiptType.SALES) {
      const salesReceipt = await this.salesReceiptRepository.findOne({
        where: { id: createReceiptActionDto.receiptId, shopId },
      });

      if (!salesReceipt) {
        throw new NotFoundException('Чек продажи не найден');
      }

      // Проверка статуса чека для печати или отправки
      if (
        salesReceipt.status !== SalesReceiptStatus.PAID &&
        salesReceipt.status !== SalesReceiptStatus.REFUNDED
      ) {
        throw new BadRequestException(
          'Можно выполнять действия только с оплаченными или возвращенными чеками'
        );
      }
    } else if (createReceiptActionDto.receiptType === ReceiptType.SERVICE) {
      const serviceReceipt = await this.serviceReceiptRepository.findOne({
        where: { id: createReceiptActionDto.receiptId, shopId },
      });

      if (!serviceReceipt) {
        throw new NotFoundException('Чек услуги не найден');
      }

      // Проверка статуса чека для печати или отправки
      if (
        serviceReceipt.status !== ServiceReceiptStatus.PAID &&
        serviceReceipt.status !== ServiceReceiptStatus.REFUNDED
      ) {
        throw new BadRequestException(
          'Можно выполнять действия только с оплаченными или возвращенными чеками'
        );
      }
    } else {
      throw new BadRequestException(
        'Должен быть указан тип чека (продажа или услуга)'
      );
    }

    // Создаем действие
    const receiptAction = this.receiptActionRepository.create({
      receiptType: createReceiptActionDto.receiptType,
      receiptId: createReceiptActionDto.receiptId,
      actionType: createReceiptActionDto.actionType,
      shopId,
      performedBy: userId,
      status: ReceiptActionStatus.PENDING,
      additionalInfo: createReceiptActionDto.additionalInfo,
    });

    // Сохраняем действие
    return this.receiptActionRepository.save(receiptAction);
  }

  async findAll(shopId: string): Promise<ReceiptAction[]> {
    return this.receiptActionRepository.find({
      where: { shopId },
      relations: ['performer'],
      order: { actionTime: 'DESC' },
    });
  }

  async findOne(id: string, shopId: string): Promise<ReceiptAction> {
    const action = await this.receiptActionRepository.findOne({
      where: { id, shopId },
      relations: ['performer'],
    });

    if (!action) {
      throw new NotFoundException('Действие над чеком не найдено');
    }

    return action;
  }

  async update(
    id: string,
    updateReceiptActionDto: UpdateReceiptActionDto,
    shopId: string
  ): Promise<ReceiptAction> {
    const action = await this.findOne(id, shopId);

    // Обновляем поля действия
    Object.assign(action, updateReceiptActionDto);

    // Сохраняем обновленное действие
    return this.receiptActionRepository.save(action);
  }

  async printReceipt(id: string, shopId: string): Promise<ReceiptAction> {
    const action = await this.findOne(id, shopId);

    if (action.actionType !== ReceiptActionType.PRINT) {
      throw new BadRequestException('Действие не является печатью чека');
    }

    // Здесь будет логика печати чека
    // Это может быть вызов внешнего сервиса печати или
    // формирование задания в очередь для печати

    // Обновляем статус действия
    action.status = ReceiptActionStatus.SUCCESS;

    return this.receiptActionRepository.save(action);
  }

  async sendReceiptWhatsapp(
    id: string,
    shopId: string
  ): Promise<ReceiptAction> {
    const action = await this.findOne(id, shopId);

    if (action.actionType !== ReceiptActionType.SEND_WHATSAPP) {
      throw new BadRequestException(
        'Действие не является отправкой чека через WhatsApp'
      );
    }

    // Здесь будет логика отправки чека через WhatsApp
    // Это может быть интеграция с API WhatsApp Business или другим сервисом

    // Обновляем статус действия
    action.status = ReceiptActionStatus.SUCCESS;

    return this.receiptActionRepository.save(action);
  }

  async sendReceiptEmail(id: string, shopId: string): Promise<ReceiptAction> {
    const action = await this.findOne(id, shopId);

    // Проверяем, что действие является отправкой по email
    // Здесь нужен дополнительный тип в enum ReceiptActionType

    // Здесь будет логика отправки чека по Email
    // Это может быть использование сервиса отправки электронной почты

    // Обновляем статус действия
    action.status = ReceiptActionStatus.SUCCESS;

    return this.receiptActionRepository.save(action);
  }
}
