import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [SessionController],
})
export class SessionModule {}
