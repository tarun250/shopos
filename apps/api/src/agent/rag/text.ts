import { createHash } from 'crypto';

export const hashText = (text: string) => createHash('sha256').update(text).digest('hex');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'at', 'from', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'we', 'you',
  'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'what', 'which', 'who',
  'how', 'when', 'where', 'why', 'my', 'our', 'your', 'me', 'us', 'have', 'has', 'had', 'not', 'no', 'any',
  'some', 'all', 'about', 'into', 'than', 'then', 'there', 'their', 'them', 'so', 'such', 'please', 'tell',
]);

// Light stemming so "bulbs"/"bulb" and "returning"/"return" match in keyword search
function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('es') && /(ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map(t => t.replace(/^\.+|\.+$/g, ''))
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Splits a document into retrieval chunks along markdown headings and paragraphs.
 * Each chunk is prefixed with the document title and its section heading so it stands on its own.
 */
export function chunkDocument(title: string, content: string, targetSize = 700, maxSize = 1100): string[] {
  const sections: Array<{ heading: string; body: string }> = [];
  let heading = '';
  let body: string[] = [];
  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^#{1,4}\s+(.*)$/);
    if (match) {
      if (body.join('').trim()) sections.push({ heading, body: body.join('\n').trim() });
      heading = match[1].trim();
      body = [];
    } else {
      body.push(line);
    }
  }
  if (body.join('').trim()) sections.push({ heading, body: body.join('\n').trim() });

  const chunks: string[] = [];
  for (const section of sections) {
    const prefix = section.heading ? `${title} > ${section.heading}\n` : `${title}\n`;
    const paragraphs = section.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    let current = '';
    for (const paragraph of paragraphs) {
      if (current && (current.length + paragraph.length > targetSize)) {
        chunks.push(prefix + current);
        current = '';
      }
      if (paragraph.length > maxSize) {
        // Very long paragraph: split on sentence boundaries
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        for (const sentence of sentences) {
          if (current && current.length + sentence.length > targetSize) {
            chunks.push(prefix + current);
            current = '';
          }
          current += (current ? ' ' : '') + sentence;
        }
      } else {
        current += (current ? '\n\n' : '') + paragraph;
      }
    }
    if (current) chunks.push(prefix + current);
  }
  return chunks.length > 0 ? chunks : [`${title}\n${content.trim()}`];
}

/** Okapi BM25 over an in-memory chunk set. */
export class Bm25Index {
  private docs: Array<{ id: string; tf: Map<string, number>; length: number }> = [];
  private df = new Map<string, number>();
  private avgLength = 0;

  constructor(private readonly k1 = 1.2, private readonly b = 0.75) {}

  build(items: Array<{ id: string; text: string }>) {
    this.docs = [];
    this.df.clear();
    let total = 0;
    for (const item of items) {
      const tokens = tokenize(item.text);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
      this.docs.push({ id: item.id, tf, length: tokens.length });
      total += tokens.length;
    }
    this.avgLength = this.docs.length ? total / this.docs.length : 0;
  }

  search(query: string, limit: number, filter?: (id: string) => boolean): Array<{ id: string; score: number }> {
    const terms = [...new Set(tokenize(query))];
    if (terms.length === 0) return [];
    const n = this.docs.length;
    const results: Array<{ id: string; score: number }> = [];
    for (const doc of this.docs) {
      if (filter && !filter(doc.id)) continue;
      let score = 0;
      for (const term of terms) {
        const f = doc.tf.get(term);
        if (!f) continue;
        const df = this.df.get(term) || 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * doc.length) / (this.avgLength || 1))));
      }
      if (score > 0) results.push({ id: doc.id, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length && i < b.length; i++) dot += a[i] * b[i];
  return dot; // vectors are normalized at write time
}

export function normalize(values: number[]): Float32Array {
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
  return Float32Array.from(values.map(v => v / norm));
}
