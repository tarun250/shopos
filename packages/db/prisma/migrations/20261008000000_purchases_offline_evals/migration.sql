-- AlterTable
ALTER TABLE "Bill" ADD COLUMN "clientRef" TEXT;
ALTER TABLE "Bill" ADD COLUMN "offlineCreatedAt" DATETIME;

-- CreateTable
CREATE TABLE "AgentEvalRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "total" INTEGER NOT NULL DEFAULT 0,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "results" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "receivedQuantity" REAL NOT NULL DEFAULT 0.0,
    "costPrice" REAL NOT NULL,
    "cgstRate" REAL NOT NULL DEFAULT 0.0,
    "cgstAmount" REAL NOT NULL DEFAULT 0.0,
    "sgstRate" REAL NOT NULL DEFAULT 0.0,
    "sgstAmount" REAL NOT NULL DEFAULT 0.0,
    "igstRate" REAL NOT NULL DEFAULT 0.0,
    "igstAmount" REAL NOT NULL DEFAULT 0.0,
    "totalPrice" REAL NOT NULL,
    CONSTRAINT "PurchaseItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseItem" ("cgstAmount", "cgstRate", "costPrice", "id", "igstAmount", "igstRate", "productId", "purchaseOrderId", "quantity", "sgstAmount", "sgstRate", "totalPrice") SELECT "cgstAmount", "cgstRate", "costPrice", "id", "igstAmount", "igstRate", "productId", "purchaseOrderId", "quantity", "sgstAmount", "sgstRate", "totalPrice" FROM "PurchaseItem";
DROP TABLE "PurchaseItem";
ALTER TABLE "new_PurchaseItem" RENAME TO "PurchaseItem";
CREATE TABLE "new_PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "cgstAmount" REAL NOT NULL DEFAULT 0.0,
    "sgstAmount" REAL NOT NULL DEFAULT 0.0,
    "igstAmount" REAL NOT NULL DEFAULT 0.0,
    "netAmount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0.0,
    "balanceAmount" REAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "supplierInvoiceNumber" TEXT,
    "expectedDate" DATETIME,
    "receivedAt" DATETIME,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("balanceAmount", "cgstAmount", "createdAt", "id", "igstAmount", "netAmount", "paidAmount", "poNumber", "sgstAmount", "status", "supplierId", "totalAmount") SELECT "balanceAmount", "cgstAmount", "createdAt", "id", "igstAmount", "netAmount", "paidAmount", "poNumber", "sgstAmount", "status", "supplierId", "totalAmount" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Bill_clientRef_key" ON "Bill"("clientRef");


-- Data: earlier purchase orders were recorded as already received ("APPROVED")
UPDATE "PurchaseItem" SET "receivedQuantity" = "quantity"
  WHERE "purchaseOrderId" IN (SELECT "id" FROM "PurchaseOrder" WHERE "status" IN ('APPROVED', 'PENDING'));
UPDATE "PurchaseOrder" SET "status" = 'RECEIVED', "receivedAt" = "createdAt" WHERE "status" IN ('APPROVED', 'PENDING');
