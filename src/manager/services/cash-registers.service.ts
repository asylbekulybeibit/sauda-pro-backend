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
import { CreateCashRegisterDto } from '../dto/cash-registers/create-cash-register.dto';
import { PaymentMethodDto } from '../dto/payment-methods/payment-method.dto';

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
      dto: createCashRegisterDto,
      warehouseId: warehouseId,
    });

    // Создаем кассу
    const cashRegister = this.cashRegisterRepository.create({
      name: createCashRegisterDto.name,
      type: createCashRegisterDto.type,
      location: createCashRegisterDto.location,
      warehouseId: warehouseId,
      status: CashRegisterStatus.ACTIVE,
      isActive: true,
    });

    console.log('Created cash register entity:', cashRegister);

    const savedRegister = await this.cashRegisterRepository.save(cashRegister);
    console.log('Saved cash register:', savedRegister);

    // Создаем методы оплаты для кассы
    const paymentMethods = createCashRegisterDto.paymentMethods.map((method) =>
      this.paymentMethodRepository.create({
        cashRegisterId: cashRegister.id,
        source: method.source,
        systemType: method.systemType,
        name: method.name,
        code: method.code,
        description: method.description,
        isActive: method.isActive ?? true,
        status: method.status ?? PaymentMethodStatus.ACTIVE,
      })
    );

    await this.paymentMethodRepository.save(paymentMethods);

    return this.findOne(cashRegister.id, warehouseId);
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

    // Получаем все существующие методы оплаты
    const existingMethods = await this.paymentMethodRepository.find({
      where: { cashRegisterId: id },
    });

    // Создаем Map существующих методов для быстрого поиска
    const existingMethodsMap = new Map(
      existingMethods.map((method) => [this.getMethodKey(method), method])
    );

    // Подготавливаем новые методы и обновляем существующие
    const methodsToSave = paymentMethods.map((method) => {
      const key = this.getMethodKey(method);
      const existingMethod = existingMethodsMap.get(key);

      if (existingMethod) {
        // Обновляем существующий метод
        existingMethod.isActive = method.isActive;
        existingMethod.status = method.status;
        existingMethodsMap.delete(key); // Удаляем из мапы, чтобы отследить неиспользуемые методы
        return existingMethod;
      } else {
        // Создаем новый метод
        const paymentMethod = new RegisterPaymentMethod();
        paymentMethod.cashRegisterId = id;
        paymentMethod.source = method.source;
        paymentMethod.systemType = method.systemType;
        paymentMethod.name = method.name;
        paymentMethod.code = method.code;
        paymentMethod.description = method.description;
        paymentMethod.isActive = method.isActive;
        paymentMethod.status = method.status;
        return paymentMethod;
      }
    });

    // Все оставшиеся в мапе методы помечаем как неактивные
    const methodsToDeactivate = Array.from(existingMethodsMap.values()).map(
      (method) => {
        method.isActive = false;
        method.status = PaymentMethodStatus.INACTIVE;
        return method;
      }
    );

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
      return `${method.source}_${method.systemType}`;
    }
    if (method.source === PaymentMethodSource.CUSTOM && method.code) {
      return `${method.source}_${method.code}`;
    }
    throw new BadRequestException('Invalid payment method data');
  }
}
