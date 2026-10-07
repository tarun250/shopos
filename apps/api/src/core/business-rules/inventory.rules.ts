import { BadRequestException } from '@nestjs/common';

export class InventoryRules {
  static validateDeduction(available: number, required: number, allowNegative: boolean): void {
    if (required <= 0) {
      throw new BadRequestException('Required stock quantity must be positive.');
    }
    if (available < required && !allowNegative) {
      throw new BadRequestException(`Insufficient stock. Available: ${available}, Required: ${required}`);
    }
  }
}
