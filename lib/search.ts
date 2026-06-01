import { getDb } from './db';

// ── Tokenizer ──────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of',
  'and', 'or', 'but', 'not', 'with', 'this', 'that', 'are', 'was',
  'be', 'have', 'do', 'by', 'from', 'as', 'if', 'which', 'can', 'will',
  'what', 'how', 'when', 'where', 'who', 'its', 'my', 'your', 'their',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

// ── BM25 constants ─────────────────────────────────────────────────────────────
const K1 = 1.5;
const B = 0.75;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChunkSearchResult {
  chunkId: string;
  content: string;
  sourceName: string;
  sourceId: string;
  score: number;
}

export interface QASearchResult {
  question: string;
  answer: string;
  category: string;
  score: number;
}

// ── Search knowledge chunks with BM25 ─────────────────────────────────────────

export function searchChunks(query: string, topK = 5): ChunkSearchResult[] {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT c.id, c.content, c.source_id, ks.name as source_name
       FROM chunks c
       JOIN knowledge_sources ks ON c.source_id = ks.id
       WHERE ks.status = 'ready'`
    )
    .all() as Array<{
      id: string;
      content: string;
      source_id: string;
      source_name: string;
    }>;

  if (rows.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Pre-tokenize all docs
  const tokenized = rows.map((r) => ({ row: r, tokens: tokenize(r.content) }));
  const avgLen =
    tokenized.reduce((s, d) => s + d.tokens.length, 0) / tokenized.length;

  const scored = tokenized.map(({ row, tokens }) => {
    const docLen = tokens.length;
    let score = 0;

    for (const term of queryTokens) {
      const tf = tokens.filter((t) => t === term).length;
      if (tf === 0) continue;
      const df = tokenized.filter(({ tokens: ts }) => ts.includes(term)).length;
      const idf = Math.log((rows.length - df + 0.5) / (df + 0.5) + 1);
      const num = tf * (K1 + 1);
      const denom = tf + K1 * (1 - B + B * (docLen / avgLen));
      score += idf * (num / denom);
    }

    return {
      chunkId: row.id,
      content: row.content,
      sourceName: row.source_name,
      sourceId: row.source_id,
      score,
    } as ChunkSearchResult;
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Search Q&A pairs ──────────────────────────────────────────────────────────

export function searchQAPairs(query: string, topK = 3): QASearchResult[] {
  const db = getDb();

  const pairs = db
    .prepare(`SELECT question, answer, category FROM qa_pairs WHERE active = 1`)
    .all() as Array<{ question: string; answer: string; category: string }>;

  if (pairs.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = pairs.map((pair) => {
    const qTokens = tokenize(pair.question);
    const aTokens = tokenize(pair.answer);
    let score = 0;

    for (const term of queryTokens) {
      if (qTokens.includes(term)) score += 2; // question match weighted higher
      if (aTokens.includes(term)) score += 1;
    }

    // Bonus: full query token overlap ratio
    const overlap = queryTokens.filter((t) => qTokens.includes(t)).length;
    score += (overlap / queryTokens.length) * 3;

    return { ...pair, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Build context string ───────────────────────────────────────────────────────

export function buildContext(
  chunks: ChunkSearchResult[],
  qaPairs: QASearchResult[]
): { context: string; sources: string[] } {
  let context = '';
  const sources: string[] = [];

  if (qaPairs.length > 0) {
    context += '## Frequently Asked Questions\n\n';
    for (const qa of qaPairs) {
      context += `**Q:** ${qa.question}\n**A:** ${qa.answer}\n\n`;
    }
  }

  if (chunks.length > 0) {
    context += '## Knowledge Base\n\n';
    for (const chunk of chunks) {
      context += `**[Source: ${chunk.sourceName}]**\n${chunk.content}\n\n`;
      if (!sources.includes(chunk.sourceName)) {
        sources.push(chunk.sourceName);
      }
    }
  }

  return { context: context.trim(), sources };
}
