import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AgentService, Emit } from './agent.service';
import { RagService } from './rag/rag.service';
import { AgentUser } from './tools/types';
import { PAGES } from './tools/ui.tools';
import { ALLOWED_IMAGE_TYPES } from './vision';
import { BriefService } from './brief.service';
import { QualityService } from './quality.service';

export class AttachmentDto {
  @IsIn([...ALLOWED_IMAGE_TYPES])
  mimeType: string;

  @IsString()
  @MaxLength(7_200_000) // ~5 MB image as base64
  data: string;
}

export class AgentChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000) // the guardrail layer enforces the real limit with a friendly message
  message: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  @IsIn([...PAGES])
  page?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentDto)
  attachment?: AttachmentDto;
}

export class FeedbackDto {
  @IsIn([1, -1, 0])
  value: 1 | -1 | 0;
}

export class KnowledgeDocumentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @IsString()
  @IsIn(['POLICY', 'GUIDE', 'FAQ', 'GENERAL'])
  category: string;

  @IsString()
  @MinLength(20)
  @MaxLength(50000)
  content: string;
}

export class KnowledgeSearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  query: string;
}

const agentUser = (req: Request): AgentUser => {
  const u = (req as any).user;
  return { userId: u.userId, username: u.username, role: u.role };
};

@Controller('agent')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly rag: RagService,
    private readonly brief: BriefService,
    private readonly quality: QualityService,
  ) {}

  /** Server-sent events: conversation, token, reset, tool, ui, confirmation, action, message, done, error. */
  private openStream(req: Request, res: Response): { emit: Emit; signal: AbortSignal; end: () => void } {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    res.on('close', () => controller.abort());
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000);

    const emit: Emit = (event, data) => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as any).flush?.();
    };
    const end = () => {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    };
    return { emit, signal: controller.signal, end };
  }

  private async stream(req: Request, res: Response, work: (emit: Emit, signal: AbortSignal) => Promise<void>) {
    const { emit, signal, end } = this.openStream(req, res);
    try {
      await work(emit, signal);
    } catch (err: any) {
      emit('error', { message: err?.response?.message || err?.message || 'Unexpected error' });
    } finally {
      end();
    }
  }

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async chat(@Req() req: Request, @Res() res: Response, @Body() body: AgentChatDto) {
    await this.stream(req, res, (emit, signal) => this.agent.chat(agentUser(req), body, emit, signal));
  }

  @Post('actions/:id/confirm')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async confirm(@Req() req: Request, @Res() res: Response, @Param('id') id: string) {
    await this.stream(req, res, (emit, signal) => this.agent.decideAction(agentUser(req), id, 'confirm', emit, signal));
  }

  @Post('actions/:id/reject')
  async reject(@Req() req: Request, @Res() res: Response, @Param('id') id: string) {
    await this.stream(req, res, (emit, signal) => this.agent.decideAction(agentUser(req), id, 'reject', emit, signal));
  }

  @Get('conversations')
  listConversations(@Req() req: Request) {
    return this.agent.listConversations(agentUser(req));
  }

  @Get('conversations/:id')
  getConversation(@Req() req: Request, @Param('id') id: string) {
    return this.agent.getConversation(agentUser(req), id);
  }

  @Delete('conversations/:id')
  deleteConversation(@Req() req: Request, @Param('id') id: string) {
    return this.agent.deleteConversation(agentUser(req), id);
  }

  @Post('messages/:id/feedback')
  feedback(@Req() req: Request, @Param('id') id: string, @Body() body: FeedbackDto) {
    return this.agent.setFeedback(agentUser(req), id, body.value);
  }

  @Get('brief')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  getBrief(@Req() req: Request, @Query('refresh') refresh?: string) {
    return this.brief.get(agentUser(req), refresh === 'true');
  }

  // ---------- Quality: dashboard and evaluation runs (owner) ----------

  @Get('quality')
  @Roles('OWNER')
  qualityOverview(@Query('days') days?: string) {
    return this.quality.overview(Math.min(Math.max(Number(days) || 14, 1), 90));
  }

  @Get('evals')
  @Roles('OWNER')
  listEvals() {
    return this.quality.listRuns();
  }

  @Get('evals/:id')
  @Roles('OWNER')
  getEval(@Param('id') id: string) {
    return this.quality.getRun(id);
  }

  @Post('evals')
  @Roles('OWNER')
  @Throttle({ default: { limit: 2, ttl: 600000 } })
  startEval(@Req() req: Request) {
    return this.quality.startRun(agentUser(req));
  }

  // ---------- Knowledge base administration ----------

  @Get('knowledge')
  @Roles('OWNER', 'MANAGER')
  listKnowledge() {
    return this.rag.listDocuments();
  }

  @Get('knowledge/status')
  @Roles('OWNER', 'MANAGER')
  knowledgeStatus() {
    return this.rag.status();
  }

  @Post('knowledge')
  @Roles('OWNER', 'MANAGER')
  createKnowledge(@Req() req: Request, @Body() body: KnowledgeDocumentDto) {
    return this.rag.upsertDocument({ ...body, source: 'MANUAL', createdBy: agentUser(req).username });
  }

  @Put('knowledge/:id')
  @Roles('OWNER', 'MANAGER')
  updateKnowledge(@Param('id') id: string, @Body() body: KnowledgeDocumentDto) {
    return this.rag.upsertDocument({ id, ...body });
  }

  @Delete('knowledge/:id')
  @Roles('OWNER')
  deleteKnowledge(@Param('id') id: string) {
    return this.rag.deleteDocument(id);
  }

  @Post('knowledge/search')
  @Roles('OWNER', 'MANAGER')
  searchKnowledge(@Body() body: KnowledgeSearchDto) {
    return this.rag.search(body.query, { scope: 'KNOWLEDGE', limit: 6 });
  }

  @Post('knowledge/reindex')
  @Roles('OWNER')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  reindex() {
    return this.rag.reindexAll();
  }
}
