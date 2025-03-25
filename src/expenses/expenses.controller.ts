import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '../auth/types/role.type';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@ApiTags('Expenses')
@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.MANAGER, RoleType.OWNER)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Create expense' })
  create(@Body() createExpenseDto: CreateExpenseDto) {
    return this.expensesService.create(createExpenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all expenses' })
  @ApiQuery({ name: 'warehouseId', required: true })
  findAll(@Query('warehouseId') warehouseId: string) {
    return this.expensesService.findAll(warehouseId);
  }

  @Get('by-date-range')
  @ApiOperation({ summary: 'Get expenses by date range' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  findByDateRange(
    @Query('warehouseId') warehouseId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.expensesService.findByDateRange(
      warehouseId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Get expenses by category' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getExpensesByCategory(
    @Query('warehouseId') warehouseId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.expensesService.getExpensesByCategory(
      warehouseId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('total')
  @ApiOperation({ summary: 'Get total expenses' })
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getTotalExpenses(
    @Query('warehouseId') warehouseId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.expensesService.getTotalExpenses(
      warehouseId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by id' })
  findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update expense' })
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto) {
    return this.expensesService.update(id, updateExpenseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete expense' })
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
