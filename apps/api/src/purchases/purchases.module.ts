import { Module } from '@nestjs/common';
import { PurchasesController, SuppliersController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  controllers: [PurchasesController, SuppliersController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
