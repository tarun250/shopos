'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Cpu, Loader2, RefreshCw, ThumbsDown, Wrench } from 'lucide-react';
import TabPane from './TabPane';
import { useShop } from '../../ShopContext';
import EvalSuite from '../admin/EvalSuite';
import { StatCard, apiError, formatDateTime, ghostButton } from '../admin/ui';

type ActionStatus = 'EXECUTED' | 'REJECTED' | 'EXPIRED' | 'FAILED' | 'PENDING';

interface QualityOverview {
  days: number;
  conversations: number;
  answers: number;
  feedback: { helpful: number; notHelpful: number; satisfaction: number | null };
  actionsByTool: ({ tool: string } & Partial<Record<ActionStatus, number>>)[];
  failedActions: { id: string; toolName: string; summary: string; error: string | null; createdAt: string }[];
  blockedInputs: number;
  providers: { provider: string; answers: number }[];
  recentNegativeFeedback: { id: string; question: string | null; content: string; createdAt: string }[];
}

const PERIODS = [7, 14, 30] as const;

const STATUS_COLUMNS: { key: ActionStatus; label: string; className: string; help: string }[] = [
  { key: 'EXECUTED', label: 'Done', className: 'text-green-400', help: 'Confirmed by staff and completed' },
  { key: 'REJECTED', label: 'Rejected', className: 'text-neutral-300', help: 'Staff declined the proposed action' },
  { key: 'EXPIRED', label: 'Expired', className: 'text-amber-400', help: 'Nobody confirmed it in time' },
  { key: 'FAILED', label: 'Failed', className: 'text-red-400', help: 'Confirmed but the action errored' },
  { key: 'PENDING', label: 'Pending', className: 'text-blue-300', help: 'Waiting for confirmation' },
];

