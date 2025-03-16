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
    shopId: string
  ): Promise<CashRegister> {
    console.log('Creating cash register with data:', {
      dto: createCashRegisterDto,
      shopId: shopId,
    });

    // Создаем кассу
    const cashRegister = this.cashRegisterRepository.create({
      name: createCashRegisterDto.name,
      type: createCashRegisterDto.type,
      location: createCashRegisterDto.location,
      shopId: shopId,
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
      })
    );

    await this.paymentMethodRepository.save(paymentMethods);

    return this.findOne(cashRegister.id, shopId);
  }

  async findAllByShop(shopId: string): Promise<CashRegister[]> {
    return this.cashRegisterRepository.find({
      where: { shopId, isActive: true },
      relations: ['paymentMethods'],
    });
  }

  async findOne(id: string, shopId: string): Promise<CashRegister> {
    const cashRegister = await this.cashRegisterRepository.findOne({
      where: { id, shopId, isActive: true },
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
    shopId: string
  ): Promise<CashRegister> {
    const cashRegister = await this.findOne(id, shopId);

    if (
      !Object.values(CashRegisterStatus).includes(status as CashRegisterStatus)
    ) {
      throw new BadRequestException('Invalid status');
    }

    cashRegister.status = status as CashRegisterStatus;
    return this.cashRegisterRepository.save(cashRegister);
  }

  async remove(id: string, shopId: string): Promise<void> {
    const cashRegister = await this.findOne(id, shopId);
    cashRegister.isActive = false;
    await this.cashRegisterRepository.save(cashRegister);
  }

  async updatePaymentMethods(
    id: string,
    paymentMethods: PaymentMethodDto[],
    shopId: string
  ): Promise<CashRegister> {
    const register = await this.findOne(id, shopId);

    // Remove existing payment methods
    await this.paymentMethodRepository.delete({ cashRegisterId: id });

    // Create new payment methods
    const newPaymentMethods = paymentMethods.map((method) => {
      const paymentMethod = new RegisterPaymentMethod();
      paymentMethod.cashRegisterId = id;
      paymentMethod.source = method.source;
      paymentMethod.systemType = method.systemType;
      paymentMethod.name = method.name;
      paymentMethod.code = method.code;
      paymentMethod.description = method.description;
      paymentMethod.isActive = method.isActive;
      return paymentMethod;
    });

    await this.paymentMethodRepository.save(newPaymentMethods);

    return this.findOne(id, shopId);
  }
}
