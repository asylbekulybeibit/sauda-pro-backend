import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Receipt, ReceiptStatus } from '../entities/receipt.entity';
import { Client } from '../entities/client.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { GetSalesHistoryDto } from '../dto/sales/get-sales-history.dto';
import { CashOperation } from '../entities/cash-operation.entity';
import { CashOperationType, PaymentMethodStatus } from '../enums/common.enums';
import { Warehouse } from '../entities/warehouse.entity';
import { PaymentMethodSource } from '../enums/common.enums';
import { RegisterPaymentMethod } from '../entities/register-payment-method.entity';
import { CashRegister } from '../entities/cash-register.entity';
import { In } from 'typeorm';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(CashOperation)
    private readonly cashOperationRepository: Repository<CashOperation>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(RegisterPaymentMethod)
    private readonly paymentMethodRepository: Repository<RegisterPaymentMethod>,
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>
  ) {}

  private async getShopIdByWarehouseId(warehouseId: string): Promise<string> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId },
      select: ['shopId'],
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse.shopId;
  }

  async getSalesHistory(warehouseId: string, filters: GetSalesHistoryDto) {
    console.log('\n=== 🚀 getSalesHistory called ===');
    console.log('📝 Input parameters:', {
      warehouseId,
      filters,
      timestamp: new Date().toISOString(),
    });

    try {
      // Строим основной запрос
      const query = this.cashOperationRepository
        .createQueryBuilder('operation')
        .leftJoinAndSelect('operation.receipt', 'receipt')
        .leftJoinAndSelect('receipt.cashier', 'cashier')
        .leftJoinAndSelect('receipt.client', 'client')
        .leftJoinAndSelect('receipt.vehicle', 'vehicle')
        .leftJoinAndSelect('receipt.items', 'items')
        .leftJoinAndSelect('operation.paymentMethod', 'paymentMethod')
        .where('operation.warehouseId = :warehouseId', { warehouseId })
        .andWhere('operation.operationType IN (:...types)', {
          types: [CashOperationType.SALE, CashOperationType.RETURN],
        });

      console.log('🔧 Building query conditions...');

      // Добавляем фильтры
      if (filters.startDate) {
        console.log('📅 Adding startDate filter:', filters.startDate);
        query.andWhere('operation.createdAt >= :startDate', {
          startDate: new Date(filters.startDate),
        });
      }

      if (filters.endDate) {
        console.log('📅 Adding endDate filter:', filters.endDate);
        query.andWhere('operation.createdAt <= :endDate', {
          endDate: new Date(filters.endDate),
        });
      }

      if (filters.receiptType === 'sale') {
        console.log('💰 Adding sale filter');
        query.andWhere('operation.amount >= 0');
      } else if (filters.receiptType === 'return') {
        console.log('↩️ Adding return filter');
        query.andWhere('operation.amount < 0');
      }

      if (filters.cashierId) {
        console.log('👤 Adding cashierId filter:', filters.cashierId);
        query.andWhere('receipt.cashierId = :cashierId', {
          cashierId: filters.cashierId,
        });
      }

      if (filters.clientId) {
        console.log('🧑 Adding clientId filter:', filters.clientId);
        query.andWhere('receipt.clientId = :clientId', {
          clientId: filters.clientId,
        });
      }

      if (filters.vehicleId) {
        console.log('🚗 Adding vehicleId filter:', filters.vehicleId);
        query.andWhere('receipt.vehicleId = :vehicleId', {
          vehicleId: filters.vehicleId,
        });
      }

      if (filters.search) {
        console.log('🔍 Adding search filter:', filters.search);
        query.andWhere(
          "(LOWER(receipt.receiptNumber) LIKE LOWER(:search) OR LOWER(CONCAT(cashier.firstName, ' ', cashier.lastName)) LIKE LOWER(:search))",
          { search: `%${filters.search}%` }
        );
      }

      if (filters.paymentMethod) {
        console.log('💳 Adding paymentMethod filter:', filters.paymentMethod);
        query.andWhere('operation.paymentMethodId = :paymentMethodId', {
          paymentMethodId: filters.paymentMethod,
        });

        // Логируем SQL запрос для отладки
        console.log(
          '💳 SQL query with payment method filter:',
          query.getSql().replace(/\n/g, ' ').replace(/\s+/g, ' ')
        );
      }

      // Логируем финальный запрос
      console.log('📊 Query parameters:', query.getParameters());
      console.log('🔍 Generated SQL:', query.getSql());

      // Выполняем запрос
      console.log('⏳ Executing query...');
      const startTime = Date.now();

      try {
        const operations = await query
          .orderBy('operation.createdAt', 'DESC')
          .getMany();

        const executionTime = Date.now() - startTime;
        console.log(`⌛ Query executed in ${executionTime}ms`);

        // Добавляем детальное логирование
        console.log('📊 Operations statistics:', {
          total: operations.length,
          byType: operations.reduce(
            (acc, op) => {
              acc[op.operationType] = (acc[op.operationType] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
          dateRange: {
            earliest:
              operations.length > 0
                ? operations[operations.length - 1].createdAt
                : null,
            latest: operations.length > 0 ? operations[0].createdAt : null,
          },
        });

        // Трансформируем данные
        console.log('🔄 Transforming operations...');
        const transformedOperations = operations.map((operation) => ({
          id: operation.id,
          number: operation.receipt?.receiptNumber,
          createdAt: operation.createdAt,
          totalAmount: Number(operation.amount),
          paymentMethod: {
            id: operation.paymentMethod?.id,
            name:
              operation.paymentMethod?.source === PaymentMethodSource.SYSTEM
                ? this.translatePaymentMethod(
                    operation.paymentMethod?.systemType
                  )
                : operation.paymentMethod?.name,
          },
          cashier: operation.receipt?.cashier
            ? {
                id: operation.receipt.cashier.id,
                name: `${operation.receipt.cashier.firstName} ${operation.receipt.cashier.lastName}`.trim(),
              }
            : undefined,
          client: operation.receipt?.client
            ? {
                id: operation.receipt.client.id,
                name: operation.receipt.client.firstName,
              }
            : undefined,
          vehicle: operation.receipt?.vehicle
            ? {
                id: operation.receipt.vehicle.id,
                name: `${operation.receipt.vehicle.make} ${
                  operation.receipt.vehicle.model
                }${
                  operation.receipt.vehicle.client
                    ? ` (${operation.receipt.vehicle.client.firstName} ${operation.receipt.vehicle.client.lastName})`
                    : ''
                }`.trim(),
              }
            : undefined,
          items: operation.receipt?.items?.map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price),
            quantity: Number(item.quantity),
            amount: Number(item.amount),
          })),
        }));

        console.log('✅ Successfully completed getSalesHistory');
        return transformedOperations;
      } catch (dbError) {
        console.error('❌ Database error in getSalesHistory:', {
          error: dbError.message,
          query: query.getSql(),
          parameters: query.getParameters(),
          timestamp: new Date().toISOString(),
        });
        throw new Error('Failed to fetch sales history from database');
      }
    } catch (error) {
      console.error('❌ Error in getSalesHistory:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async getCashiers(warehouseId: string) {
    const cashierRoles = await this.userRoleRepository.find({
      where: {
        warehouseId,
        type: RoleType.CASHIER,
        isActive: true,
      },
      relations: ['user'],
      select: {
        user: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    });

    return cashierRoles.map((role) => role.user);
  }

  async getClients(warehouseId: string) {
    const shopId = await this.getShopIdByWarehouseId(warehouseId);
    console.log('🏪 Getting clients for shop:', shopId);

    const clients = await this.clientRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
      order: {
        firstName: 'ASC',
        lastName: 'ASC',
      },
    });

    console.log(`✅ Found ${clients.length} clients`);
    return clients;
  }

  async getVehicles(warehouseId: string) {
    const shopId = await this.getShopIdByWarehouseId(warehouseId);
    console.log('🏪 Getting vehicles for shop:', shopId);

    const vehicles = await this.vehicleRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      relations: {
        client: true,
      },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        client: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      order: {
        make: 'ASC',
        model: 'ASC',
      },
    });

    console.log(`✅ Found ${vehicles.length} vehicles`);
    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      name: `${vehicle.make} ${vehicle.model} ${vehicle.plateNumber}${
        vehicle.client
          ? ` (${vehicle.client.firstName} ${vehicle.client.lastName})`
          : ''
      }`.trim(),
    }));
  }

  async getReceiptDetails(warehouseId: string, operationId: string) {
    console.log('🔍 Getting receipt details for operation:', operationId);

    const operation = await this.cashOperationRepository.findOne({
      where: {
        id: operationId,
        warehouseId,
      },
      relations: {
        receipt: {
          cashier: true,
          client: true,
          vehicle: true,
          items: true,
        },
        paymentMethod: true,
      },
    });

    if (!operation || !operation.receipt) {
      throw new NotFoundException('Receipt not found');
    }

    return {
      id: operation.id,
      number: operation.receipt.receiptNumber,
      createdAt: operation.createdAt,
      totalAmount: Number(operation.amount),
      paymentMethod: {
        id: operation.paymentMethod?.id,
        name:
          operation.paymentMethod?.source === PaymentMethodSource.SYSTEM
            ? this.translatePaymentMethod(operation.paymentMethod?.systemType)
            : operation.paymentMethod?.name,
      },
      cashier: operation.receipt.cashier
        ? {
            id: operation.receipt.cashier.id,
            name: `${operation.receipt.cashier.firstName} ${operation.receipt.cashier.lastName}`.trim(),
          }
        : undefined,
      client: operation.receipt.client
        ? {
            id: operation.receipt.client.id,
            name: operation.receipt.client.firstName,
          }
        : undefined,
      vehicle: operation.receipt.vehicle
        ? {
            id: operation.receipt.vehicle.id,
            name: `${operation.receipt.vehicle.make} ${
              operation.receipt.vehicle.model
            }${
              operation.receipt.vehicle.client
                ? ` (${operation.receipt.vehicle.client.firstName} ${operation.receipt.vehicle.client.lastName})`
                : ''
            }`.trim(),
          }
        : undefined,
      items: operation.receipt.items?.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        amount: Number(item.amount),
      })),
    };
  }

  private translatePaymentMethod(systemType?: string): string {
    if (!systemType) return 'Н/Д';

    const lowerCaseType = systemType.toLowerCase();
    const translations: { [key: string]: string } = {
      cash: 'Наличные',
      card: 'Банковская карта',
      qr: 'QR-код',
      online: 'Онлайн оплата',
      transfer: 'Банковский перевод',
      mixed: 'Смешанная оплата',
      other: 'Другое',
    };

    return translations[lowerCaseType] || systemType || 'Н/Д';
  }

  async getPaymentMethods(warehouseId: string) {
    console.log('🔍 Getting payment methods for warehouse:', warehouseId);

    // Сначала получим активные кассы для склада
    const activeCashRegisters = await this.cashRegisterRepository.find({
      where: {
        warehouseId,
        isActive: true,
      },
      select: ['id'],
    });

    const activeCashRegisterIds = activeCashRegisters.map(
      (register) => register.id
    );
    console.log(
      `✅ Found ${activeCashRegisterIds.length} active cash registers with IDs:`,
      activeCashRegisterIds
    );

    // Запрос методов оплаты с учетом только активных касс
    const methods = await this.paymentMethodRepository.find({
      where: [
        // Методы активных касс
        {
          warehouseId,
          cashRegisterId: In(
            activeCashRegisterIds.length > 0
              ? activeCashRegisterIds
              : ['00000000-0000-0000-0000-000000000000']
          ), // добавляем фиктивный ID если нет активных касс
          isActive: true,
          status: PaymentMethodStatus.ACTIVE,
        },
        // Общие методы склада
        {
          warehouseId,
          isShared: true,
          isActive: true,
          status: PaymentMethodStatus.ACTIVE,
        },
        // Системные методы
        {
          warehouseId,
          source: PaymentMethodSource.SYSTEM,
          isActive: true,
          status: PaymentMethodStatus.ACTIVE,
        },
      ],
      relations: ['cashRegister'],
    });

    console.log('🔍 Raw methods before filtering:', methods.length);

    // Дополнительная фильтрация после получения данных
    // Отфильтруем методы, привязанные к неактивным кассам
    const filteredMethods = methods.filter((method) => {
      // Если это общий метод (isShared = true), показываем его независимо от статуса кассы
      if (method.isShared) {
        return true;
      }

      // Если метод привязан к кассе, проверяем активность кассы
      if (method.cashRegisterId) {
        // Метод разрешен только если его касса активна
        return activeCashRegisterIds.includes(method.cashRegisterId);
      }

      // Если метод не привязан к кассе (system без cashRegisterId), разрешаем его
      return true;
    });

    console.log('✅ Payment methods after filtering:', {
      beforeFiltering: methods.length,
      afterFiltering: filteredMethods.length,
      removed: methods.length - filteredMethods.length,
      methods: filteredMethods.map((m) => ({
        id: m.id,
        source: m.source,
        systemType: m.systemType,
        name: m.name,
        cashRegisterId: m.cashRegisterId,
        cashRegisterName: m.cashRegister?.name,
        cashRegisterIsActive: m.cashRegister?.isActive,
        isShared: m.isShared,
      })),
    });

    // Трансформируем результаты, добавляя переводы для системных методов
    const result = filteredMethods.map((method) => ({
      id: method.id,
      name:
        method.source === PaymentMethodSource.SYSTEM
          ? this.translatePaymentMethod(method.systemType)
          : method.name,
      systemType: method.systemType,
      source: method.source,
      cashRegister: method.cashRegister
        ? { id: method.cashRegister.id, name: method.cashRegister.name }
        : undefined,
    }));

    console.log('✅ Transformed payment methods:', {
      count: result.length,
    });

    return result;
  }
}
