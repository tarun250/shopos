import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ProductsModule } from '../products/products.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmClient } from './llm.client';
import { EmbeddingService } from './rag/embeddings';
import { RagService } from './rag/rag.service';

@Module({
  imports: [BillingModule, ProductsModule],
  controllers: [AgentController],
  providers: [AgentService, LlmClient, EmbeddingService, RagService],
})
export class AgentModule {}
