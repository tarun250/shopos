import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AgentService } from './agent.service';
import { EVAL_CASES, EvalObservation, scoreCase } from './evals';
import { AgentUser } from './tools/types';

const DELAY_BETWEEN_CASES_MS = 4000; // stay under free-tier per-minute limits

@Injectable()
export class QualityService implements OnModuleInit {
  private readonly logger = new Logger(QualityService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly agent: AgentService) {}

  /** Runs live in memory, so any run still marked RUNNING at startup was cut off by a restart. */
  async onModuleInit() {
    const stale = await this.prisma.client.agentEvalRun.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'INTERRUPTED', finishedAt: new Date() },
    }).catch(() => ({ count: 0 }));
    if (stale.count) this.logger.warn(`Marked ${stale.count} evaluation run(s) interrupted by a restart`);
  }

  /** Owner dashboard: feedback, action outcomes, blocked inputs and provider usage over the last N days. */
  async overview(days = 14) {
    const db = this.prisma.client;
    const since = new Date(Date.now() - days * 86400000);
    const [conversations, assistantMessages, feedback, actions, failedActions, blocked, providers, negative, runs] = await Promise.all([
      db.agentConversation.count({ where: { createdAt: { gte: since }, NOT: { title: { startsWith: '[eval]' } } } }),
      db.agentMessage.count({ where: { role: 'assistant', toolCalls: null, createdAt: { gte: since } } }),
      db.agentMessage.groupBy({ by: ['feedback'], where: { feedback: { not: null }, createdAt: { gte: since } }, _count: true }),
      db.agentAction.groupBy({ by: ['toolName', 'status'], where: { createdAt: { gte: since } }, _count: true }),
      db.agentAction.findMany({ where: { status: 'FAILED', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, toolName: true, summary: true, error: true, createdAt: true } }),
      db.auditLog.count({ where: { action: 'AGENT_INPUT_BLOCKED', createdAt: { gte: since } } }),
      db.agentMessage.groupBy({ by: ['provider'], where: { role: 'assistant', provider: { not: null }, createdAt: { gte: since } }, _count: true }),
      db.agentMessage.findMany({ where: { feedback: -1, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, content: true, conversationId: true, createdAt: true } }),
      db.agentEvalRun.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, total: true, passed: true, createdAt: true, finishedAt: true } }),
    ]);

    // Pair each thumbs-down with the question that led to it
    const negativeWithQuestion = await Promise.all(negative.map(async m => {
      const question = await db.agentMessage.findFirst({ where: { conversationId: m.conversationId, role: 'user', toolName: null, createdAt: { lt: m.createdAt } }, orderBy: { createdAt: 'desc' }, select: { content: true } });
      return { ...m, content: m.content.slice(0, 400), question: question?.content.slice(0, 200) || '' };
    }));

    const up = feedback.find(f => f.feedback === 1)?._count || 0;
    const down = feedback.find(f => f.feedback === -1)?._count || 0;
    const byTool = new Map<string, Record<string, number>>();
    for (const a of actions) {
      const row = byTool.get(a.toolName) || {};
      row[a.status] = a._count;
      byTool.set(a.toolName, row);
    }
    return {
      days,
      conversations,
      answers: assistantMessages,
      feedback: { helpful: up, notHelpful: down, satisfaction: up + down ? Math.round((up / (up + down)) * 100) : null },
      actionsByTool: [...byTool.entries()].map(([tool, statuses]) => ({ tool, ...statuses })),
      failedActions,
      blockedInputs: blocked,
      providers: providers.map(p => ({ provider: p.provider, answers: p._count })),
      recentNegativeFeedback: negativeWithQuestion,
      evalRuns: runs,
    };
  }

  listRuns() {
    return this.prisma.client.agentEvalRun.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  }

  async getRun(id: string) {
    const run = await this.prisma.client.agentEvalRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Evaluation run not found');
    return { ...run, results: JSON.parse(run.results) };
  }

  /** Starts the scenario suite in the background; poll getRun() for progress. */
  async startRun(startedBy: AgentUser) {
    if (this.running) throw new ConflictException('An evaluation is already running');
    const run = await this.prisma.client.agentEvalRun.create({ data: { startedBy: startedBy.username, total: EVAL_CASES.length } });
    this.running = true;
    this.execute(run.id)
      .catch(async err => {
        this.logger.error(`Eval run failed: ${err.message}`);
        await this.prisma.client.agentEvalRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date() } });
      })
      .finally(() => { this.running = false; });
    return run;
  }

  private async execute(runId: string) {
    const db = this.prisma.client;
    const results: any[] = [];
    let passed = 0;
    for (const c of EVAL_CASES) {
      const account = await db.user.findFirst({ where: { role: c.role, isActive: true } });
      if (!account) {
        results.push({ id: c.id, role: c.role, prompt: c.prompt, passed: false, failures: [`no active ${c.role} user`] });
        continue;
      }
      const user: AgentUser = { userId: account.id, username: account.username, role: account.role };
      const observation = await this.observe(user, c.prompt);
      const score = scoreCase(c, observation);
      if (score.passed) passed++;
      results.push({ id: c.id, role: c.role, prompt: c.prompt, passed: score.passed, failures: score.failures, tools: observation.tools, confirmation: observation.confirmationTool, reply: observation.text.slice(0, 500) });
      await db.agentEvalRun.update({ where: { id: runId }, data: { results: JSON.stringify(results), passed } });
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CASES_MS));
    }
    await db.agentEvalRun.update({ where: { id: runId }, data: { status: 'COMPLETED', passed, results: JSON.stringify(results), finishedAt: new Date() } });
  }

  /** Runs one prompt through the real agent, records what it did, then removes the test conversation. */
  private async observe(user: AgentUser, prompt: string): Promise<EvalObservation> {
    const obs: EvalObservation = { tools: [], confirmationTool: null, blocked: false, text: '' };
    let conversationId: string | null = null;
    const controller = new AbortController();
    try {
      await this.agent.chat(user, { message: prompt, evalRun: true }, (event, data: any) => {
        if (event === 'conversation') conversationId = data.id;
        if (event === 'tool' && data.status === 'running') obs.tools.push(data.name);
        if (event === 'confirmation') obs.confirmationTool = data.toolName;
        if (event === 'message') obs.text = data.content;
      }, controller.signal);
      if (conversationId) {
        const blocked = await this.prisma.client.auditLog.findFirst({ where: { action: 'AGENT_INPUT_BLOCKED', details: { contains: conversationId } } });
        obs.blocked = !!blocked;
      }
    } catch (err: any) {
      obs.error = err.message;
    } finally {
      // Proposed actions are never executed by evals; drop the conversation entirely
      if (conversationId) await this.prisma.client.agentConversation.delete({ where: { id: conversationId } }).catch(() => undefined);
    }
    return obs;
  }
}
