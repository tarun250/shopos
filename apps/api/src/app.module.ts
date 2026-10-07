import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { BillingModule } from './billing/billing.module';
import { AIModule } from './ai/ai.module';
import { SessionModule } from './session/session.module';
import { ExpensesModule } from './expenses/expenses.module';
import { RemindersModule } from './reminders/reminders.module';
import { AgentModule } from './agent/agent.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { ShopSettingsModule } from './settings/shop-settings';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    BillingModule,
    AIModule,
    SessionModule,
    ExpensesModule,
    RemindersModule,
    AgentModule,
    PurchasesModule,
    ReportsModule,
    UsersModule,
    ShopSettingsModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
