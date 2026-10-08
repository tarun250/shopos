'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { openInvoice, openWhatsAppForBill } from '../lib/share';
import {
  AlertCircle,
  Check,
  History,
  Loader2,
  FileText,
  MessageCircle,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Sunrise,
  ShieldCheck,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';

export interface AgentUiAction {
  type: 'navigate' | 'open_bill' | 'add_to_cart' | 'set_pos_customer' | 'refresh';
  [key: string]: any;
}

interface Citation {
  n: number;
  title: string;
  documentId: string;
}

interface MessageItem {
  kind: 'message';
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  feedback?: number | null;
  error?: boolean;
}

interface ActionItem {
  kind: 'action';
  id: string;
  toolName: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  warnings?: string[];
  status: string;
  error?: string | null;
  expiresAt?: string;
}

interface ShareItem {
  kind: 'share';
  id: string;
  billId: string;
  billNumber: string;
  channel: 'whatsapp' | 'print_a4' | 'print_receipt';
}

type ChatItem = MessageItem | ActionItem | ShareItem;

// Shrinks a photo to at most 1600px JPEG so uploads stay small and fast
async function compressImage(file: File): Promise<{ mimeType: string; data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file is not an image the browser can read.'));
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL('image/jpeg', 0.82);
    return { mimeType: 'image/jpeg', data: preview.split(',')[1], preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface ToolStep {
  id: string;
  label: string;
  status: string;
}

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
  apiBase: string;
  secureFetch: (url: string, options?: RequestInit) => Promise<Response>;
  user: { username: string; fullName?: string; role: string };
  currentPage: string;
  onUiAction: (action: AgentUiAction) => void;
}

const SUGGESTIONS: Record<string, string[]> = {
  OWNER: ['How did we do this week, and what was the profit?', 'Who owes us money?', 'Which items need reordering?', 'What is our return policy?'],
  MANAGER: ['Show pending approvals', 'Which items need reordering?', 'Summarize today\'s sales', 'Who owes us money?'],
  CASHIER: ['Bill 2 Philips 12W bulbs to a walk-in, cash', 'Do we have teflon tape in stock?', 'Show today\'s bills', 'Can a customer return a used fan?'],
};

// ---------- Minimal, safe markdown rendering (no HTML injection) ----------

function renderInline(text: string, citations: Citation[], keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('**')) {
      parts.push(<strong key={key} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(<code key={key} className="px-1 py-0.5 rounded bg-neutral-800 text-violet-300 font-mono text-[11px]">{token.slice(1, -1)}</code>);
    } else {
      const n = Number(token.slice(1, -1));
      const cite = citations.find(c => c.n === n);
      parts.push(
        <sup key={key} title={cite?.title} className="mx-0.5 px-1 rounded bg-violet-950 text-violet-300 text-[9px] font-bold cursor-help">
          {n}
        </sup>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Markdown({ text, citations = [] }: { text: string; citations?: Citation[] }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushList = () => {
    if (!list) return;
    const ListTag = list.ordered ? 'ol' : 'ul';
    const idx = blocks.length;
    blocks.push(
      <ListTag key={`l${idx}`} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
        {list.items.map((item, j) => <li key={j}>{renderInline(item, citations, `l${idx}-${j}`)}</li>)}
      </ListTag>,
    );
    list = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet || numbered)![1]);
      return;
    }
    flushList();
    if (!line.trim()) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      blocks.push(<p key={idx} className="font-bold text-white mt-1">{renderInline(heading[1], citations, `h${idx}`)}</p>);
    } else {
      blocks.push(<p key={idx}>{renderInline(line, citations, `p${idx}`)}</p>);
    }
  });
  flushList();
  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}

// ---------- SSE parsing over fetch (EventSource can't send POST bodies or auth headers) ----------

async function readEvents(response: Response, onEvent: (event: string, data: any) => void) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trim());
      }
      if (data.length) {
        try {
          onEvent(event, JSON.parse(data.join('\n')));
        } catch {
          // ignore malformed event
        }
      }
    }
  }
}

