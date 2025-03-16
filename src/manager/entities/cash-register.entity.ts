import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { CashShift } from './cash-shift.entity';
import { CashOperation } from './cash-operation.entity';
import { RegisterPaymentMethod } from './register-payment-method.entity';

export enum CashRegisterType {
  STATIONARY = 'STATIONARY',
  MOBILE = 'MOBILE',
  EXPRESS = 'EXPRESS',
  SELF_SERVICE = 'SELF_SERVICE',
}

export enum CashRegisterStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

@Entity('cash_registers')
export class CashRegister {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shop, (shop) => shop.cashRegisters)
  shop: Shop;

  @Column()
  shopId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: CashRegisterType,
    default: CashRegisterType.STATIONARY,
  })
  type: CashRegisterType;

  @Column({ nullable: true })
  location: string;

  @Column({
    type: 'enum',
    enum: CashRegisterStatus,
    default: CashRegisterStatus.ACTIVE,
  })
  status: CashRegisterStatus;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => CashShift, (shift) => shift.cashRegister)
  shifts: CashShift[];

  @OneToMany(() => CashOperation, (operation) => operation.cashRegister)
  operations: CashOperation[];

  @OneToMany(
    () => RegisterPaymentMethod,
    (paymentMethod) => paymentMethod.cashRegister
  )
  paymentMethods: RegisterPaymentMethod[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
