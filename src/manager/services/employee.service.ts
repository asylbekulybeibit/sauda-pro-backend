import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEmployeeDto } from '../dto/staff/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/staff/update-employee.dto';
import { Staff } from '../entities/staff.entity';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';

@Injectable()
export class EmployeeService {
  constructor(
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

  async create(
    createEmployeeDto: CreateEmployeeDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const employee = this.staffRepository.create({
      ...createEmployeeDto,
      shopId,
    });

    return this.staffRepository.save(employee);
  }

  async findAll(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.staffRepository.find({
      where: { shopId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findAllActive(userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    return this.staffRepository.find({
      where: { shopId, isActive: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findOne(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const employee = await this.staffRepository.findOne({
      where: { id, shopId },
    });

    if (!employee) {
      throw new NotFoundException('Сотрудник не найден');
    }

    return employee;
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
    userId: string,
    shopId: string
  ) {
    await this.validateManagerAccess(userId, shopId);

    const employee = await this.findOne(id, userId, shopId);

    // Обновляем только те поля, которые переданы в DTO
    Object.assign(employee, updateEmployeeDto);

    return this.staffRepository.save(employee);
  }

  async remove(id: string, userId: string, shopId: string) {
    await this.validateManagerAccess(userId, shopId);

    const employee = await this.findOne(id, userId, shopId);

    // Мягкое удаление - устанавливаем isActive в false
    employee.isActive = false;

    return this.staffRepository.save(employee);
  }
}
