import { BadRequestException } from '@nestjs/common';

export class BillingRules {
  static validateLineItem(quantity: number, unitPrice: number, discount: number): void {
    if (quantity <= 0) {
      throw new BadRequestException('Line quantity must be positive.');
    }
    if (unitPrice < 0) {
      throw new BadRequestException('Line unit price cannot be negative.');
    }
    if (discount < 0 || discount > unitPrice) {
      throw new BadRequestException('Line discount cannot be negative or exceed unit price.');
    }
  }
}
