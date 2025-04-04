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
import { CashOperationType } from '../enums/common.enums';
import { Warehouse } from '../entities/warehouse.entity';
import { PaymentMethodSource } from '../enums/common.enums';

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
    private readonly warehouseRepository: Repository<Warehouse>
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
        name: operation.paymentMethod?.name,
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
    const translations: { [key: string]: string } = {
      cash: 'Наличные',
      card: 'Банковская карта',
      qr: 'QR-код',
    };
    return translations[systemType?.toLowerCase() ?? ''] || systemType || 'Н/Д';
  }
}
