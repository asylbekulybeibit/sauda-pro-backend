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
    private readonly cashOperationRepository: Repository<CashOperation>
  ) {}

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
            name: operation.paymentMethod?.name,
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
                number: operation.receipt.vehicle.plateNumber,
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
    const clients = await this.clientRepository.find({
      where: {
        warehouseId,
      },
      select: {
        id: true,
        firstName: true,
      },
    });

    return clients;
  }

  async getVehicles(warehouseId: string) {
    const vehicles = await this.vehicleRepository.find({
      where: {
        warehouseId,
      },
      select: {
        id: true,
        plateNumber: true,
      },
    });

    return vehicles;
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
            number: operation.receipt.vehicle.plateNumber,
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
}
