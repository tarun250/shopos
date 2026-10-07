import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ProductsModule } from '../products/products.module';
import { SessionModule } from '../session/session.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { ReportsModule } from '../reports/reports.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmClient } from './llm.client';
import { EmbeddingService } from './rag/embeddings';
import { RagService } from './rag/rag.service';
import { InvoiceVisionService } from './vision';
import { BriefService } from './brief.service';
import { QualityService } from './quality.service';

@Module({
  imports: [BillingModule, ProductsModule, SessionModule, PurchasesModule, ReportsModule],
  controllers: [AgentController],
  providers: [AgentService, LlmClient, EmbeddingService, RagService, InvoiceVisionService, BriefService, QualityService],
})
export class AgentModule {}
