'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';

interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  source: string;
  content: string;
  chunkCount: number;
  updatedAt: string;
  createdBy?: string | null;
}

interface KnowledgeStatus {
  documents: number;
  productDocuments: number;
  chunks: number;
  embeddedChunks: number;
  embeddingModel: string;
  lastProductSync: string | null;
}

interface Props {
  apiBase: string;
  secureFetch: (url: string, options?: RequestInit) => Promise<Response>;
  role: string;
}

const CATEGORIES = ['POLICY', 'GUIDE', 'FAQ', 'GENERAL'];
const emptyForm = { id: '', title: '', category: 'POLICY', content: '' };

export default function KnowledgeBase({ apiBase, secureFetch, role }: Props) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const isOwner = role === 'OWNER';

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, statusRes] = await Promise.all([
        secureFetch(`${apiBase}/agent/knowledge`),
        secureFetch(`${apiBase}/agent/knowledge/status`),
      ]);
      if (docsRes.ok) setDocs(await docsRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const res = await secureFetch(`${apiBase}/agent/knowledge${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, category: form.category, content: form.content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(Array.isArray(err.message) ? err.message.join('. ') : err.message || 'Could not save the document.');
        return;
      }
      setForm(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doc: KnowledgeDoc) => {
    if (!window.confirm(`Delete "${doc.title}"? The assistant will no longer use it.`)) return;
    await secureFetch(`${apiBase}/agent/knowledge/${doc.id}`, { method: 'DELETE' });
    await load();
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const res = await secureFetch(`${apiBase}/agent/knowledge/reindex`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Re-indexing failed. Try again in a minute.');
      }
      await load();
    } finally {
      setReindexing(false);
    }
  };

  const runTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testQuery.trim().length < 2) return;
    setTesting(true);
    try {
      const res = await secureFetch(`${apiBase}/agent/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery }),
      });
      setTestResults(res.ok ? await res.json() : []);
    } finally {
      setTesting(false);
    }
  };

  const embeddedPct = status && status.chunks ? Math.round((status.embeddedChunks / status.chunks) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full space-y-5">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">AI Knowledge Base</h2>
          <p className="text-xs text-neutral-400 mt-1">Policies, procedures and guides the assistant uses to answer questions. Answers cite these documents.</p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <button onClick={reindex} disabled={reindexing} className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
              Re-index
            </button>
          )}
          <button onClick={() => { setError(''); setForm({ ...emptyForm }); }} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            Add document
          </button>
        </div>
      </div>

      {/* Index health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Documents', value: String(status?.documents ?? '–') },
          { label: 'Products indexed', value: String(status?.productDocuments ?? '–') },
          { label: 'Search chunks', value: String(status?.chunks ?? '–') },
          { label: 'Semantic coverage', value: status ? `${embeddedPct}%` : '–', hint: embeddedPct < 100 ? 'Missing embeddings are filled in automatically every few minutes; keyword search works meanwhile.' : `Model: ${status?.embeddingModel}` },
        ].map(card => (
          <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4" title={card.hint}>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{card.label}</span>
            <p className={`text-lg font-bold font-mono mt-1 ${card.label === 'Semantic coverage' && embeddedPct < 100 ? 'text-amber-400' : 'text-white'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5 overflow-hidden">
        {/* Documents */}
        <div className="lg:col-span-3 overflow-y-auto space-y-2 pr-1">
          {loading && docs.length === 0 ? (
            <p className="text-xs text-neutral-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>
          ) : docs.length === 0 ? (
            <div className="bg-neutral-900/20 border border-neutral-800/60 p-12 rounded-xl text-center text-sm text-neutral-500">No documents yet. Add your shop's policies so the assistant can answer from them.</div>
          ) : (
            docs.map(doc => (
              <div key={doc.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <h4 className="text-sm font-semibold text-white truncate">{doc.title}</h4>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-1 uppercase tracking-wider">
                      {doc.category} · {doc.source === 'SYSTEM' ? 'Built-in' : `Added by ${doc.createdBy || 'staff'}`} · {doc.chunkCount} chunks · updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-neutral-400 mt-2 line-clamp-2">{doc.content.replace(/#+\s*/g, '').slice(0, 220)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setError(''); setForm({ id: doc.id, title: doc.title, category: doc.category, content: doc.content }); }} title="Edit" className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isOwner && (
                      <button onClick={() => remove(doc)} title="Delete" className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Retrieval test */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col overflow-hidden">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Test retrieval</h4>
          <p className="text-[11px] text-neutral-500 mt-1">See which passages the assistant would read for a question.</p>
          <form onSubmit={runTest} className="flex gap-2 mt-3">
            <input value={testQuery} onChange={e => setTestQuery(e.target.value)} placeholder="e.g. can I return a used fan?" className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none" />
            <button type="submit" disabled={testing} className="px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer disabled:opacity-50">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </form>
          <div className="flex-1 overflow-y-auto mt-3 space-y-2">
            {testResults?.length === 0 && <p className="text-xs text-neutral-500">No relevant passages. The assistant would say it doesn't know.</p>}
            {testResults?.map((r, i) => (
              <div key={r.chunkId} className="bg-neutral-950/60 border border-neutral-850 rounded-lg p-3">
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span className="text-violet-300 font-semibold">#{i + 1} {r.title}</span>
                  <span className="font-mono">{r.matchedBy.join(' + ')}</span>
                </div>
                <p className="text-[11px] text-neutral-300 mt-1.5 whitespace-pre-line line-clamp-6">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      {form && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !saving && setForm(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white">{form.id ? 'Edit document' : 'Add document'}</h3>
              <button onClick={() => setForm(null)} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title, e.g. Warranty policy" className="col-span-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none" />
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-xs text-neutral-300 focus:outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <textarea
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                rows={16}
                placeholder={'Write the policy or guide. Use "# Heading" lines to separate sections; each section becomes a searchable passage.'}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none font-mono leading-relaxed"
              />
              <p className="text-[10px] text-neutral-500">{form.content.length.toLocaleString()} / 50,000 characters. Saving re-indexes only this document.</p>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-neutral-800">
              <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 cursor-pointer">Cancel</button>
              <button onClick={save} disabled={saving || form.title.trim().length < 3 || form.content.trim().length < 20} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer flex items-center gap-1.5">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
