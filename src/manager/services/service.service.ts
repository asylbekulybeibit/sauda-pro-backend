import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateServiceDto } from '../dto/services/create-service.dto';
import { UpdateServiceDto } from '../dto/services/update-service.dto';
import { StartServiceDto } from '../dto/services/start-service.dto';
import { CompleteServiceDto } from '../dto/services/complete-service.dto';
import { Service, ServiceStatus } from '../entities/service.entity';
import { ServiceStaff } from '../entities/service-staff.entity';
import { ServiceType } from '../entities/service-type.entity';
import { Client } from '../entities/client.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Staff } from '../entities/staff.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(ServiceStaff)
    private readonly serviceStaffRepository: Repository<ServiceStaff>,
    @InjectRepository(ServiceType)
    private readonly serviceTypeRepository: Repository<ServiceType>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(userId: string, shopId: string) {
    const managerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
      relations: ['shop'],
    });

    if (!managerRole) {
      throw new ForbiddenException(
        'У вас нет прав менеджера для этого магазина'
      );
    }

    return managerRole;
  }

  private async validateServiceType(serviceTypeId: string, shopId: string) {
    const serviceType = await this.serviceTypeRepository.findOne({
      where: { id: serviceTypeId, shopId },
    });

    if (!serviceType) {
      throw new NotFoundException('Тип услуги не найден в данном магазине');
    }

    return serviceType;
  }

  private async validateClient(clientId: string, shopId: string) {
    const client = await this.clientRepository.findOne({
      where: { id: clientId, shopId },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден в данном магазине');
    }

    return client;
  }

  private async validateVehicle(vehicleId: string, shopId: string) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId, shopId },
    });

    if (!vehicle) {
      throw new NotFoundException('Автомобиль не найден в данном магазине');
    }

    return vehicle;
  }

  private async validateStaff(staffIds: string[], shopId: string) {
    const staff = await this.staffRepository.find({
      where: { id: In(staffIds), shopId, isActive: true },
    });

    if (staff.length !== staffIds.length) {
      throw new NotFoundException(
        'Один или несколько сотрудников не найдены в данном магазине'
      );
    }

    return staff;
  }

  async create(
    createServiceDto: CreateServiceDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    // Проверяем существование всех связанных сущностей
    const serviceType = await this.validateServiceType(
      createServiceDto.serviceTypeId,
      shopId
    );
    const client = await this.validateClient(createServiceDto.clientId, shopId);
    await this.validateVehicle(createServiceDto.vehicleId, shopId);
    const staff = await this.validateStaff(createServiceDto.staffIds, shopId);

    // Создаем услугу
    const service = this.serviceRepository.create({
      serviceTypeId: createServiceDto.serviceTypeId,
      clientId: createServiceDto.clientId,
      vehicleId: createServiceDto.vehicleId,
      shopId,
      status: createServiceDto.status || ServiceStatus.PENDING,
      originalPrice: serviceType.price,
      finalPrice: serviceType.price * (1 - client.discountPercent / 100),
      discountPercent: client.discountPercent,
      notes: createServiceDto.notes,
      createdBy: userId,
    });

    // Сохраняем услугу
    const savedService = await this.serviceRepository.save(service);

    // Создаем связи с сотрудниками
    const serviceStaffEntities = staff.map((staffMember) =>
      this.serviceStaffRepository.create({
        serviceId: savedService.id,
        staffId: staffMember.id,
      })
    );

    await this.serviceStaffRepository.save(serviceStaffEntities);

    // Возвращаем услугу с дополнительными данными
    return this.findOne(savedService.id, userId, shopId);
  }

  async findAll(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.serviceRepository.find({
      where: { shopId },
      relations: [
        'serviceType',
        'client',
        'vehicle',
        'serviceStaff',
        'serviceStaff.staff',
        'creator',
        'starter',
        'completer',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: ServiceStatus, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.serviceRepository.find({
      where: { shopId, status },
      relations: [
        'serviceType',
        'client',
        'vehicle',
        'serviceStaff',
        'serviceStaff.staff',
        'creator',
        'starter',
        'completer',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const service = await this.serviceRepository.findOne({
      where: { id, shopId },
      relations: [
        'serviceType',
        'client',
        'vehicle',
        'serviceStaff',
        'serviceStaff.staff',
        'creator',
        'starter',
        'completer',
      ],
    });

    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }

    return service;
  }

  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const service = await this.findOne(id, userId, shopId);

    // Проверяем существование всех связанных сущностей при обновлении
    let serviceType = service.serviceType;
    let client = service.client;

    if (updateServiceDto.serviceTypeId) {
      serviceType = await this.validateServiceType(
        updateServiceDto.serviceTypeId,
        shopId
      );
    }

    if (updateServiceDto.clientId) {
      client = await this.validateClient(updateServiceDto.clientId, shopId);
    }

    if (updateServiceDto.vehicleId) {
      await this.validateVehicle(updateServiceDto.vehicleId, shopId);
    }

    if (updateServiceDto.staffIds) {
      // Удаляем старые связи с сотрудниками
      await this.serviceStaffRepository.delete({ serviceId: service.id });

      // Проверяем и добавляем новых сотрудников
      const staff = await this.validateStaff(updateServiceDto.staffIds, shopId);

      // Создаем новые связи с сотрудниками
      const serviceStaffEntities = staff.map((staffMember) =>
        this.serviceStaffRepository.create({
          serviceId: service.id,
          staffId: staffMember.id,
        })
      );

      await this.serviceStaffRepository.save(serviceStaffEntities);
    }

    // Обновляем только те поля, которые переданы в DTO
    if (updateServiceDto.serviceTypeId) {
      service.serviceTypeId = updateServiceDto.serviceTypeId;
      service.originalPrice = serviceType.price;
      service.finalPrice =
        serviceType.price * (1 - client.discountPercent / 100);
    }

    if (updateServiceDto.clientId) {
      service.clientId = updateServiceDto.clientId;
      service.discountPercent = client.discountPercent;
      service.finalPrice =
        service.originalPrice * (1 - client.discountPercent / 100);
    }

    if (updateServiceDto.vehicleId) {
      service.vehicleId = updateServiceDto.vehicleId;
    }

    if (updateServiceDto.status) {
      service.status = updateServiceDto.status;
    }

    if (updateServiceDto.notes !== undefined) {
      service.notes = updateServiceDto.notes;
    }

    return this.serviceRepository.save(service);
  }

  async startService(
    id: string,
    startServiceDto: StartServiceDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const service = await this.findOne(id, userId, shopId);

    if (service.status !== ServiceStatus.PENDING) {
      throw new BadRequestException(
        'Только услуги со статусом "в ожидании" могут быть начаты'
      );
    }

    service.status = ServiceStatus.ACTIVE;
    service.startTime = new Date();
    service.startedBy = userId;

    if (startServiceDto.notes) {
      service.notes = service.notes
        ? `${service.notes}\n${startServiceDto.notes}`
        : startServiceDto.notes;
    }

    // Удаляем автоматическое обновление времени начала работы для сотрудников,
    // так как теперь это будет делаться индивидуально через ServiceStaffService

    return this.serviceRepository.save(service);
  }

  async completeService(
    id: string,
    completeServiceDto: CompleteServiceDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const service = await this.findOne(id, userId, shopId);

    if (service.status !== ServiceStatus.ACTIVE) {
      throw new BadRequestException(
        'Только услуги со статусом "активно" могут быть завершены'
      );
    }

    // Проверяем, завершили ли все сотрудники свою работу
    const allServiceStaff = await this.serviceStaffRepository.find({
      where: { serviceId: service.id },
    });

    const pendingStaff = allServiceStaff.filter(
      (staff) => staff.startedWork && !staff.completedWork
    );

    if (pendingStaff.length > 0) {
      throw new BadRequestException(
        `Не все сотрудники завершили свою работу. Ожидается завершение работы ${pendingStaff.length} сотрудников.`
      );
    }

    service.status = ServiceStatus.COMPLETED;
    service.endTime = new Date();
    service.completedBy = userId;

    if (completeServiceDto.notes) {
      service.notes = service.notes
        ? `${service.notes}\n${completeServiceDto.notes}`
        : completeServiceDto.notes;
    }

    // Удаляем автоматическое обновление времени завершения работы для сотрудников,
    // так как теперь это делается индивидуально через ServiceStaffService

    return this.serviceRepository.save(service);
  }

  async cancelService(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const service = await this.findOne(id, userId, shopId);

    if (service.status === ServiceStatus.COMPLETED) {
      throw new BadRequestException('Нельзя отменить завершенную услугу');
    }

    service.status = ServiceStatus.CANCELLED;

    return this.serviceRepository.save(service);
  }

  async remove(id: string, userId: string, shopId: string) {
    // Для удаления услуги, мы помечаем её отмененной
    return this.cancelService(id, userId, shopId);
  }
}
