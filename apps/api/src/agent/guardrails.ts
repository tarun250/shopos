// Guardrails applied around the agent: input screening, data masking by role,
// untrusted-content fencing and output redaction.

export const MAX_INPUT_CHARS = 2000;
const MAX_TOOL_OUTPUT_CHARS = 6000;
const MAX_ARRAY_ITEMS = 25;

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all|your|the|system)\b.{0,20}\b(instructions?|rules?|prompts?|guidelines?|polic(y|ies))\b/i, reason: 'instruction override' },
  { pattern: /\b(reveal|show|print|repeat|output|leak|dump|display)\b.{0,40}\b(system|hidden|initial|developer)\s*(prompt|message|instructions?)\b/i, reason: 'system prompt extraction' },
  { pattern: /\b(you are now|pretend (to be|you are)|act as|roleplay as)\b.{0,40}\b(unrestricted|unfiltered|jailbroken|dan|evil|without (any )?(rules|restrictions|limits))\b/i, reason: 'role hijack' },
  { pattern: /\b(developer|god|admin|debug|jailbreak)\s*mode\b/i, reason: 'mode switch' },
  { pattern: /\b(api[\s_-]?keys?|secret[\s_-]?keys?|jwt[\s_-]?secret|access[\s_-]?tokens?|refresh[\s_-]?tokens?|password\s*hash(es)?|pin\s*hash(es)?)\b/i, reason: 'credential request' },
  { pattern: /<\/?(system|assistant|tool)>|\[\/?INST\]|<\|im_(start|end)\|>/i, reason: 'prompt markup' },
];

export interface InputCheck {
  allowed: boolean;
  text: string;
  reason?: string;
}

export function checkUserInput(raw: unknown): InputCheck {
  if (typeof raw !== 'string') return { allowed: false, text: '', reason: 'empty' };
  // Strip control characters (keep newlines/tabs) and collapse runaway whitespace
  const text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!text) return { allowed: false, text, reason: 'empty' };
  if (text.length > MAX_INPUT_CHARS) return { allowed: false, text, reason: 'too_long' };
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(text)) return { allowed: false, text, reason };
  }
  return { allowed: true, text };
}

export function refusalFor(reason?: string): string {
  if (reason === 'too_long') return `That message is too long. Please keep it under ${MAX_INPUT_CHARS} characters.`;
  if (reason === 'credential request') return "I can't share API keys, passwords, tokens or other credentials. An owner can manage AI keys in AI Settings.";
  return "I can't help with that request. I can help you run the shop: look up products, customers and bills, answer questions about sales and stock, or carry out tasks like billing and recording payments.";
}

const COST_KEYS = new Set(['costPrice', 'purchasePrice', 'profit', 'profitMargin', 'grossProfit', 'margin']);
const SECRET_KEYS = new Set(['passwordHash', 'pinHash', 'refreshTokenHash']);

/** Removes cost/profit data for non-owners and credentials for everyone, and bounds the size. */
export function sanitizeForModel(value: unknown, role: string): unknown {
  const isOwner = role === 'OWNER';
  const walk = (v: any, depth: number): any => {
    if (v === null || v === undefined) return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'number') return Number.isInteger(v) ? v : Number(v.toFixed(2));
    if (typeof v === 'string') return v.length > 600 ? v.slice(0, 600) + '…' : v;
    if (Array.isArray(v)) {
      const items = v.slice(0, MAX_ARRAY_ITEMS).map(x => walk(x, depth + 1));
      if (v.length > MAX_ARRAY_ITEMS) items.push(`…${v.length - MAX_ARRAY_ITEMS} more not shown`);
      return items;
    }
    if (typeof v === 'object') {
      if (depth > 6) return '[nested data omitted]';
      const out: Record<string, any> = {};
      for (const [key, val] of Object.entries(v)) {
        if (SECRET_KEYS.has(key)) continue;
        if (!isOwner && COST_KEYS.has(key)) continue;
        out[key] = walk(val, depth + 1);
      }
      return out;
    }
    return v;
  };
  return walk(value, 0);
}

export function toolResultForModel(value: unknown, role: string): string {
  const json = JSON.stringify(sanitizeForModel(value, role));
  return json.length > MAX_TOOL_OUTPUT_CHARS ? json.slice(0, MAX_TOOL_OUTPUT_CHARS) + '…[truncated]' : json;
}

const SECRET_PATTERNS = [
  /sk-or-v1-[A-Za-z0-9]{20,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /gsk_[A-Za-z0-9]{20,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /AQ\.[A-Za-z0-9_-]{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g,
];

/** Final pass over anything the model says before it reaches the user or the database. */
export function redactOutput(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[redacted]');
  return out;
}

/** Fences data from tools/retrieval so the model treats it as information, never as instructions. */
export function fenceUntrusted(label: string, body: string): string {
  return `<${label}>\n${body.replace(new RegExp(`</?${label}>`, 'gi'), '')}\n</${label}>`;
}
