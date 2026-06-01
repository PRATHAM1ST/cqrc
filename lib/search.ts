import { redis } from './db';

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

export async function searchChunks(query: string, topK = 5): Promise<ChunkSearchResult[]> {
  const ksIds = await redis.smembers('ks:all');
  if (ksIds.length === 0) return [];

  const ksPipeline = redis.pipeline();
  ksIds.forEach(id => ksPipeline.hgetall(`ks:${id}`));
  const ksResults = await ksPipeline.exec();

  const readySources = ksResults
    .map(res => res as any)
    .filter(ks => ks && ks.status === 'ready');

  if (readySources.length === 0) return [];

  const chunksPipeline = redis.pipeline();
  readySources.forEach(ks => chunksPipeline.lrange(`chunks:${ks.id}`, 0, -1));
  const chunksResults = await chunksPipeline.exec();

  const rows: Array<{
    id: string;
    content: string;
    source_id: string;
    source_name: string;
  }> = [];

  for (let i = 0; i < readySources.length; i++) {
    const ks = readySources[i];
    const chunks = chunksResults[i] as string[];
    chunks.forEach(c => {
      const parsed = typeof c === 'string' ? JSON.parse(c) : c;
      rows.push({
        id: parsed.id,
        content: parsed.content,
        source_id: ks.id,
        source_name: ks.name
      });
    });
  }

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

export async function searchQAPairs(query: string, topK = 3): Promise<QASearchResult[]> {
  const qaIds = await redis.smembers('qa:all');
  if (qaIds.length === 0) return [];

  const pipeline = redis.pipeline();
  qaIds.forEach(id => pipeline.hgetall(`qa:${id}`));
  const results = await pipeline.exec();

  const pairs = results
    .map(res => res as any)
    .filter(qa => qa && String(qa.active) === '1');

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

    return {
      question: pair.question,
      answer: pair.answer,
      category: pair.category,
      score
    } as QASearchResult;
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

