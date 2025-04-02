export enum PaymentMethodType {
  CASH = 'cash',
  CARD = 'card',
  QR = 'qr',
}

export enum PaymentMethodSource {
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CashOperationType {
  SALE = 'sale',
  RETURN = 'return',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  SERVICE = 'service',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  RETURN_WITHOUT_RECEIPT = 'return_without_receipt',
}
