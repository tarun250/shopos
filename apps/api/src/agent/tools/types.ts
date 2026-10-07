import { z, ZodTypeAny } from 'zod';
import { PrismaService } from '../../prisma.service';
import { BillingService } from '../../billing/billing.service';
import { ProductsService } from '../../products/products.service';
import { RagService } from '../rag/rag.service';
import { SessionService } from '../../session/session.service';
import { PurchasesService } from '../../purchases/purchases.service';
import { ReportsService } from '../../reports/reports.service';

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | string;

export interface AgentUser {
  userId: string;
  username: string;
  role: Role;
}

export interface ToolContext {
  user: AgentUser;
  conversationId: string;
  prisma: PrismaService;
  billing: BillingService;
  products: ProductsService;
  rag: RagService;
  sessions: SessionService;
  purchases: PurchasesService;
  reports: ReportsService;
}

export interface ConfirmationPreview {
  /** Arguments resolved to concrete ids/prices; exactly these are executed after the user confirms. */
  args: Record<string, any>;
  summary: string;
  details: Array<{ label: string; value: string }>;
  warnings?: string[];
}

export interface UiAction {
  type: 'navigate' | 'open_bill' | 'add_to_cart' | 'set_pos_customer' | 'refresh' | 'share_invoice';
  [key: string]: any;
}

/** Thrown for problems the model should explain to the user (not found, ambiguous, not allowed). */
export class ToolUserError extends Error {}

interface BaseTool<S extends ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  /** Roles allowed to use the tool; omitted means every signed-in role. */
  roles?: Role[];
  /** Intent groups used to decide which tools are offered for a message. */
  groups: string[];
}

export interface ReadTool<S extends ZodTypeAny = ZodTypeAny> extends BaseTool<S> {
  kind: 'read';
  execute(args: z.infer<S>, ctx: ToolContext): Promise<unknown>;
}

export interface UiTool<S extends ZodTypeAny = ZodTypeAny> extends BaseTool<S> {
  kind: 'ui';
  execute(args: z.infer<S>, ctx: ToolContext): Promise<{ result: unknown; uiAction: UiAction }>;
}

export interface WriteTool<S extends ZodTypeAny = ZodTypeAny> extends BaseTool<S> {
  kind: 'write';
  /** Validates and resolves the request into a preview; nothing is changed here. */
  prepare(args: z.infer<S>, ctx: ToolContext): Promise<ConfirmationPreview>;
  /** Runs only after the user confirms, with the frozen args from prepare(). */
  execute(args: Record<string, any>, ctx: ToolContext): Promise<{ result: unknown; uiAction?: UiAction }>;
}

export type AgentTool = ReadTool | UiTool | WriteTool;

/** Minimal zod → JSON Schema conversion covering the shapes our tools use. */
export function toJsonSchema(schema: ZodTypeAny): Record<string, any> {
  const def: any = schema._def;
  const describe = (out: Record<string, any>) => (schema.description ? { ...out, description: schema.description } : out);
  switch (def.typeName) {
    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries<ZodTypeAny>(shape)) {
        properties[key] = toJsonSchema(value);
        if (!value.isOptional()) required.push(key);
      }
      return describe({ type: 'object', properties, ...(required.length ? { required } : {}) });
    }
    case 'ZodString':
      return describe({ type: 'string' });
    case 'ZodNumber':
      return describe({ type: 'number' });
    case 'ZodBoolean':
      return describe({ type: 'boolean' });
    case 'ZodEnum':
      return describe({ type: 'string', enum: def.values });
    case 'ZodArray':
      return describe({ type: 'array', items: toJsonSchema(def.type) });
    case 'ZodOptional':
    case 'ZodNullable': {
      const inner = toJsonSchema(def.innerType);
      return schema.description ? { ...inner, description: schema.description } : inner;
    }
    case 'ZodDefault': {
      const inner = toJsonSchema(def.innerType);
      return { ...inner, default: def.defaultValue(), ...(schema.description ? { description: schema.description } : {}) };
    }
    case 'ZodEffects':
      return toJsonSchema(def.schema);
    default:
      return describe({});
  }
}
