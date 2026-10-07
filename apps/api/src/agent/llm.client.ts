import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSchema {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, any> };
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  provider: string;
  model: string;
  finishReason: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (text: string) => void;
  // Called when a provider fails after streaming started, so the client can discard partial text
  onReset?: () => void;
}

interface ProviderConfig {
  name: string;
  url: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

// Any provider failure moves on to the next provider; they differ in limits, outages and what they accept
class ProviderError extends Error {}

const FIRST_BYTE_TIMEOUT_MS = 25000;
const TOTAL_TIMEOUT_MS = 90000;

/**
 * OpenAI-compatible chat client with tool calling, streaming and provider failover.
 * Groq, Gemini (OpenAI compatibility endpoint) and OpenRouter all speak this format.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getProviders(): Promise<ProviderConfig[]> {
    const settings = await this.prisma.client.systemSetting.findMany().catch(() => []);
    const get = (key: string, fallback = '') => settings.find(s => s.key === key)?.value || fallback;

    const all: ProviderConfig[] = [
      {
        name: 'Gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        apiKey: get('gemini_api_key', process.env.GEMINI_API_KEY || ''),
        model: get('agent_model_gemini', 'gemini-2.5-flash'),
      },
      {
        name: 'Groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: get('groq_api_key', process.env.GROQ_API_KEY || ''),
        model: get('agent_model_groq', 'openai/gpt-oss-120b'),
      },
      {
        name: 'OpenRouter',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: get('openrouter_api_key', process.env.OPENROUTER_API_KEY || ''),
        model: get('agent_model_openrouter', 'google/gemini-2.5-flash'),
        extraHeaders: { 'X-Title': 'ShopOS Agent' },
      },
    ];
    const priority = get('agent_provider_priority', 'Gemini,Groq,OpenRouter').split(',').map(s => s.trim());
    return all
      .filter(p => p.apiKey)
      .sort((a, b) => {
        const ia = priority.indexOf(a.name);
        const ib = priority.indexOf(b.name);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const providers = await this.getProviders();
    if (providers.length === 0) {
      throw new Error('No AI provider API keys are configured. Add one in AI Settings.');
    }

    const failures: string[] = [];
    for (const provider of providers) {
      if (options.signal?.aborted) throw new Error('Request cancelled');
      let streamed = false;
      try {
        const result = await this.callProvider(provider, options, () => { streamed = true; });
        return result;
      } catch (err: any) {
        const message = err?.message || String(err);
        failures.push(`${provider.name}: ${message.slice(0, 160)}`);
        this.logger.warn(`Agent LLM provider ${provider.name} failed: ${message.slice(0, 300)}`);
        if (options.signal?.aborted) throw new Error('Request cancelled');
        if (streamed) options.onReset?.();
      }
    }
    throw new Error(`All AI providers failed. ${failures.join(' | ')}`);
  }

  private async callProvider(provider: ProviderConfig, options: ChatOptions, markStreamed: () => void): Promise<ChatResult> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);
    let firstByteTimer: NodeJS.Timeout | undefined = setTimeout(() => controller.abort(), FIRST_BYTE_TIMEOUT_MS);
    const totalTimer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

    try {
      const body: Record<string, any> = {
        model: provider.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1500,
        stream: true,
      };
      if (options.tools && options.tools.length > 0) {
        body.tools = options.tools;
        body.tool_choice = 'auto';
      }

      let response: Response;
      try {
        response = await fetch(provider.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
            ...(provider.extraHeaders || {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err: any) {
        throw new ProviderError(controller.signal.aborted ? 'timed out' : `network error: ${err.message}`);
      }

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        throw new ProviderError(`HTTP ${response.status}: ${text.slice(0, 300)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let finishReason = '';
      const calls: Array<{ id: string; name: string; arguments: string }> = [];

      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch (err: any) {
          throw new ProviderError(controller.signal.aborted ? 'timed out while streaming' : `stream error: ${err.message}`);
        }
        if (chunk.done) break;
        if (firstByteTimer) {
          clearTimeout(firstByteTimer);
          firstByteTimer = undefined;
        }
        buffer += decoder.decode(chunk.value, { stream: true });

        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;

          let event: any;
          try {
            event = JSON.parse(payload);
          } catch {
            continue;
          }
          if (event.error) {
            throw new ProviderError(`stream error: ${JSON.stringify(event.error).slice(0, 300)}`);
          }
          const choice = event.choices?.[0];
          if (!choice) continue;
          if (choice.finish_reason) finishReason = choice.finish_reason;
          const delta = choice.delta || {};

          if (typeof delta.content === 'string' && delta.content) {
            content += delta.content;
            markStreamed();
            options.onToken?.(delta.content);
          }
          if (Array.isArray(delta.tool_calls)) {
            delta.tool_calls.forEach((tc: any, position: number) => {
              const index = typeof tc.index === 'number' ? tc.index : calls.length > 0 && !tc.id ? calls.length - 1 : calls.length + position;
              if (!calls[index]) calls[index] = { id: '', name: '', arguments: '' };
              if (tc.id) calls[index].id = tc.id;
              if (tc.function?.name) calls[index].name += tc.function.name;
              if (tc.function?.arguments) calls[index].arguments += tc.function.arguments;
            });
          }
        }
      }

      const toolCalls: ToolCall[] = calls
        .filter(c => c && c.name)
        .map((c, i) => ({
          id: c.id || `call_${Date.now().toString(36)}_${i}`,
          type: 'function' as const,
          function: { name: c.name, arguments: c.arguments || '{}' },
        }));

      if (!content.trim() && toolCalls.length === 0) {
        throw new ProviderError('empty response');
      }

      return { content, toolCalls, provider: provider.name, model: provider.model, finishReason };
    } finally {
      if (firstByteTimer) clearTimeout(firstByteTimer);
      clearTimeout(totalTimer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
}
