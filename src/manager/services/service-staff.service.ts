import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceStaff } from '../entities/service-staff.entity';
import { Service, ServiceStatus } from '../entities/service.entity';
import { Staff } from '../entities/staff.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class ServiceStaffService {
  constructor(
    @InjectRepository(ServiceStaff)
    private readonly serviceStaffRepository: Repository<ServiceStaff>,
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
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

  async findAllByService(serviceId: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    // Проверяем, что услуга существует и принадлежит этому магазину
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId, shopId },
    });

    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }

    return this.serviceStaffRepository.find({
      where: { serviceId },
      relations: ['staff'],
      order: { assignedAt: 'ASC' },
    });
  }

  async findOne(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const serviceStaff = await this.serviceStaffRepository.findOne({
      where: { id },
      relations: ['service', 'staff'],
    });

    if (!serviceStaff) {
      throw new NotFoundException('Запись о сотруднике услуги не найдена');
    }

    // Проверяем, что услуга принадлежит этому магазину
    const service = await this.serviceRepository.findOne({
      where: { id: serviceStaff.serviceId, shopId },
    });

    if (!service) {
      throw new ForbiddenException('Нет доступа к данной записи');
    }

    return serviceStaff;
  }

  async startWork(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const serviceStaff = await this.findOne(id, userId, shopId);

    // Проверяем, что услуга активна
    const service = await this.serviceRepository.findOne({
      where: { id: serviceStaff.serviceId },
    });

    if (service.status !== ServiceStatus.ACTIVE) {
      throw new BadRequestException(
        'Невозможно начать работу для неактивной услуги'
      );
    }

    // Если сотрудник уже начал работу, выдаем ошибку
    if (serviceStaff.startedWork) {
      throw new BadRequestException('Сотрудник уже начал работу');
    }

    // Обновляем время начала работы
    serviceStaff.startedWork = new Date();

    return this.serviceStaffRepository.save(serviceStaff);
  }

  async completeWork(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const serviceStaff = await this.findOne(id, userId, shopId);

    // Проверяем, что услуга активна
    const service = await this.serviceRepository.findOne({
      where: { id: serviceStaff.serviceId },
    });

    if (service.status !== ServiceStatus.ACTIVE) {
      throw new BadRequestException(
        'Невозможно завершить работу для неактивной услуги'
      );
    }

    // Проверяем, что сотрудник начал работу
    if (!serviceStaff.startedWork) {
      throw new BadRequestException('Сотрудник еще не начал работу');
    }

    // Если сотрудник уже завершил работу, выдаем ошибку
    if (serviceStaff.completedWork) {
      throw new BadRequestException('Сотрудник уже завершил работу');
    }

    // Обновляем время завершения работы
    serviceStaff.completedWork = new Date();

    return this.serviceStaffRepository.save(serviceStaff);
  }

  // Метод для проверки, завершили ли все сотрудники свою работу
  async checkAllStaffCompleted(
    serviceId: string,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    // Проверяем, что услуга существует и принадлежит этому магазину
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId, shopId },
    });

    if (!service) {
      throw new NotFoundException('Услуга не найдена');
    }

    // Находим всех сотрудников, назначенных на услугу
    const allServiceStaff = await this.serviceStaffRepository.find({
      where: { serviceId },
    });

    // Проверяем, все ли сотрудники завершили работу
    const allCompleted = allServiceStaff.every(
      (staff) => staff.completedWork !== null
    );

    return {
      serviceId,
      allCompleted,
      totalStaff: allServiceStaff.length,
      completedStaff: allServiceStaff.filter(
        (staff) => staff.completedWork !== null
      ).length,
    };
  }
}
