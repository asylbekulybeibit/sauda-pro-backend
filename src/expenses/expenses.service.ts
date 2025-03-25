import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>
  ) {}

  async create(createExpenseDto: CreateExpenseDto): Promise<Expense> {
    const expense = this.expenseRepository.create(createExpenseDto);
    return this.expenseRepository.save(expense);
  }

  async findAll(warehouseId: string): Promise<Expense[]> {
    return this.expenseRepository.find({
      where: { warehouseId },
      order: { date: 'DESC' },
    });
  }

  async findByDateRange(
    warehouseId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Expense[]> {
    return this.expenseRepository.find({
      where: {
        warehouseId,
        date: Between(startDate, endDate),
      },
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID "${id}" not found`);
    }

    return expense;
  }

  async update(
    id: string,
    updateExpenseDto: UpdateExpenseDto
  ): Promise<Expense> {
    const expense = await this.findOne(id);
    Object.assign(expense, updateExpenseDto);
    return this.expenseRepository.save(expense);
  }

  async remove(id: string): Promise<void> {
    const result = await this.expenseRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Expense with ID "${id}" not found`);
    }
  }

  async getExpensesByCategory(
    warehouseId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ category: string; total: number }[]> {
    const expenses = await this.findByDateRange(
      warehouseId,
      startDate,
      endDate
    );
    const expensesByCategory = new Map<string, number>();

    expenses.forEach((expense) => {
      const currentTotal = expensesByCategory.get(expense.category) || 0;
      expensesByCategory.set(expense.category, currentTotal + expense.amount);
    });

    return Array.from(expensesByCategory.entries()).map(
      ([category, total]) => ({
        category,
        total,
      })
    );
  }

  async getTotalExpenses(
    warehouseId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const expenses = await this.findByDateRange(
      warehouseId,
      startDate,
      endDate
    );
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  }
}
