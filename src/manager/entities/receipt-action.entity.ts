import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity';
import { User } from '../../users/entities/user.entity';

export enum ReceiptType {
  SALES = 'sales',
  SERVICE = 'service',
}

export enum ReceiptActionType {
  PRINT = 'print',
  SEND_WHATSAPP = 'send_whatsapp',
}

export enum ReceiptActionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Entity('receipt_actions')
export class ReceiptAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column({
    type: 'enum',
    enum: ReceiptType,
  })
  receiptType: ReceiptType;

  @Column()
  receiptId: string;

  @Column({
    type: 'enum',
    enum: ReceiptActionType,
  })
  actionType: ReceiptActionType;

  @CreateDateColumn()
  actionTime: Date;

  @Column()
  performedBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performedBy' })
  performer: User;

  @Column({
    type: 'enum',
    enum: ReceiptActionStatus,
    default: ReceiptActionStatus.SUCCESS,
  })
  status: ReceiptActionStatus;

  @Column({ nullable: true, type: 'text' })
  additionalInfo: string;
}
