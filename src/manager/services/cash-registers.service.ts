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
import { RegisterPaymentMethod } from '../entities/register-payment-method.entity';
import {
  PaymentMethodType,
  PaymentMethodSource,
  PaymentMethodStatus,
} from '../enums/common.enums';
import { PaymentMethodDto } from '../dto/cash-registers/update-payment-methods.dto';
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
    const newRegister = new CashRegister();
    newRegister.name = createCashRegisterDto.name;
    newRegister.type = createCashRegisterDto.type;
    newRegister.location = createCashRegisterDto.location;
    newRegister.warehouseId = warehouseId;
    newRegister.status = CashRegisterStatus.ACTIVE;

    // Сохраняем кассу первым шагом
    const savedRegister = await this.cashRegisterRepository.save(newRegister);

    // Создаем методы оплаты для новой кассы
    const paymentMethods: RegisterPaymentMethod[] = [];

    // Убедимся, что у нас есть массив методов оплаты для обработки
    if (
      createCashRegisterDto.paymentMethods &&
      createCashRegisterDto.paymentMethods.length > 0
    ) {
      for (const method of createCashRegisterDto.paymentMethods) {
        // Проверяем, является ли метод общим для склада
        if (method.isShared) {
          // Если метод общий, создаем его только на уровне склада
          const sharedMethod = this.initializeSharedPaymentMethod(
            method,
            warehouseId
          );
          const savedSharedMethod =
            await this.paymentMethodRepository.save(sharedMethod);
          paymentMethods.push(savedSharedMethod);
        } else {
          // Если метод не общий, создаем его для конкретной кассы
          const registerMethod = this.initializeEmptyPaymentMethod(
            method,
            savedRegister.id
          );
          registerMethod.warehouseId = warehouseId; // Добавляем warehouseId для всех методов
          const savedRegisterMethod =
            await this.paymentMethodRepository.save(registerMethod);
          paymentMethods.push(savedRegisterMethod);
        }
      }
    }

    // Получаем обновленную кассу со всеми методами оплаты
    return this.findOne(savedRegister.id, warehouseId);
  }

  async findAllByWarehouse(warehouseId: string): Promise<CashRegister[]> {
    // Получаем все кассы склада с их прямыми методами оплаты
    const cashRegisters = await this.cashRegisterRepository.find({
      where: { warehouseId, isActive: true },
      relations: ['paymentMethods'],
    });

    // Если нет касс, возвращаем пустой массив
    if (cashRegisters.length === 0) {
      return [];
    }

    // Загружаем общие методы оплаты для этого склада
    const sharedPaymentMethods = await this.paymentMethodRepository.find({
      where: {
        warehouseId,
        isShared: true,
      },
    });

    // Если есть общие методы оплаты, добавляем их к каждой кассе
    if (sharedPaymentMethods.length > 0) {
      for (const register of cashRegisters) {
        // Создаем множество идентификаторов методов оплаты, которые уже присутствуют
        const existingMethodIds = new Set(
          register.paymentMethods.map((method) => method.id)
        );

        // Добавляем только те методы, которых ещё нет в списке
        for (const sharedMethod of sharedPaymentMethods) {
          if (!existingMethodIds.has(sharedMethod.id)) {
            register.paymentMethods.push(sharedMethod);
          }
        }
      }
    }

    return cashRegisters;
  }

  async findOne(id: string, warehouseId: string): Promise<CashRegister> {
    // Получаем кассу с её методами оплаты
    const cashRegister = await this.cashRegisterRepository.findOne({
      where: { id, warehouseId, isActive: true },
      relations: ['paymentMethods'],
    });

    if (!cashRegister) {
      throw new NotFoundException('Cash register not found');
    }

    // Дополнительно загружаем общие методы оплаты для этого склада
    const sharedPaymentMethods = await this.paymentMethodRepository.find({
      where: {
        warehouseId,
        isShared: true,
      },
    });

    // Добавляем общие методы в массив методов оплаты кассы, если их там ещё нет
    if (sharedPaymentMethods.length > 0) {
      // Создаем множество идентификаторов методов оплаты, которые уже присутствуют
      const existingMethodIds = new Set(
        cashRegister.paymentMethods.map((method) => method.id)
      );

      // Добавляем только те методы, которых ещё нет в списке
      for (const sharedMethod of sharedPaymentMethods) {
        if (!existingMethodIds.has(sharedMethod.id)) {
          cashRegister.paymentMethods.push(sharedMethod);
        }
      }
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
    console.log('updatePaymentMethods called with:', { id, warehouseId });
    console.log('paymentMethods:', JSON.stringify(paymentMethods, null, 2));

    // Получаем кассу
    const cashRegister = await this.findOne(id, warehouseId);
    if (!cashRegister) {
      throw new NotFoundException(`Касса с ID ${id} не найдена`);
    }

    // Если paymentMethods не определен или пустой массив, просто возвращаем текущую кассу
    if (!paymentMethods || paymentMethods.length === 0) {
      console.log(
        'No payment methods provided, returning current cash register'
      );
      return cashRegister;
    }

    // Получаем все текущие методы оплаты для этой кассы
    const currentMethods = await this.paymentMethodRepository.find({
      where: [
        { cashRegisterId: id },
        { warehouseId: warehouseId, isShared: true },
      ],
    });
    console.log('Current methods:', currentMethods.length);

    // Получаем ID всех методов, которые должны остаться (будем использовать для удаления неиспользуемых)
    const methodsMap = new Map<string, RegisterPaymentMethod>();
    currentMethods.forEach((method) => {
      const key = this.getMethodKey(method);
      methodsMap.set(key, method);
    });
    console.log('Methods keys in map:', Array.from(methodsMap.keys()));

    // Создаем массивы для новых методов и методов, которые будут обновлены
    const newMethods: RegisterPaymentMethod[] = [];
    const updatedMethods: RegisterPaymentMethod[] = [];

    // Обрабатываем каждый метод из DTO
    for (const methodDto of paymentMethods) {
      const key = this.getMethodKey(methodDto);
      console.log('Processing method:', methodDto, 'with key:', key);

      if (methodsMap.has(key)) {
        // Существующий метод - обновляем его
        console.log('Updating existing method with key:', key);
        const existingMethod = methodsMap.get(key)!;
        existingMethod.isActive = methodDto.isActive ?? existingMethod.isActive;
        existingMethod.status = methodDto.status ?? existingMethod.status;
        existingMethod.isShared = methodDto.isShared ?? existingMethod.isShared;

        if (methodDto.source === PaymentMethodSource.CUSTOM) {
          existingMethod.name = methodDto.name ?? existingMethod.name;
          existingMethod.code = methodDto.code ?? existingMethod.code;
          existingMethod.description =
            methodDto.description ?? existingMethod.description;
        }

        updatedMethods.push(existingMethod);
        methodsMap.delete(key); // Удаляем из карты, чтобы в конце остались только те, которые нужно удалить
      } else {
        // Новый метод - создаем его
        console.log('Creating new method with key:', key);
        if (methodDto.isShared) {
          // Если это общий метод, создаем его на уровне склада
          console.log('Creating shared method');
          const sharedMethod = this.initializeSharedPaymentMethod(
            methodDto,
            warehouseId
          );
          newMethods.push(sharedMethod);
        } else {
          // Если это обычный метод, создаем его для конкретной кассы
          console.log('Creating regular method for register:', id);
          const method = this.initializeEmptyPaymentMethod(methodDto, id);
          method.warehouseId = warehouseId;
          newMethods.push(method);
        }
      }
    }

    // Удаляем методы, которых нет в новом списке (но только те, которые принадлежат этой кассе)
    const methodsToRemove = Array.from(methodsMap.values()).filter(
      (method) => !method.isShared || method.cashRegisterId === id
    );

    console.log('Methods to remove:', methodsToRemove.length);
    if (methodsToRemove.length > 0) {
      await this.paymentMethodRepository.remove(methodsToRemove);
    }

    // Сохраняем обновленные методы
    console.log('Methods to update:', updatedMethods.length);
    if (updatedMethods.length > 0) {
      await this.paymentMethodRepository.save(updatedMethods);
    }

    // Сохраняем новые методы
    console.log('New methods to save:', newMethods.length);
    if (newMethods.length > 0) {
      await this.paymentMethodRepository.save(newMethods);
    }

    // Возвращаем обновленную кассу
    const result = await this.findOne(id, warehouseId);
    console.log(
      'Returning updated cash register with',
      result.paymentMethods.length,
      'payment methods'
    );
    return result;
  }

  // Вспомогательный метод для создания уникального ключа метода оплаты
  private getMethodKey(method: {
    source: string;
    systemType?: string;
    code?: string;
  }): string {
    console.log('Getting key for method:', method);

    if (method.source === PaymentMethodSource.SYSTEM && method.systemType) {
      const key = `system-${method.systemType}`;
      console.log('Generated system key:', key);
      return key;
    } else if (method.source === PaymentMethodSource.CUSTOM && method.code) {
      const key = `custom-${method.code}`;
      console.log('Generated custom key:', key);
      return key;
    }

    console.warn('Could not generate a key for method:', method);
    // Генерируем фейковый ключ для методов без кода, чтобы они не считались одинаковыми
    return `unknown-${Date.now()}-${Math.random()}`;
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
      isShared?: boolean;
    },
    registerId: string
  ): RegisterPaymentMethod {
    const paymentMethod = new RegisterPaymentMethod();
    paymentMethod.source = method.source;
    paymentMethod.cashRegisterId = registerId;
    paymentMethod.isShared = false; // Метод кассы по умолчанию не общий

    if (method.source === PaymentMethodSource.SYSTEM) {
      paymentMethod.systemType = method.systemType;
    } else {
      paymentMethod.name = method.name;
      paymentMethod.code = method.code;
      paymentMethod.description = method.description;
    }

    paymentMethod.isActive = method.isActive ?? true;
    paymentMethod.status = method.status ?? PaymentMethodStatus.ACTIVE;
    paymentMethod.currentBalance = 0;

    return paymentMethod;
  }

  private initializeSharedPaymentMethod(
    method: {
      source: PaymentMethodSource;
      systemType?: PaymentMethodType;
      name?: string;
      code?: string;
      isActive?: boolean;
      status?: PaymentMethodStatus;
      description?: string;
      isShared?: boolean;
    },
    warehouseId: string
  ): RegisterPaymentMethod {
    const paymentMethod = new RegisterPaymentMethod();
    paymentMethod.source = method.source;
    paymentMethod.warehouseId = warehouseId;
    paymentMethod.isShared = true; // Это общий метод оплаты для склада
    paymentMethod.cashRegisterId = null; // Не привязан к конкретной кассе

    if (method.source === PaymentMethodSource.SYSTEM) {
      paymentMethod.systemType = method.systemType;
    } else {
      paymentMethod.name = method.name;
      paymentMethod.code = method.code;
      paymentMethod.description = method.description;
    }

    paymentMethod.isActive = method.isActive ?? true;
    paymentMethod.status = method.status ?? PaymentMethodStatus.ACTIVE;
    paymentMethod.currentBalance = 0;

    return paymentMethod;
  }

  async getSharedPaymentMethods(
    warehouseId: string
  ): Promise<RegisterPaymentMethod[]> {
    return this.paymentMethodRepository.find({
      where: {
        warehouseId,
        isShared: true,
      },
    });
  }

  async getAllPaymentMethods(
    warehouseId: string
  ): Promise<RegisterPaymentMethod[]> {
    return this.paymentMethodRepository.find({
      where: [
        { warehouseId, isShared: true },
        { warehouseId, isShared: false },
      ],
      relations: ['cashRegister'],
    });
  }
}