function humanizeTool(name: string): string {
  return name.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

// Owner-only: how the AI assistant is doing (usage, feedback, actions, providers) plus the scenario test suite.
export default function AiQualityTab() {
  const { API_BASE, secureFetch } = useShop();
  const [days, setDays] = useState<number>(14);
  const [data, setData] = useState<QualityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await secureFetch(`${API_BASE}/agent/quality?days=${days}`);
      if (!res.ok) {
        setError(await apiError(res, 'Could not load AI quality data'));
        return;
      }
      setData(await res.json());
    } catch {
      setError('Could not reach the server. Check that the API is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  const fb = data?.feedback;
  const rated = fb ? fb.helpful + fb.notHelpful : 0;
  const satisfaction = fb?.satisfaction;
  const satisfactionTone = satisfaction == null ? 'text-neutral-500' : satisfaction >= 80 ? 'text-green-400' : satisfaction >= 60 ? 'text-amber-400' : 'text-red-400';
  const totalProviderAnswers = data?.providers.reduce((s, p) => s + p.answers, 0) ?? 0;

  return (
    <TabPane className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">AI Quality</h2>
          <p className="text-xs text-neutral-400 mt-1">How the assistant is being used, what staff think of its answers, and how its actions turn out.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  days === p ? 'bg-white text-neutral-950' : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {p} days
              </button>
            ))}
          </div>
          <button onClick={load} className={ghostButton}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-20">
        {error && <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Conversations" value={data ? String(data.conversations) : '–'} hint={`Chats started in the last ${days} days`} />
          <StatCard label="Answers" value={data ? String(data.answers) : '–'} hint="Replies the assistant gave" />
          <StatCard
            label="Satisfaction"
            value={satisfaction == null ? '–' : `${Math.round(satisfaction)}%`}
            tone={satisfactionTone}
            hint={rated ? `${fb!.helpful} helpful · ${fb!.notHelpful} not helpful` : 'No thumbs up/down yet'}
          />
          <StatCard
            label="Blocked inputs"
            value={data ? String(data.blockedInputs) : '–'}
            tone={data && data.blockedInputs > 0 ? 'text-amber-400' : undefined}
            hint="Prompt-injection or unsafe requests refused"
          />
        </div>

        {loading && !data ? (
          <p className="text-xs text-neutral-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>
        ) : data ? (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            <div className="xl:col-span-3 space-y-5">
              {/* Actions by tool */}
              <Panel icon={<Wrench className="w-3.5 h-3.5 text-violet-400" />} title="Actions by tool" subtitle="Changes the assistant proposed (bills, payments, orders) and what happened to them.">
                {data.actionsByTool.length === 0 ? (
                  <Empty>No actions proposed in this period.</Empty>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-500">
                        <th className="py-2 pr-3 font-semibold">Tool</th>
                        {STATUS_COLUMNS.map(c => (
                          <th key={c.key} className="py-2 px-2 font-semibold text-right" title={c.help}>{c.label}</th>
                        ))}
                        <th className="py-2 pl-2 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-neutral-300">
                      {data.actionsByTool.map(row => {
                        const total = STATUS_COLUMNS.reduce((s, c) => s + (row[c.key] ?? 0), 0);
                        return (
                          <tr key={row.tool}>
                            <td className="py-2 pr-3">
                              <div className="text-white">{humanizeTool(row.tool)}</div>
                              <div className="text-[10px] font-mono text-neutral-500">{row.tool}</div>
                            </td>
                            {STATUS_COLUMNS.map(c => (
                              <td key={c.key} className={`py-2 px-2 text-right font-mono ${row[c.key] ? c.className : 'text-neutral-700'}`}>{row[c.key] ?? 0}</td>
                            ))}
                            <td className="py-2 pl-2 text-right font-mono font-bold text-white">{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Panel>

              {/* Failed actions */}
              <Panel icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />} title="Recent failed actions" subtitle="Confirmed actions that errored when they ran.">
                {data.failedActions.length === 0 ? (
                  <Empty>No failed actions in this period.</Empty>
                ) : (
                  <div className="space-y-2">
                    {data.failedActions.map(a => (
                      <div key={a.id} className="bg-neutral-950/60 border border-red-900/40 rounded-lg p-3">
                        <div className="flex justify-between gap-3 text-[10px] text-neutral-500">
                          <span className="font-mono text-neutral-300">{a.toolName}</span>
                          <span className="whitespace-nowrap">{formatDateTime(a.createdAt)}</span>
                        </div>
                        <p className="text-xs text-white mt-1">{a.summary}</p>
                        {a.error && <p className="text-[11px] text-red-300 mt-1 wrap-break-word">{a.error}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="xl:col-span-2 space-y-5">
              {/* Thumbs down */}
              <Panel icon={<ThumbsDown className="w-3.5 h-3.5 text-amber-400" />} title="Recent thumbs-down" subtitle="Answers staff marked as not helpful. Fix gaps by adding knowledge base documents.">
                {data.recentNegativeFeedback.length === 0 ? (
                  <Empty>{rated ? 'No negative feedback in this period.' : 'No feedback yet. Staff can rate answers with the thumbs buttons in the assistant.'}</Empty>
                ) : (
                  <div className="space-y-2">
                    {data.recentNegativeFeedback.map(f => <FeedbackItem key={f.id} item={f} />)}
                  </div>
                )}
              </Panel>

              {/* Providers */}
              <Panel icon={<Cpu className="w-3.5 h-3.5 text-blue-300" />} title="AI providers" subtitle="Which model provider answered. The assistant falls back to the next provider when one is down or out of quota.">
                {data.providers.length === 0 ? (
                  <Empty>No answers in this period.</Empty>
                ) : (
                  <div className="space-y-2.5">
                    {[...data.providers].sort((a, b) => b.answers - a.answers).map(p => {
                      const pct = totalProviderAnswers ? Math.round((p.answers / totalProviderAnswers) * 100) : 0;
                      return (
                        <div key={p.provider}>
                          <div className="flex justify-between text-xs">
                            <span className="text-white">{p.provider}</span>
                            <span className="font-mono text-neutral-400">{p.answers} <span className="text-neutral-600">({pct}%)</span></span>
                          </div>
                          <div className="h-1.5 rounded-full bg-neutral-800 mt-1 overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        ) : null}

        <EvalSuite onRunFinished={load} />
      </div>
    </TabPane>
  );
}

function Panel({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">{icon}{title}</h3>
        {subtitle && <p className="text-[11px] text-neutral-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-neutral-500 py-3 text-center">{children}</p>;
}

function FeedbackItem({ item }: { item: QualityOverview['recentNegativeFeedback'][number] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 180;
  const long = item.content.length > LIMIT || (item.question?.length ?? 0) > LIMIT;
  const clip = (s: string) => (expanded || s.length <= LIMIT ? s : `${s.slice(0, LIMIT)}…`);
  return (
    <div className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3 space-y-1.5">
      <div className="text-[10px] text-neutral-500">{formatDateTime(item.createdAt)}</div>
      <p className="text-xs text-white wrap-break-word"><span className="text-neutral-500">Q: </span>{item.question ? clip(item.question) : <span className="italic text-neutral-500">question not available</span>}</p>
      <p className="text-[11px] text-neutral-400 whitespace-pre-wrap wrap-break-word"><span className="text-neutral-500">A: </span>{clip(item.content)}</p>
      {long && (
        <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-violet-300 hover:text-violet-200 cursor-pointer">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
