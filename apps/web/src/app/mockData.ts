import type { Customer, Product } from './types';

// ==========================================
// Mock Data Generators for fallback offline
// ==========================================

export function getMockProducts(): Product[] {
  return [
    {
      id: 'mock-led',
      sku: 'ELE-LED-9W',
      barcode: '8901234567890',
      name: 'Philips LED Bulb 9W B22',
      description: 'Cool day light energy saver LED bulb',
      rackLocation: 'Aisle 2, Row A',
      minimumProfitPct: 12.0,
      hsnCode: '85395200',
      cgstRate: 9.0,
      sgstRate: 9.0,
      igstRate: 18.0,
      baseUnit: { name: 'Piece', abbreviation: 'pc' },
      priceLevels: [],
      mrp: 150.0,
      level1Price: 120.0,
      level2Price: 110.0,
      level3Price: 90.0,
      emergencyPrice: 80.0,
      stockLevels: [{ quantity: 250, costPrice: 75.0, minStockLevel: 20 }],
    },
    {
      id: 'mock-spark',
      sku: 'AUT-SPK-M8',
      barcode: '4047024001234',
      name: 'Bosch Super Spark Plug M8',
      description: 'High performance copper core spark plug',
      rackLocation: 'Shelf B-1',
      minimumProfitPct: 15.0,
      hsnCode: '85111000',
      cgstRate: 14.0,
      sgstRate: 14.0,
      igstRate: 28.0,
      baseUnit: { name: 'Piece', abbreviation: 'pc' },
      priceLevels: [],
      mrp: 200.0,
      level1Price: 180.0,
      level2Price: 160.0,
      level3Price: 135.0,
      emergencyPrice: 120.0,
      stockLevels: [{ quantity: 120, costPrice: 110.0, minStockLevel: 15 }],
    },
    {
      id: 'mock-wire',
      sku: 'ELE-WIR-1.5',
      barcode: '8902345678901',
      name: 'Polycab 1.5 Sqmm Copper Wire (Red)',
      description: 'FR multi-strand single core copper cable 100m roll',
      rackLocation: 'Aisle 1, Rack D',
      minimumProfitPct: 10.0,
      hsnCode: '85444920',
      cgstRate: 9.0,
      sgstRate: 9.0,
      igstRate: 18.0,
      baseUnit: { name: 'Meter', abbreviation: 'm' },
      priceLevels: [],
      mrp: 20.0,
      level1Price: 15.0,
      level2Price: 13.5,
      level3Price: 11.0,
      emergencyPrice: 10.0,
      stockLevels: [{ quantity: 800, costPrice: 9.5, minStockLevel: 100 }],
    },
  ];
}

export function getMockCustomers(): Customer[] {
  return [
    {
      id: 'mock-tarun',
      name: 'Tarun Kumar',
      phone: '9876543210',
      email: 'tarun@gmail.com',
      address: 'Sector 62, Noida',
      priceLevel: 'WHOLESALE',
      creditLimit: 50000.0,
      balance: 1500.0,
      gstin: null,
    },
    {
      id: 'mock-abc',
      name: 'ABC Electricals',
      phone: '9988776655',
      email: 'abc@electricals.com',
      address: 'Andheri West, Mumbai',
      priceLevel: 'CONTRACTOR',
      creditLimit: 100000.0,
      balance: 0.0,
      gstin: null,
    },
  ];
}
