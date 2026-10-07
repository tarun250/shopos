import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { EmbeddingService, EMBEDDING_MODEL } from './embeddings';
import { Bm25Index, chunkDocument, cosine, hashText } from './text';
import { DEFAULT_KNOWLEDGE } from './default-knowledge';

export type KnowledgeScope = 'KNOWLEDGE' | 'PRODUCT';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  category: string;
  source: string;
  sourceId: string | null;
  text: string;
  score: number;
  matchedBy: string[];
}

interface IndexedChunk {
  id: string;
  documentId: string;
  title: string;
  category: string;
  source: string;
  sourceId: string | null;
  text: string;
  vector: Float32Array | null;
}

const RRF_K = 60;
const MIN_VECTOR_SIMILARITY = 0.55;
const PRODUCT_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const EMBED_RETRY_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Retrieval layer: knowledge documents (policies, guides) and the product catalog are chunked,
 * embedded and searched with hybrid BM25 + vector similarity fused by reciprocal rank.
 */
@Injectable()
export class RagService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RagService.name);
  private chunks = new Map<string, IndexedChunk>();
  private bm25 = new Bm25Index();
  private lastProductSync = 0;
  private productSyncInFlight: Promise<void> | null = null;
  private embedRetryTimer?: NodeJS.Timeout;
  private embedInFlight: Promise<{ embedded: number }> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly embeddings: EmbeddingService) {}

  onModuleInit() {
    // Don't block API startup on embedding calls
    this.bootstrap().catch(err => this.logger.error(`Knowledge base bootstrap failed: ${err.message}`));
    // Self-heal: chunks stored without vectors during an outage or quota limit get embedded later
    this.embedRetryTimer = setInterval(() => {
      this.embedMissing().catch(err => this.logger.warn(`Background embedding deferred: ${err.message}`));
    }, EMBED_RETRY_INTERVAL_MS);
    this.embedRetryTimer.unref();
  }

  onModuleDestroy() {
    if (this.embedRetryTimer) clearInterval(this.embedRetryTimer);
  }

  private async bootstrap() {
    await this.ensureDefaultKnowledge();
    await this.loadIndex();
    await this.syncProducts(true);
    await this.embedMissing().catch(err => this.logger.warn(`Embedding deferred: ${err.message}`));
  }

  private async ensureDefaultKnowledge() {
    const existing = await this.prisma.client.knowledgeDocument.count({ where: { source: 'SYSTEM' } });
    if (existing > 0) return;
    for (const doc of DEFAULT_KNOWLEDGE) {
      await this.upsertDocument({ ...doc, source: 'SYSTEM' }, { skipReload: true, embed: false });
    }
    this.logger.log(`Seeded ${DEFAULT_KNOWLEDGE.length} default knowledge documents`);
  }

  private async loadIndex() {
    const rows = await this.prisma.client.knowledgeChunk.findMany({
      where: { document: { isActive: true } },
      include: { document: { select: { title: true, category: true, source: true, sourceId: true } } },
    });
    this.chunks.clear();
    for (const row of rows) {
      this.chunks.set(row.id, {
        id: row.id,
        documentId: row.documentId,
        title: row.document.title,
        category: row.document.category,
        source: row.document.source,
        sourceId: row.document.sourceId,
        text: row.text,
        vector: row.embedding && row.embeddingModel === EMBEDDING_MODEL ? Float32Array.from(JSON.parse(row.embedding)) : null,
      });
    }
    this.bm25.build([...this.chunks.values()].map(c => ({ id: c.id, text: c.text })));
  }

  /** Creates or updates a document; re-chunks and re-embeds only when its content changed. */
  async upsertDocument(
    doc: { id?: string; title: string; category: string; content: string; source?: string; sourceId?: string; createdBy?: string },
    opts: { skipReload?: boolean; embed?: boolean } = {},
  ) {
    const db = this.prisma.client;
    const contentHash = hashText(`${doc.title}\n${doc.category}\n${doc.content}`);
    const existing = doc.id
      ? await db.knowledgeDocument.findUnique({ where: { id: doc.id } })
      : doc.sourceId
        ? await db.knowledgeDocument.findUnique({ where: { sourceId: doc.sourceId } })
        : null;
    if (doc.id && !existing) throw new NotFoundException('Knowledge document not found');
    if (existing && existing.contentHash === contentHash && existing.isActive) return existing;

    const pieces = chunkDocument(doc.title, doc.content);
    let vectors: Array<Float32Array | null> = pieces.map(() => null);
    if (opts.embed !== false) {
      try {
        vectors = await this.embeddings.embedDocuments(pieces);
      } catch (err: any) {
        // Keyword search still works; embedMissing() retries later
        this.logger.warn(`Storing "${doc.title}" without embeddings: ${err.message}`);
      }
    }

    const saved = await db.$transaction(async tx => {
      const record = existing
        ? await tx.knowledgeDocument.update({
            where: { id: existing.id },
            data: { title: doc.title, category: doc.category, content: doc.content, contentHash, isActive: true },
          })
        : await tx.knowledgeDocument.create({
            data: {
              title: doc.title,
              category: doc.category,
              content: doc.content,
              contentHash,
              source: doc.source || 'MANUAL',
              sourceId: doc.sourceId,
              createdBy: doc.createdBy,
            },
          });
      await tx.knowledgeChunk.deleteMany({ where: { documentId: record.id } });
      await tx.knowledgeChunk.createMany({
        data: pieces.map((text, ordinal) => ({
          documentId: record.id,
          ordinal,
          text,
          embedding: vectors[ordinal] ? JSON.stringify(Array.from(vectors[ordinal]!).map(v => Number(v.toFixed(6)))) : null,
          embeddingModel: vectors[ordinal] ? EMBEDDING_MODEL : null,
        })),
      });
      return record;
    });

    if (!opts.skipReload) await this.loadIndex();
    return saved;
  }

  async deleteDocument(id: string) {
    const doc = await this.prisma.client.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Knowledge document not found');
    await this.prisma.client.knowledgeDocument.delete({ where: { id } });
    await this.loadIndex();
    return { success: true };
  }

  async listDocuments() {
    const docs = await this.prisma.client.knowledgeDocument.findMany({
      where: { source: { not: 'PRODUCT' } },
      include: { _count: { select: { chunks: true } } },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
    return docs.map(({ _count, ...d }) => ({ ...d, chunkCount: _count.chunks }));
  }

  async status() {
    const all = [...this.chunks.values()];
    return {
      documents: new Set(all.filter(c => c.source !== 'PRODUCT').map(c => c.documentId)).size,
      productDocuments: new Set(all.filter(c => c.source === 'PRODUCT').map(c => c.documentId)).size,
      chunks: all.length,
      embeddedChunks: all.filter(c => c.vector).length,
      embeddingModel: EMBEDDING_MODEL,
      lastProductSync: this.lastProductSync ? new Date(this.lastProductSync).toISOString() : null,
    };
  }

  /** Embeds chunks stored without vectors (e.g. after an embedding outage). */
  async embedMissing(): Promise<{ embedded: number }> {
    // Coalesce concurrent callers (startup, product sync, background timer)
    if (this.embedInFlight) return this.embedInFlight;
    this.embedInFlight = this.embedMissingNow().finally(() => {
      this.embedInFlight = null;
    });
    return this.embedInFlight;
  }

  private async embedMissingNow(): Promise<{ embedded: number }> {
    const missing = await this.prisma.client.knowledgeChunk.findMany({
      where: { OR: [{ embedding: null }, { embeddingModel: { not: EMBEDDING_MODEL } }] },
      select: { id: true, text: true },
    });
    if (missing.length === 0) return { embedded: 0 };
    let embedded = 0;
    try {
      // Save each slice as it completes so progress survives a quota error midway
      for (let i = 0; i < missing.length; i += 20) {
        const slice = missing.slice(i, i + 20);
        const vectors = await this.embeddings.embedDocuments(slice.map(m => m.text));
        for (let j = 0; j < slice.length; j++) {
          await this.prisma.client.knowledgeChunk.update({
            where: { id: slice[j].id },
            data: { embedding: JSON.stringify(Array.from(vectors[j]).map(v => Number(v.toFixed(6)))), embeddingModel: EMBEDDING_MODEL },
          });
        }
        embedded += slice.length;
      }
    } finally {
      if (embedded > 0) await this.loadIndex();
    }
    return { embedded };
  }

  async reindexAll() {
    await this.prisma.client.knowledgeChunk.updateMany({ data: { embedding: null, embeddingModel: null } });
    await this.syncProducts(true);
    return this.embedMissing();
  }

  /** Keeps one PRODUCT document per catalog item so descriptive queries can find products semantically. */
  async syncProducts(force = false) {
    if (!force && Date.now() - this.lastProductSync < PRODUCT_SYNC_INTERVAL_MS) return;
    if (this.productSyncInFlight) return this.productSyncInFlight;
    this.productSyncInFlight = (async () => {
      const db = this.prisma.client;
      const products = await db.product.findMany({
        where: { isDeleted: false },
        include: { category: true, baseUnit: true, aliases: true },
      });
      const existing = await db.knowledgeDocument.findMany({ where: { source: 'PRODUCT' }, select: { id: true, sourceId: true, contentHash: true } });
      const bySource = new Map(existing.map(d => [d.sourceId, d]));

      let changed = 0;
      for (const p of products) {
        const content = [
          `Product: ${p.name}`,
          `SKU: ${p.sku}`,
          p.category ? `Category: ${p.category.name}${p.category.description ? ` (${p.category.description})` : ''}` : '',
          p.aliases.length ? `Also called: ${p.aliases.map(a => a.aliasName).join(', ')}` : '',
          p.description ? `Description: ${p.description}` : '',
          `Sold per: ${p.baseUnit.name}`,
          p.hsnCode ? `HSN: ${p.hsnCode}` : '',
        ].filter(Boolean).join('\n');
        const hash = hashText(`${p.name}\nPRODUCT\n${content}`);
        if (bySource.get(p.id)?.contentHash === hash) continue;
        // Embedded afterwards in one batched pass
        await this.upsertDocument({ title: p.name, category: 'PRODUCT', content, source: 'PRODUCT', sourceId: p.id }, { skipReload: true, embed: false });
        changed++;
      }

      const live = new Set(products.map(p => p.id));
      const stale = existing.filter(d => d.sourceId && !live.has(d.sourceId)).map(d => d.id);
      if (stale.length) await db.knowledgeDocument.deleteMany({ where: { id: { in: stale } } });

      if (changed) await this.embedMissing().catch(err => this.logger.warn(`Product embedding deferred: ${err.message}`));
      if (changed || stale.length || this.chunks.size === 0) await this.loadIndex();
      this.lastProductSync = Date.now();
      if (changed || stale.length) this.logger.log(`Product knowledge synced: ${changed} updated, ${stale.length} removed`);
    })().finally(() => {
      this.productSyncInFlight = null;
    });
    return this.productSyncInFlight;
  }

  /** Hybrid retrieval: BM25 and vector rankings fused with reciprocal rank fusion. */
  async search(query: string, opts: { scope: KnowledgeScope; limit?: number; maxPerDocument?: number } ): Promise<RetrievedChunk[]> {
    const limit = opts.limit ?? 5;
    const maxPerDocument = opts.maxPerDocument ?? 2;
    if (opts.scope === 'PRODUCT') await this.syncProducts().catch(() => undefined);

    const inScope = (c: IndexedChunk) => (opts.scope === 'PRODUCT' ? c.source === 'PRODUCT' : c.source !== 'PRODUCT');
    const fused = new Map<string, { score: number; matchedBy: Set<string> }>();
    const add = (id: string, rank: number, by: string) => {
      const entry = fused.get(id) || { score: 0, matchedBy: new Set<string>() };
      entry.score += 1 / (RRF_K + rank);
      entry.matchedBy.add(by);
      fused.set(id, entry);
    };

    this.bm25
      .search(query, 25, id => {
        const c = this.chunks.get(id);
        return !!c && inScope(c);
      })
      .forEach((hit, rank) => add(hit.id, rank, 'keyword'));

    try {
      const queryVector = await this.embeddings.embedQuery(query);
      [...this.chunks.values()]
        .filter(c => c.vector && inScope(c))
        .map(c => ({ id: c.id, similarity: cosine(queryVector, c.vector!) }))
        .filter(h => h.similarity >= MIN_VECTOR_SIMILARITY)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 25)
        .forEach((hit, rank) => add(hit.id, rank, 'semantic'));
    } catch (err: any) {
      this.logger.warn(`Semantic search unavailable, using keyword search only: ${err.message}`);
    }

    const perDocument = new Map<string, number>();
    const results: RetrievedChunk[] = [];
    for (const [id, entry] of [...fused.entries()].sort((a, b) => b[1].score - a[1].score)) {
      const c = this.chunks.get(id)!;
      const count = perDocument.get(c.documentId) || 0;
      if (count >= maxPerDocument) continue;
      perDocument.set(c.documentId, count + 1);
      results.push({
        chunkId: c.id,
        documentId: c.documentId,
        title: c.title,
        category: c.category,
        source: c.source,
        sourceId: c.sourceId,
        text: c.text,
        score: Number(entry.score.toFixed(4)),
        matchedBy: [...entry.matchedBy],
      });
      if (results.length >= limit) break;
    }
    return results;
  }
}
