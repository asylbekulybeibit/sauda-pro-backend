import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CashRegister,
  CashRegisterStatus,
} from '../entities/cash-register.entity';
import {
  RegisterPaymentMethod,
  PaymentMethodSource,
  PaymentMethodStatus,
} from '../entities/register-payment-method.entity';
import { PaymentMethodType } from '../entities/cash-operation.entity';
import { PaymentMethodDto } from '../dto/payment-methods/payment-method.dto';
import { CreateCashRegisterDto } from '../dto/cash-registers/create-cash-register.dto';

@Injectable()
export class CashRegistersService {
  constructor(
    @InjectRepository(CashRegister)
    private cashRegisterRepository: Repository<CashRegister>,
    @InjectRepository(RegisterPaymentMethod)
    private paymentMethodRepository: Repository<RegisterPaymentMethod>
  ) {}

  async create(
    createCashRegisterDto: CreateCashRegisterDto,
    warehouseId: string
  ): Promise<CashRegister> {
    console.log('Creating cash register with data:', {
      createCashRegisterDto,
      warehouseId,
    });

    // Создаем кассовый аппарат
    const cashRegister = new CashRegister();
    cashRegister.name = createCashRegisterDto.name;
    cashRegister.type = createCashRegisterDto.type;
    cashRegister.warehouseId = warehouseId;
    cashRegister.location = createCashRegisterDto.location;
    cashRegister.status = CashRegisterStatus.ACTIVE;

    try {
      // Сначала сохраняем сам кассовый аппарат
      const savedRegister =
        await this.cashRegisterRepository.save(cashRegister);
      console.log('Saved cash register:', savedRegister);

      // Инициализируем методы оплаты
      const paymentMethods = createCashRegisterDto.paymentMethods.map(
        (method) => this.initializeEmptyPaymentMethod(method, savedRegister.id)
      );

      await this.paymentMethodRepository.save(paymentMethods);

      return this.findOne(savedRegister.id, warehouseId);
    } catch (error) {
      console.error('Error creating cash register:', error);
      throw error;
    }
  }

  async findAllByWarehouse(warehouseId: string): Promise<CashRegister[]> {
    return this.cashRegisterRepository.find({
      where: { warehouseId, isActive: true },
      relations: ['paymentMethods'],
    });
  }

  async findOne(id: string, warehouseId: string): Promise<CashRegister> {
    const cashRegister = await this.cashRegisterRepository.findOne({
      where: { id, warehouseId, isActive: true },
      relations: ['paymentMethods'],
    });

    if (!cashRegister) {
      throw new NotFoundException('Cash register not found');
    }

    return cashRegister;
  }

  async updateStatus(
    id: string,
    status: string,
    warehouseId: string
  ): Promise<CashRegister> {
    const cashRegister = await this.findOne(id, warehouseId);

    if (
      !Object.values(CashRegisterStatus).includes(status as CashRegisterStatus)
    ) {
      throw new BadRequestException('Invalid status');
    }

    cashRegister.status = status as CashRegisterStatus;
    return this.cashRegisterRepository.save(cashRegister);
  }

  async remove(id: string, warehouseId: string): Promise<void> {
    const cashRegister = await this.findOne(id, warehouseId);
    cashRegister.isActive = false;
    await this.cashRegisterRepository.save(cashRegister);
  }

  async updatePaymentMethods(
    id: string,
    paymentMethods: PaymentMethodDto[],
    warehouseId: string
  ): Promise<CashRegister> {
    const register = await this.findOne(id, warehouseId);

    if (!register) {
      throw new NotFoundException('Касса не найдена');
    }

    // Загружаем текущие методы оплаты для этой кассы
    const existingMethods = await this.paymentMethodRepository.find({
      where: { cashRegisterId: id },
    });

    // Создаем маппинги для быстрого поиска
    const existingMethodsMap = new Map(
      existingMethods.map((method) => [this.getMethodKey(method), method])
    );

    const methodsToSave = [];
    const methodsToDeactivate = [];

    // Обрабатываем переданные методы оплаты
    for (const method of paymentMethods) {
      const methodKey = this.getMethodKey(method);

      if (!methodKey) {
        throw new BadRequestException('Invalid payment method data');
      }

      // Проверяем, существует ли этот метод оплаты
      if (existingMethodsMap.has(methodKey)) {
        // Обновляем существующий
        const existingMethod = existingMethodsMap.get(methodKey);
        existingMethod.isActive = method.isActive ?? true;
        existingMethod.status = method.status || PaymentMethodStatus.ACTIVE;

        // Если указано описание, обновляем его и accountDetails
        if (method.description) {
          existingMethod.description = method.description;
          existingMethod.accountDetails = method.description;
        }

        methodsToSave.push(existingMethod);
        existingMethodsMap.delete(methodKey); // Удаляем, чтобы пометить как обработанный
      } else {
        // Создаем новый метод оплаты
        const newMethod = this.initializeEmptyPaymentMethod(method, id);
        methodsToSave.push(newMethod);
      }
    }

    // Оставшиеся методы оплаты нужно деактивировать
    for (const [_, method] of existingMethodsMap.entries()) {
      method.isActive = false;
      method.status = PaymentMethodStatus.INACTIVE;
      methodsToDeactivate.push(method);
    }

    // Сохраняем все изменения
    await this.paymentMethodRepository.save([
      ...methodsToSave,
      ...methodsToDeactivate,
    ]);

    return this.findOne(id, warehouseId);
  }

  // Вспомогательный метод для создания уникального ключа метода оплаты
  private getMethodKey(method: {
    source: string;
    systemType?: string;
    code?: string;
  }): string {
    if (method.source === PaymentMethodSource.SYSTEM && method.systemType) {
      return `system-${method.systemType}`;
    } else if (method.source === PaymentMethodSource.CUSTOM && method.code) {
      return `custom-${method.code}`;
    }
    return '';
  }

  // Инициализирует пустые методы оплаты с правильным балансом
  private initializeEmptyPaymentMethod(
    method: {
      source: PaymentMethodSource;
      systemType?: PaymentMethodType;
      name?: string;
      code?: string;
      isActive?: boolean;
      status?: PaymentMethodStatus;
      description?: string;
    },
    registerId: string
  ): RegisterPaymentMethod {
    const newMethod = new RegisterPaymentMethod();
    newMethod.cashRegisterId = registerId;
    newMethod.source = method.source;
    newMethod.systemType = method.systemType;
    newMethod.name = method.name;
    newMethod.code = method.code;
    newMethod.isActive = method.isActive ?? true;
    newMethod.status = method.status || PaymentMethodStatus.ACTIVE;
    newMethod.description = method.description || '';
    newMethod.currentBalance = 0; // Инициализируем с нулевым числовым балансом
    newMethod.accountDetails = method.description || '';

    return newMethod;
  }
}
