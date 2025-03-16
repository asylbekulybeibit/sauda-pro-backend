import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { CashRegister } from './cash-register.entity';
import { PaymentMethodType } from './cash-operation.entity';

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

  @ManyToOne(() => CashRegister, (register) => register.paymentMethods)
  cashRegister: CashRegister;

  @Column()
  cashRegisterId: string;

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

  @CreateDateColumn()
  createdAt: Date;
}
