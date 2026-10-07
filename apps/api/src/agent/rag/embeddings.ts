import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { normalize } from './text';

export const EMBEDDING_MODEL = 'gemini-embedding-001';
const DIMENSIONS = 768;
// Free tier counts every text as one request (100/minute), so keep batches small and honour retry hints
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 4;

/** Gemini embeddings with batching, retry/backoff and a small query cache. */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly queryCache = new Map<string, Float32Array>();

  constructor(private readonly prisma: PrismaService) {}

  private async apiKey(): Promise<string> {
    const setting = await this.prisma.client.systemSetting.findUnique({ where: { key: 'gemini_api_key' } }).catch(() => null);
    return setting?.value || process.env.GEMINI_API_KEY || '';
  }

  async embedDocuments(texts: string[]): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      out.push(...(await this.embedBatch(texts.slice(i, i + BATCH_SIZE), 'RETRIEVAL_DOCUMENT')));
    }
    return out;
  }

  async embedQuery(text: string): Promise<Float32Array> {
    const key = text.trim().toLowerCase();
    const cached = this.queryCache.get(key);
    if (cached) return cached;
    // One attempt only: a live search falls back to keyword ranking rather than waiting on quota
    const [vector] = await this.embedBatch([text], 'RETRIEVAL_QUERY', 1);
    if (this.queryCache.size > 300) this.queryCache.delete(this.queryCache.keys().next().value as string);
    this.queryCache.set(key, vector);
    return vector;
  }

  private async embedBatch(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY', maxAttempts = MAX_ATTEMPTS): Promise<Float32Array[]> {
    const key = await this.apiKey();
    if (!key) throw new Error('Gemini API key is not configured; embeddings unavailable');

    let lastError = '';
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let waitMs = 1000 * 2 ** attempt;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: texts.map(text => ({
                model: `models/${EMBEDDING_MODEL}`,
                content: { parts: [{ text: text.slice(0, 8000) }] },
                taskType,
                outputDimensionality: DIMENSIONS,
              })),
            }),
            signal: controller.signal,
          },
        );
        if (response.ok) {
          const data = await response.json();
          return data.embeddings.map((e: { values: number[] }) => normalize(e.values));
        }
        const body = await response.text();
        lastError = `HTTP ${response.status}: ${body.slice(0, 200)}`;
        if (response.status !== 429 && response.status < 500) break;
        const hint = body.match(/retry in ([\d.]+)s/i) || body.match(/"retryDelay":\s*"(\d+)s"/);
        if (hint) waitMs = Math.min(Math.ceil(Number(hint[1]) * 1000) + 500, 65000);
      } catch (err: any) {
        lastError = err.name === 'AbortError' ? 'timed out' : err.message;
      } finally {
        clearTimeout(timer);
      }
      if (attempt < maxAttempts - 1) await new Promise(r => setTimeout(r, waitMs));
    }
    this.logger.warn(`Embedding request failed: ${lastError}`);
    throw new Error(`Embedding failed: ${lastError}`);
  }
}
