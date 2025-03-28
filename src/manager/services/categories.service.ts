import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/categories/create-category.dto';
import { UserRole } from '../../roles/entities/user-role.entity';
import { RoleType } from '../../auth/types/role.type';
import { Logger } from '@nestjs/common';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>
  ) {}

  private async validateManagerAccess(userId: string, shopId: string) {
    // Проверяем роль менеджера магазина
    const shopManagerRole = await this.userRoleRepository.findOne({
      where: {
        userId,
        shopId,
        type: RoleType.MANAGER,
        isActive: true,
      },
    });

    if (!shopManagerRole) {
      throw new ForbiddenException(
        'У вас нет прав для управления этим магазином'
      );
    }
  }

  async create(createCategoryDto: CreateCategoryDto, userId: string) {
    // Проверяем доступ менеджера к магазину
    await this.validateManagerAccess(userId, createCategoryDto.shopId);

    this.logger.log(
      `[create] Создание новой категории: ${createCategoryDto.name} для магазина ${createCategoryDto.shopId}`
    );

    // Если указана родительская категория, проверяем её существование и принадлежность к тому же магазину
    if (createCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });

      if (!parentCategory) {
        throw new NotFoundException('Родительская категория не найдена');
      }

      if (parentCategory.shopId !== createCategoryDto.shopId) {
        throw new ForbiddenException(
          'Родительская категория принадлежит другому магазину'
        );
      }
    }

    // Создаем категорию с привязкой к конкретному магазину
    const category = this.categoryRepository.create({
      ...createCategoryDto,
      isActive: true,
    });

    return this.categoryRepository.save(category);
  }

  async findByShop(shopId: string, userId: string) {
    // Проверяем доступ менеджера
    await this.validateManagerAccess(userId, shopId);

    this.logger.log(
      `[findByShop] Получение категорий для магазина ${shopId}, userId=${userId}`
    );

    // Возвращаем категории с фильтрацией по shopId
    return this.categoryRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      relations: ['parent', 'children'],
      order: {
        name: 'ASC',
      },
    });
  }

  async findAll(userId: string, shopId: string) {
    // Проверяем доступ менеджера
    await this.validateManagerAccess(userId, shopId);

    this.logger.log(
      `[findAll] Получение всех категорий для магазина ${shopId}`
    );

    // Возвращаем категории только для определенного магазина
    return this.categoryRepository.find({
      where: {
        shopId,
        isActive: true,
      },
      relations: ['parent', 'children'],
      order: {
        name: 'ASC',
      },
    });
  }

  async findOne(id: string, userId: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    await this.validateManagerAccess(userId, category.shopId);

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: Partial<CreateCategoryDto>,
    userId: string
  ) {
    const category = await this.findOne(id, userId);

    if (
      updateCategoryDto.shopId &&
      updateCategoryDto.shopId !== category.shopId
    ) {
      throw new ForbiddenException('Нельзя изменить магазин категории');
    }

    // Проверяем новую родительскую категорию
    if (
      updateCategoryDto.parentId &&
      updateCategoryDto.parentId !== category.parentId
    ) {
      const newParent = await this.categoryRepository.findOne({
        where: { id: updateCategoryDto.parentId },
      });

      if (!newParent) {
        throw new NotFoundException('Родительская категория не найдена');
      }

      if (newParent.shopId !== category.shopId) {
        throw new ForbiddenException(
          'Родительская категория принадлежит другому магазину'
        );
      }

      // Проверяем, не является ли новая родительская категория потомком текущей
      if (await this.isDescendant(category.id, updateCategoryDto.parentId)) {
        throw new ForbiddenException(
          'Нельзя создать циклическую зависимость категорий'
        );
      }
    }

    Object.assign(category, updateCategoryDto);
    return this.categoryRepository.save(category);
  }

  async remove(id: string, userId: string) {
    const category = await this.findOne(id, userId);

    // Проверяем наличие активных подкатегорий
    const hasActiveChildren = await this.categoryRepository.count({
      where: {
        parentId: id,
        isActive: true,
      },
    });

    if (hasActiveChildren > 0) {
      throw new ForbiddenException(
        'Нельзя удалить категорию с активными подкатегориями'
      );
    }

    category.isActive = false;
    return this.categoryRepository.save(category);
  }

  private async isDescendant(
    parentId: string,
    childId: string
  ): Promise<boolean> {
    const child = await this.categoryRepository.findOne({
      where: { id: childId },
      relations: ['parent'],
    });

    if (!child || !child.parent) {
      return false;
    }

    if (child.parent.id === parentId) {
      return true;
    }

    return this.isDescendant(parentId, child.parent.id);
  }
}
