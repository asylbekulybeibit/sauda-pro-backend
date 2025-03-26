import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { CashRegister } from './cash-register.entity';
import { PaymentMethodType } from './cash-operation.entity';
import { PaymentMethodTransaction } from './payment-method-transaction.entity';
import { Warehouse } from './warehouse.entity';

export enum PaymentMethodSource {
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('register_payment_methods')
export class RegisterPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CashRegister, (register) => register.paymentMethods, {
    nullable: true,
  })
  @JoinColumn({ name: 'cashRegisterId' })
  cashRegister: CashRegister;

  @Column({ nullable: true })
  cashRegisterId: string;

  @Column()
  warehouseId: string;

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @Column({ default: false })
  isShared: boolean;

  @Column({
    type: 'enum',
    enum: PaymentMethodSource,
    default: PaymentMethodSource.SYSTEM,
  })
  source: PaymentMethodSource;

  @Column({
    type: 'enum',
    enum: PaymentMethodType,
    nullable: true,
  })
  systemType: PaymentMethodType;

  // Поля для кастомных методов оплаты
  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: PaymentMethodStatus,
    default: PaymentMethodStatus.ACTIVE,
  })
  status: PaymentMethodStatus;

  // Новые поля для отслеживания баланса
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  currentBalance: number;

  @Column({ nullable: true })
  accountDetails: string;

  // Связь с транзакциями
  @OneToMany(
    () => PaymentMethodTransaction,
    (transaction) => transaction.paymentMethod
  )
  transactions: PaymentMethodTransaction[];

  @CreateDateColumn()
  createdAt: Date;
}
