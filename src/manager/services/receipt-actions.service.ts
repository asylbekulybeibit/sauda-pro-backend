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
  Receipt,
  ReceiptStatus,
  PaymentMethod,
} from '../entities/receipt.entity';

@Injectable()
export class ReceiptActionsService {
  constructor(
    @InjectRepository(ReceiptAction)
    private readonly receiptActionRepository: Repository<ReceiptAction>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>
  ) {}

  async create(
    createReceiptActionDto: CreateReceiptActionDto,
    warehouseId: string,
    userId: string
  ): Promise<ReceiptAction> {
    // Проверка существования чека
    const receipt = await this.receiptRepository.findOne({
      where: { id: createReceiptActionDto.receiptId, warehouseId },
    });

    if (!receipt) {
      throw new NotFoundException('Чек не найден');
    }

    // Проверка статуса чека для печати или отправки
    if (
      receipt.status !== ReceiptStatus.PAID &&
      receipt.status !== ReceiptStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Можно выполнять действия только с оплаченными или возвращенными чеками'
      );
    }

    // Создаем действие
    const receiptAction = this.receiptActionRepository.create({
      receiptType: createReceiptActionDto.receiptType,
      receiptId: createReceiptActionDto.receiptId,
      actionType: createReceiptActionDto.actionType,
      warehouseId,
      performedBy: userId,
      status: ReceiptActionStatus.PENDING,
      additionalInfo: createReceiptActionDto.additionalInfo,
    });

    // Сохраняем действие
    return this.receiptActionRepository.save(receiptAction);
  }

  async findAll(warehouseId: string): Promise<ReceiptAction[]> {
    return this.receiptActionRepository.find({
      where: { warehouseId },
      relations: ['performer'],
      order: { actionTime: 'DESC' },
    });
  }

  async findOne(id: string, warehouseId: string): Promise<ReceiptAction> {
    const action = await this.receiptActionRepository.findOne({
      where: { id, warehouseId },
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
    warehouseId: string
  ): Promise<ReceiptAction> {
    const action = await this.findOne(id, warehouseId);

    // Обновляем поля действия
    Object.assign(action, updateReceiptActionDto);

    // Сохраняем обновленное действие
    return this.receiptActionRepository.save(action);
  }

  async printReceipt(id: string, warehouseId: string): Promise<ReceiptAction> {
    const action = await this.findOne(id, warehouseId);

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
    warehouseId: string
  ): Promise<ReceiptAction> {
    const action = await this.findOne(id, warehouseId);

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

  async sendReceiptEmail(
    id: string,
    warehouseId: string
  ): Promise<ReceiptAction> {
    const action = await this.findOne(id, warehouseId);

    // Проверяем, что действие является отправкой по email
    // Здесь нужен дополнительный тип в enum ReceiptActionType

    // Здесь будет логика отправки чека по Email
    // Это может быть использование сервиса отправки электронной почты

    // Обновляем статус действия
    action.status = ReceiptActionStatus.SUCCESS;

    return this.receiptActionRepository.save(action);
  }
}