export default function AgentPanel({ open, onClose, apiBase, secureFetch, user, currentPage, onUiAction }: AgentPanelProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [steps, setSteps] = useState<ToolStep[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);

  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const uiActionRef = useRef(onUiAction);
  uiActionRef.current = onUiAction;

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [items, draft, steps]);

  // The listener must stay attached for the whole keypress: if it depended on busy/onClose, a state
  // update made by an earlier keydown listener would re-run this effect mid-dispatch and the browser
  // would skip the removed listener. So read the latest values through refs instead.
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const updateAction = (id: string, patch: Partial<ActionItem>) =>
    setItems(prev => prev.map(it => (it.kind === 'action' && it.id === id ? { ...it, ...patch } : it)));

  const runStream = async (path: string, body?: object) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    draftRef.current = '';
    setDraft('');
    setSteps([]);
    try {
      const res = await secureFetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
        signal: controller.signal,
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        const err = await res.json().catch(() => ({}));
        const message = res.status === 429 ? 'You are sending messages too quickly. Please wait a moment.' : err.message || `Request failed (${res.status})`;
        setItems(prev => [...prev, { kind: 'message', id: `err-${Date.now()}`, role: 'assistant', content: message, citations: [], error: true }]);
        return;
      }
      await readEvents(res, (event, data) => {
        switch (event) {
          case 'conversation':
            setConversationId(data.id);
            break;
          case 'token':
            draftRef.current += data.text;
            setDraft(draftRef.current);
            break;
          case 'reset':
            draftRef.current = '';
            setDraft('');
            break;
          case 'tool':
            setSteps(prev => {
              const existing = prev.find(s => s.id === data.id);
              if (existing) return prev.map(s => (s.id === data.id ? { ...s, status: data.status } : s));
              return [...prev, { id: data.id, label: data.label, status: data.status }];
            });
            break;
          case 'ui':
            if (data.type === 'share_invoice') {
              // Opening tabs needs a click (pop-up blockers), so offer a button instead
              setItems(prev => [...prev, { kind: 'share', id: `share-${Date.now()}`, billId: data.billId, billNumber: data.billNumber, channel: data.channel }]);
            } else {
              uiActionRef.current(data);
            }
            break;
          case 'confirmation':
            draftRef.current = '';
            setDraft('');
            setItems(prev => [...prev, { kind: 'action', id: data.actionId, toolName: data.toolName, summary: data.summary, details: data.details, warnings: data.warnings, status: 'PENDING', expiresAt: data.expiresAt }]);
            break;
          case 'action':
            updateAction(data.actionId, { status: data.status, error: data.error });
            break;
          case 'message':
            draftRef.current = '';
            setDraft('');
            setSteps([]);
            setItems(prev => [...prev, { kind: 'message', id: data.id, role: 'assistant', content: data.content, citations: data.citations || [], error: data.error }]);
            break;
          case 'error':
            setItems(prev => [...prev, { kind: 'message', id: `err-${Date.now()}`, role: 'assistant', content: data.message || 'Something went wrong.', citations: [], error: true }]);
            break;
        }
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setItems(prev => [...prev, { kind: 'message', id: `err-${Date.now()}`, role: 'assistant', content: `Connection problem: ${err.message}`, citations: [], error: true }]);
      }
    } finally {
      // Keep partial text if the user pressed Stop mid-answer
      const partial = draftRef.current;
      if (partial.trim() && controller.signal.aborted) {
        setItems(prev => [...prev, { kind: 'message', id: `partial-${Date.now()}`, role: 'assistant', content: partial + ' …(stopped)', citations: [] }]);
      }
      draftRef.current = '';
      setDraft('');
      setSteps([]);
      setBusy(false);
      abortRef.current = null;
    }
  };

  const send = async (text?: string) => {
    const typed = (text ?? input).trim();
    if ((!typed && !attachment) || busy) return;
    const message = typed || 'Record this supplier invoice';
    const photo = attachment;
    setInput('');
    setAttachment(null);
    stopListening();
    setItems(prev => [...prev, { kind: 'message', id: `local-${Date.now()}`, role: 'user', content: photo ? `📎 Invoice photo\n${message}` : message, citations: [] }]);
    await runStream('/agent/chat', {
      message,
      conversationId: conversationId || undefined,
      page: currentPage,
      ...(photo ? { attachment: { mimeType: photo.mimeType, data: photo.data } } : {}),
    });
  };

  // ---------- Photo attachment ----------
  const [attachment, setAttachment] = useState<{ mimeType: string; data: string; preview: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onPickFile = async (file?: File) => {
    if (!file) return;
    try {
      setAttachment(await compressImage(file));
      inputRef.current?.focus();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ---------- Voice input (Web Speech API; Chrome/Edge) ----------
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const speechSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };
  const toggleListening = () => {
    if (listening) return stopListening();
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = false;
    const before = input ? `${input.trim()} ` : '';
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setInput((before + transcript).slice(0, 2000));
    };
    recognition.onerror = (e: any) => {
      setListening(false);
      if (e.error === 'not-allowed') alert('Microphone permission was denied. Allow it in the browser to use voice input.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // ---------- Morning brief (shown once per day in an empty conversation) ----------
  const [brief, setBrief] = useState<{ date: string; text: string } | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const loadBrief = async (refresh = false) => {
    setBriefLoading(true);
    try {
      const res = await secureFetch(`${apiBase}/agent/brief${refresh ? '?refresh=true' : ''}`);
      if (res.ok) setBrief(await res.json());
    } catch {
      // offline: no brief
    } finally {
      setBriefLoading(false);
    }
  };
  useEffect(() => {
    if (open && !brief && !briefLoading && items.length === 0) loadBrief();
  }, [open]);

  const decide = (actionId: string, decision: 'confirm' | 'reject') => {
    if (busy) return;
    updateAction(actionId, { status: decision === 'confirm' ? 'EXECUTING' : 'REJECTING' });
    runStream(`/agent/actions/${actionId}/${decision}`);
  };

  const newChat = () => {
    abortRef.current?.abort();
    setItems([]);
    setConversationId(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const loadConversations = async () => {
    setShowHistory(v => !v);
    const res = await secureFetch(`${apiBase}/agent/conversations`);
    if (res.ok) setConversations(await res.json());
  };

  const openConversation = async (id: string) => {
    const res = await secureFetch(`${apiBase}/agent/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setConversationId(data.id);
    setItems(data.items.map((it: any) => (it.kind === 'action' ? { ...it, warnings: [] } : it)));
    setShowHistory(false);
  };

  const deleteConversation = async (id: string) => {
    await secureFetch(`${apiBase}/agent/conversations/${id}`, { method: 'DELETE' });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (id === conversationId) newChat();
  };

  const sendFeedback = async (messageId: string, value: 1 | -1) => {
    const current = items.find(it => it.kind === 'message' && it.id === messageId) as MessageItem | undefined;
    const next = current?.feedback === value ? 0 : value;
    setItems(prev => prev.map(it => (it.kind === 'message' && it.id === messageId ? { ...it, feedback: next || null } : it)));
    await secureFetch(`${apiBase}/agent/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: next }),
    });
  };

  const suggestions = SUGGESTIONS[user.role] || SUGGESTIONS.CASHIER;
  const statusStyle: Record<string, string> = {
    PENDING: 'border-violet-700/60 bg-violet-950/30',
    EXECUTING: 'border-blue-800/60 bg-blue-950/20',
    EXECUTED: 'border-green-900/60 bg-green-950/20',
    REJECTED: 'border-neutral-800 bg-neutral-900/40 opacity-70',
    REJECTING: 'border-neutral-800 bg-neutral-900/40 opacity-70',
    EXPIRED: 'border-neutral-800 bg-neutral-900/40 opacity-70',
    FAILED: 'border-red-900/60 bg-red-950/20',
  };
  const statusText: Record<string, string> = {
    EXECUTING: 'Working…',
    EXECUTED: 'Done',
    REJECTED: 'Cancelled',
    REJECTING: 'Cancelling…',
    EXPIRED: 'Expired, nothing changed',
    FAILED: 'Failed',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.2 }}
          className="fixed top-0 right-0 h-full w-full sm:w-[440px] z-50 bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col text-neutral-200"
          role="dialog"
          aria-label="ShopOS Assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">ShopOS Assistant</h3>
                <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Changes need your confirmation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={loadConversations} title="Conversation history" className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 cursor-pointer">
                <History className="w-4 h-4" />
              </button>
              <button onClick={newChat} title="New conversation" className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 cursor-pointer">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={onClose} title="Close (Esc)" className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* History */}
          {showHistory && (
            <div className="border-b border-neutral-800 max-h-64 overflow-y-auto bg-neutral-900/40">
              {conversations.length === 0 ? (
                <p className="p-4 text-xs text-neutral-500">No past conversations.</p>
              ) : (
                conversations.map(c => (
                  <div key={c.id} className={`group flex items-center justify-between px-4 py-2 text-xs hover:bg-neutral-900 ${c.id === conversationId ? 'bg-neutral-900' : ''}`}>
                    <button onClick={() => openConversation(c.id)} className="flex-1 text-left truncate cursor-pointer">
                      <span className="text-neutral-200">{c.title}</span>
                      <span className="block text-[10px] text-neutral-500">{new Date(c.updatedAt).toLocaleString()}</span>
                    </button>
                    <button onClick={() => deleteConversation(c.id)} title="Delete" className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-[13px]">
            {items.length === 0 && !busy && (
              <div className="space-y-4 pt-4">
                <div>
                  <p className="text-sm text-white font-semibold">Hi {user.fullName?.split(' ')[0] || user.username}, what do you need?</p>
                  <p className="text-xs text-neutral-500 mt-1">I can look things up, answer policy questions, and do tasks like billing, payments, expenses and stock updates. I'll always ask before changing anything.</p>
                </div>
                {(brief || briefLoading) && (
                  <div className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-violet-200 flex items-center gap-1.5"><Sunrise className="w-3.5 h-3.5" /> Today&apos;s brief</p>
                      <button onClick={() => loadBrief(true)} disabled={briefLoading} title="Refresh" className="text-neutral-500 hover:text-white cursor-pointer disabled:opacity-50">
                        <RefreshCw className={`w-3 h-3 ${briefLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {brief ? <div className="text-xs text-neutral-200"><Markdown text={brief.text} /></div> : <p className="text-xs text-neutral-500">Preparing your brief…</p>}
                  </div>
                )}
                <div className="grid gap-2">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => send(s)} className="text-left text-xs px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white text-neutral-300 cursor-pointer transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {items.map(item => {
              if (item.kind === 'message' && item.role === 'user') {
                return (
                  <div key={item.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-violet-600 text-white px-3.5 py-2 rounded-2xl rounded-br-md whitespace-pre-wrap">{item.content}</div>
                  </div>
                );
              }
              if (item.kind === 'message') {
                const canRate = !item.error && !item.id.startsWith('err-') && !item.id.startsWith('partial-');
                return (
                  <div key={item.id} className="space-y-1.5">
                    <div className={`max-w-[95%] px-3.5 py-2.5 rounded-2xl rounded-bl-md border ${item.error ? 'border-red-900/50 bg-red-950/20 text-red-200' : 'border-neutral-800 bg-neutral-900/60'}`}>
                      <Markdown text={item.content} citations={item.citations} />
                      {item.citations.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-800 space-y-1">
                          {item.citations.map(c => (
                            <p key={c.n} className="text-[10px] text-neutral-500">
                              <span className="text-violet-300 font-bold">[{c.n}]</span> {c.title}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    {canRate && (
                      <div className="flex gap-1 pl-1">
                        <button onClick={() => sendFeedback(item.id, 1)} title="Helpful" className={`p-1 rounded cursor-pointer ${item.feedback === 1 ? 'text-green-400' : 'text-neutral-600 hover:text-neutral-300'}`}>
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => sendFeedback(item.id, -1)} title="Not helpful" className={`p-1 rounded cursor-pointer ${item.feedback === -1 ? 'text-red-400' : 'text-neutral-600 hover:text-neutral-300'}`}>
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              if (item.kind === 'share') {
                return (
                  <div key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 space-y-2">
                    <p className="text-xs text-neutral-300">Bill <span className="font-mono text-white">{item.billNumber}</span> is ready:</p>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <button onClick={() => openInvoice(item.billId, 'receipt')} className={`flex items-center justify-center gap-1 py-2 rounded-lg cursor-pointer ${item.channel === 'print_receipt' ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}>
                        <Printer className="w-3 h-3" /> Receipt
                      </button>
                      <button onClick={() => openInvoice(item.billId, 'a4')} className={`flex items-center justify-center gap-1 py-2 rounded-lg cursor-pointer ${item.channel === 'print_a4' ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}>
                        <FileText className="w-3 h-3" /> A4
                      </button>
                      <button onClick={() => openWhatsAppForBill(apiBase, secureFetch, item.billId)} className={`flex items-center justify-center gap-1 py-2 rounded-lg cursor-pointer ${item.channel === 'whatsapp' ? 'bg-green-700 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}>
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} className={`rounded-xl border p-3.5 space-y-2.5 ${statusStyle[item.status] || statusStyle.PENDING}`}>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-violet-300 mt-0.5 shrink-0" />
                    <p className="font-semibold text-white text-xs leading-snug">{item.summary}</p>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {item.details.filter(d => d.label !== 'Warning').map((d, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="text-neutral-500 shrink-0">{d.label}</span>
                        <span className="text-neutral-200 text-right font-mono">{d.value}</span>
                      </div>
                    ))}
                  </div>
                  {[...(item.warnings || []), ...item.details.filter(d => d.label === 'Warning').map(d => d.value)].map((w, i) => (
                    <p key={i} className="text-[11px] text-amber-300 flex gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {w}
                    </p>
                  ))}
                  {item.status === 'PENDING' ? (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => decide(item.id, 'confirm')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg cursor-pointer">
                        <Check className="w-3.5 h-3.5" /> Confirm
                      </button>
                      <button onClick={() => decide(item.id, 'reject')} disabled={busy} className="flex-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-semibold py-2 rounded-lg cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className={`text-[11px] font-semibold flex items-center gap-1.5 ${item.status === 'EXECUTED' ? 'text-green-400' : item.status === 'FAILED' ? 'text-red-400' : 'text-neutral-400'}`}>
                      {item.status === 'EXECUTING' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {item.status === 'EXECUTED' && <Check className="w-3 h-3" />}
                      {statusText[item.status] || item.status}
                      {item.error && <span className="font-normal text-red-300">: {item.error}</span>}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Live progress and streaming answer */}
            {busy && (
              <div className="space-y-2">
                {steps.map(s => (
                  <p key={s.id} className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                    {s.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> : s.status === 'error' ? <AlertCircle className="w-3 h-3 text-amber-400" /> : <Check className="w-3 h-3 text-green-500" />}
                    {s.label}
                  </p>
                ))}
                {draft ? (
                  <div className="max-w-[95%] px-3.5 py-2.5 rounded-2xl rounded-bl-md border border-neutral-800 bg-neutral-900/60">
                    <Markdown text={draft} />
                  </div>
                ) : (
                  steps.length === 0 && (
                    <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                    </p>
                  )
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-neutral-800 p-3">
            {attachment && (
              <div className="flex items-center gap-2 mb-2 text-[11px] text-neutral-300">
                <img src={attachment.preview} alt="Attached invoice" className="w-10 h-10 object-cover rounded border border-neutral-700" />
                <span className="flex-1">Invoice photo attached. Send to read it into a purchase.</span>
                <button onClick={() => setAttachment(null)} title="Remove photo" className="text-neutral-500 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => { onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 focus-within:border-violet-700">
              {(user.role === 'OWNER' || user.role === 'MANAGER') && (
                <button onClick={() => fileRef.current?.click()} disabled={busy} title="Attach a supplier invoice photo" className="p-1.5 rounded-lg text-neutral-400 hover:text-white disabled:opacity-40 cursor-pointer">
                  <Paperclip className="w-4 h-4" />
                </button>
              )}
              {speechSupported && (
                <button
                  onClick={toggleListening}
                  onContextMenu={e => { e.preventDefault(); setVoiceLang(l => (l === 'en-IN' ? 'hi-IN' : 'en-IN')); }}
                  disabled={busy}
                  title={listening ? 'Stop listening' : `Speak (${voiceLang === 'en-IN' ? 'English' : 'Hindi'}; right-click to switch language)`}
                  className={`p-1.5 rounded-lg cursor-pointer disabled:opacity-40 ${listening ? 'text-red-400 animate-pulse' : 'text-neutral-400 hover:text-white'}`}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={2000}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask or tell me what to do…"
                className="flex-1 bg-transparent resize-none text-[13px] text-white placeholder-neutral-500 focus:outline-none max-h-32 py-1"
                style={{ height: 'auto' }}
              />
              {busy ? (
                <button onClick={() => abortRef.current?.abort()} title="Stop" className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer">
                  <Square className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button onClick={() => send()} disabled={!input.trim() && !attachment} title="Send (Enter)" className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white cursor-pointer">
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[9px] text-neutral-600 mt-1.5 px-1">
              AI can make mistakes. Check confirmation cards before approving. {input.length > 1500 && <span className="text-amber-500">{input.length}/2000</span>}
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
