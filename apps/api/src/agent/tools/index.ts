import { AgentTool, Role, toJsonSchema } from './types';
import { READ_TOOLS } from './read.tools';
import { WRITE_TOOLS } from './write.tools';
import { UI_TOOLS } from './ui.tools';
import { ToolSchema } from '../llm.client';

export const ALL_TOOLS: AgentTool[] = [...READ_TOOLS, ...WRITE_TOOLS, ...UI_TOOLS];
const BY_NAME = new Map(ALL_TOOLS.map(t => [t.name, t]));

export const getTool = (name: string) => BY_NAME.get(name);

export const canUse = (tool: AgentTool, role: Role) => !tool.roles || tool.roles.includes(role);

// Intent routing: only tools relevant to the conversation are offered to the model.
// This keeps prompts small (free-tier token limits) and narrows what the model can do per turn.
const GROUP_PATTERNS: Record<string, RegExp> = {
  product: /\b(products?|items?|sku|barcode|prices?|mrp|have|available|find|looking for|need|fix|brand)\b/i,
  stock: /\b(stock|inventory|adjust|count|damaged?|received|reorder|low|restock|units?|price|mrp|cost)\b/i,
  customer: /\b(customers?|clients?|contractors?|register|phone|khata|ledger|new customer|gstin)\b/i,
  payment: /\b(pay|paid|payments?|collect(ed)?|received|owes?|owed|dues?|balance|outstanding|settle|khata|advance)\b/i,
  supplier: /\b(suppliers?|vendors?|distributors?|purchases?|po)\b/i,
  bill: /\b(bills?|invoices?|sales?|sell|sold|orders?|quotes?|quotation|cart|checkout|billing|counter|ring up)\b/i,
  return: /\b(returns?|returned|refunds?|exchange|warranty|defective|faulty)\b/i,
  expense: /\b(expenses?|spent|spend|tea|rent|salary|electricity|fuel|petrol|transport)\b/i,
  reminder: /\b(remind(er)?s?|due date|deadline|filing|licen[cs]e|insurance)\b/i,
  approval: /\b(approv\w*|reject\w*|pending)\b/i,
  cash: /\b(cash|drawer|session|deposit|withdraw\w*|float|shift)\b/i,
  report: /\b(report|summary|summari[sz]e|revenue|profit|margin|how (did|are|is|was)|today|yesterday|week|month|best|top|trend|performance|compare)\b/i,
  knowledge: /\b(polic(y|ies)|how (do|to|can)|rules?|allowed|can i|procedure|guide|gst|terms|explain|what is|why)\b/i,
};

export function selectTools(role: Role, recentUserText: string, recentlyUsed: string[]): AgentTool[] {
  const groups = new Set<string>(['core']);
  for (const [group, pattern] of Object.entries(GROUP_PATTERNS)) {
    if (pattern.test(recentUserText)) groups.add(group);
  }
  return ALL_TOOLS.filter(t => canUse(t, role) && (t.groups.some(g => groups.has(g)) || recentlyUsed.includes(t.name)));
}

export function toToolSchemas(tools: AgentTool[]): ToolSchema[] {
  return tools.map(t => {
    const confirmNote = t.kind === 'write' ? ' (Changes data: the user must confirm before it runs.)' : '';
    return {
      type: 'function' as const,
      function: { name: t.name, description: t.description + confirmNote, parameters: toJsonSchema(t.schema) },
    };
  });
}
