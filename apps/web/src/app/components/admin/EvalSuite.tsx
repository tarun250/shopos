'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, FlaskConical, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';
import { useShop } from '../../ShopContext';
import { Modal, Pill, PillTone, apiError, formatDateTime, ghostButton, primaryButton, secondaryButton } from './ui';

export type EvalStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED';

export interface EvalRunSummary {
  id: string;
  startedBy?: string;
  status: EvalStatus;
  total: number;
  passed: number;
  results?: string | EvalCaseResult[];
  createdAt: string;
  finishedAt: string | null;
}

export interface EvalCaseResult {
  id: string;
  role: string;
  prompt: string;
  passed: boolean;
  failures: string[];
  tools?: string[];
  confirmation?: string | null;
  reply?: string;
}

const POLL_MS = 5000;

export const EVAL_STATUS_TONE: Record<EvalStatus, PillTone> = {
  RUNNING: 'blue',
  COMPLETED: 'green',
  FAILED: 'red',
  INTERRUPTED: 'amber',
};

function parseResults(results: EvalRunSummary['results']): EvalCaseResult[] {
  if (Array.isArray(results)) return results;
  if (typeof results === 'string' && results) {
    try {
      const parsed = JSON.parse(results);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function duration(run: EvalRunSummary): string {
  if (!run.finishedAt) return '';
  const secs = Math.round((new Date(run.finishedAt).getTime() - new Date(run.createdAt).getTime()) / 1000);
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// "Automated test suite": scenario runs against the real assistant, with a detail view per run.
export default function EvalSuite({ onRunFinished }: { onRunFinished?: () => void }) {
  const { API_BASE, secureFetch } = useShop();
  const [runs, setRuns] = useState<EvalRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvalRunSummary | null>(null);
  const [detailError, setDetailError] = useState('');
  const wasRunning = useRef(false);

  const loadRuns = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await secureFetch(`${API_BASE}/agent/evals`);
      if (!res.ok) {
        setError(await apiError(res, 'Could not load test runs'));
        return;
      }
      setError('');
      setRuns(await res.json());
    } catch {
      setError('Could not reach the server.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      const res = await secureFetch(`${API_BASE}/agent/evals/${id}`);
      if (!res.ok) {
        setDetailError(await apiError(res, 'Could not load this run'));
        return;
      }
      setDetailError('');
      const run: EvalRunSummary = await res.json();
      setDetail(run);
      // Keep the list row in sync while polling
      setRuns(prev => prev.map(r => (r.id === run.id ? { ...r, status: run.status, passed: run.passed, finishedAt: run.finishedAt, results: run.results } : r)));
    } catch {
      setDetailError('Could not reach the server.');
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const runningRun = runs.find(r => r.status === 'RUNNING');

  // Poll the running run every 5s; refresh the list (and the dashboard) when it finishes.
  useEffect(() => {
    if (!runningRun) {
      if (wasRunning.current) {
        wasRunning.current = false;
        onRunFinished?.();
      }
      return;
    }
    wasRunning.current = true;
    const t = setInterval(async () => {
      try {
        const res = await secureFetch(`${API_BASE}/agent/evals/${runningRun.id}`);
        if (!res.ok) return;
        const run: EvalRunSummary = await res.json();
        setRuns(prev => prev.map(r => (r.id === run.id ? { ...r, status: run.status, passed: run.passed, finishedAt: run.finishedAt, results: run.results } : r)));
        if (detailId === run.id) setDetail(run);
        if (run.status !== 'RUNNING') loadRuns(true);
      } catch {
        /* try again next tick */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [runningRun?.id, detailId]);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailError('');
    loadDetail(id);
  };

  const startRun = async () => {
    setStarting(true);
    setStartError('');
    try {
      const res = await secureFetch(`${API_BASE}/agent/evals`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 409) setStartError(await apiError(res, 'A test run is already in progress'));
        else if (res.status === 429) setStartError('Test runs are limited to 2 every 10 minutes to protect the AI quota. Try again in a few minutes.');
        else setStartError(await apiError(res, 'Could not start the tests'));
        await loadRuns(true);
        return;
      }
      const run: EvalRunSummary = await res.json();
      setConfirmOpen(false);
      await loadRuns(true);
      openDetail(run.id);
    } catch {
      setStartError('Could not reach the server.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
            Automated test suite
          </h3>
          <p className="text-[11px] text-neutral-500 mt-1 max-w-2xl">
            Sends a fixed set of real questions (stock lookups, policies, bills that need confirmation, prompt-injection attempts) to the assistant as each role and checks the tools it calls and what it replies. Nothing is saved: confirmations are never approved.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadRuns()} className={ghostButton}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setStartError('');
              setConfirmOpen(true);
            }}
            disabled={!!runningRun}
            title={runningRun ? 'A test run is in progress' : undefined}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
          >
            {runningRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {runningRun ? 'Tests running…' : 'Run tests'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {startError && !confirmOpen && <p className="text-xs text-red-400">{startError}</p>}

      {loading && runs.length === 0 ? (
        <p className="text-xs text-neutral-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading runs…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-neutral-500 py-4 text-center">No test runs yet.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th className="py-2 pr-3 font-semibold">Started</th>
              <th className="py-2 pr-3 font-semibold">By</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Result</th>
              <th className="py-2 pr-3 font-semibold">Duration</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-850 text-neutral-300">
            {runs.map(run => {
              const done = parseResults(run.results).length;
              const pct = run.total ? Math.round((run.passed / run.total) * 100) : 0;
              return (
                <tr key={run.id} onClick={() => openDetail(run.id)} className="hover:bg-neutral-850/30 cursor-pointer transition-colors">
                  <td className="py-2 pr-3 whitespace-nowrap text-neutral-400">{formatDateTime(run.createdAt)}</td>
                  <td className="py-2 pr-3 font-mono text-neutral-400">{run.startedBy || '—'}</td>
                  <td className="py-2 pr-3"><Pill tone={EVAL_STATUS_TONE[run.status] ?? 'neutral'}>{run.status}</Pill></td>
                  <td className="py-2 pr-3">
                    {run.status === 'RUNNING' ? (
                      <span className="text-blue-300 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> {done}/{run.total} cases done</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-white font-semibold">{run.passed}/{run.total}</span>
                        <span className="w-20 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                          <span className={`block h-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-[10px] text-neutral-500">{pct}%</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-neutral-500 font-mono">{duration(run) || '—'}</td>
                  <td className="py-2 text-right"><span className="text-[11px] text-violet-300 inline-flex items-center">Details <ChevronRight className="w-3 h-3" /></span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {confirmOpen && (
        <Modal
          title="Run the automated test suite?"
          onClose={() => setConfirmOpen(false)}
          busy={starting}
          footer={
            <>
              <button onClick={() => setConfirmOpen(false)} disabled={starting} className={secondaryButton}>Cancel</button>
              <button onClick={startRun} disabled={starting} className={primaryButton}>
                {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Start run
              </button>
            </>
          }
        >
          <p className="text-xs text-neutral-300">The suite asks the assistant about a dozen questions, one at a time. It takes a few minutes and uses your AI provider quota (each case is a real AI request), so run it after changing prompts, tools or providers rather than routinely.</p>
          <p className="text-[11px] text-neutral-500">You can leave this screen while it runs. At most 2 runs can be started every 10 minutes.</p>
          {startError && <p className="text-xs text-red-400">{startError}</p>}
        </Modal>
      )}

      {detailId && (
        <RunDetail
          run={detail}
          error={detailError}
          onRetry={() => loadDetail(detailId)}
          onClose={() => {
            setDetailId(null);
            setDetail(null);
          }}
        />
      )}
    </section>
  );
}

function RunDetail({ run, error, onRetry, onClose }: { run: EvalRunSummary | null; error: string; onRetry: () => void; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | 'failed'>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const cases = run ? parseResults(run.results) : [];
  const failed = cases.filter(c => !c.passed).length;
  const shown = filter === 'failed' ? cases.filter(c => !c.passed) : cases;
  const pending = run ? Math.max(run.total - cases.length, 0) : 0;

  return (
    <Modal
      width="max-w-4xl"
      onClose={onClose}
      title={
        run ? (
          <span className="flex items-center gap-2">
            Test run · {formatDateTime(run.createdAt)}
            <Pill tone={EVAL_STATUS_TONE[run.status] ?? 'neutral'}>{run.status}</Pill>
          </span>
        ) : (
          'Test run'
        )
      }
    >
      {error ? (
        <div className="space-y-2">
          <p className="text-xs text-red-400">{error}</p>
          <button onClick={onRetry} className={ghostButton}>Try again</button>
        </div>
      ) : !run ? (
        <p className="text-xs text-neutral-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading run…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-300">
              <span className="font-mono font-bold text-white">{run.passed}/{run.total}</span> passed
              {failed > 0 && <span className="text-red-400"> · {failed} failed</span>}
              {run.startedBy && <span className="text-neutral-500"> · started by {run.startedBy}</span>}
              {run.finishedAt && <span className="text-neutral-500"> · took {duration(run)}</span>}
            </p>
            <div className="flex gap-1">
              {(['all', 'failed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${filter === f ? 'bg-white text-neutral-950' : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'}`}
                >
                  {f === 'all' ? `All (${cases.length})` : `Failed (${failed})`}
                </button>
              ))}
            </div>
          </div>

          {run.status === 'RUNNING' && (
            <p className="text-[11px] text-blue-300 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Running: {cases.length} of {run.total} cases done. This view refreshes every 5 seconds.
            </p>
          )}
          {run.status === 'INTERRUPTED' && pending > 0 && (
            <p className="text-[11px] text-amber-400">This run was interrupted (for example, the server restarted) before {pending} of {run.total} cases ran. Missing cases count as not passed.</p>
          )}
          {run.status === 'FAILED' && <p className="text-[11px] text-red-400">The run stopped with an error. Check the server logs.</p>}

          <div className="space-y-2">
            {shown.length === 0 && <p className="text-xs text-neutral-500 py-4 text-center">{filter === 'failed' ? 'No failed cases.' : 'No cases have finished yet.'}</p>}
            {shown.map(c => {
              const expanded = !!open[c.id];
              const reply = c.reply || '';
              const long = reply.length > 220;
              return (
                <div key={c.id} className={`bg-neutral-950/60 border rounded-lg p-3 ${c.passed ? 'border-neutral-850' : 'border-red-900/50'}`}>
                  <div className="flex items-start gap-2">
                    {c.passed ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-px" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-mono text-neutral-400">{c.id}</span>
                        <Pill tone={c.role === 'OWNER' ? 'violet' : c.role === 'MANAGER' ? 'blue' : 'neutral'}>{c.role}</Pill>
                      </div>
                      <p className="text-xs text-white">&ldquo;{c.prompt}&rdquo;</p>
                      <div className="flex flex-wrap gap-1 items-center text-[10px] text-neutral-500">
                        <span>Tools:</span>
                        {c.tools && c.tools.length > 0 ? (
                          c.tools.map((t, i) => <span key={`${t}-${i}`} className="font-mono bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">{t}</span>)
                        ) : (
                          <span className="italic">none</span>
                        )}
                        {c.confirmation && (
                          <>
                            <span className="ml-2">Asked to confirm:</span>
                            <span className="font-mono bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded">{c.confirmation}</span>
                          </>
                        )}
                      </div>
                      {c.failures.length > 0 && (
                        <ul className="text-[11px] text-red-300 list-disc pl-4 space-y-0.5">
                          {c.failures.map((f, i) => <li key={i} className="wrap-break-word">{f}</li>)}
                        </ul>
                      )}
                      {reply && (
                        <div className="text-[11px] text-neutral-400 bg-neutral-900 border border-neutral-850 rounded p-2">
                          <p className="whitespace-pre-wrap wrap-break-word">{expanded || !long ? reply : `${reply.slice(0, 220)}…`}</p>
                          {long && (
                            <button onClick={() => setOpen(o => ({ ...o, [c.id]: !expanded }))} className="text-violet-300 hover:text-violet-200 mt-1 cursor-pointer">
                              {expanded ? 'Show less' : 'Show full reply'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
