export class ReturnItemDto {
  receiptItemId: string;
  quantity: number;
}

export class CreateReturnDto {
  items: ReturnItemDto[];
  reason: string;
}
