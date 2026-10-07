export class CreditRules {
  static isLimitBreached(currentBalance: number, newCredit: number, creditLimit: number): boolean {
    return currentBalance + newCredit > creditLimit;
  }
}
