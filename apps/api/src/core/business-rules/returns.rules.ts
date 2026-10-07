import { BadRequestException } from '@nestjs/common';

export class ReturnsRules {
  static validateReturnLimits(returnedQty: number, existingReturned: number, soldQty: number): void {
    if (returnedQty <= 0) {
      throw new BadRequestException('Return quantity must be positive.');
    }
    if (existingReturned + returnedQty > soldQty) {
      throw new BadRequestException(
        `Cannot return quantity ${returnedQty}. Already returned: ${existingReturned}, Max allowed: ${soldQty}`
      );
    }
  }

  static validateRefundLimits(refundAmount: number, previouslyRefunded: number, paidAmount: number): void {
    if (refundAmount < 0) {
      throw new BadRequestException('Refund amount cannot be negative.');
    }
    if (previouslyRefunded + refundAmount > paidAmount + 0.01) {
      throw new BadRequestException('Total refund amount exceeds original invoice payment.');
    }
  }
}
