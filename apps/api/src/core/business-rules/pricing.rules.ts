export class PricingRules {
  static checkLossSale(sellingPrice: number, costPrice: number): { isLoss: boolean; marginPct: number } {
    const margin = sellingPrice - costPrice;
    const marginPct = costPrice > 0 ? (margin / costPrice) * 100 : 0;
    return {
      isLoss: sellingPrice <= costPrice,
      marginPct
    };
  }
}
