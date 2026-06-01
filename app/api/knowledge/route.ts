import { NextResponse } from 'next/server';
import { redis } from '@/lib/db';
import type { KnowledgeSource } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ksIds = await redis.smembers('ks:all');
    let sources: KnowledgeSource[] = [];

    if (ksIds.length > 0) {
      const pipeline = redis.pipeline();
      ksIds.forEach(id => pipeline.hgetall(`ks:${id}`));
      const results = await pipeline.exec();

      results.forEach(res => {
        const ks = res as any;
        if (ks && ks.id) {
          if (ks.size !== undefined) ks.size = Number(ks.size);
          if (ks.chunks_count !== undefined) ks.chunks_count = Number(ks.chunks_count);
          sources.push(ks as KnowledgeSource);
        }
      });
    }

    sources.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ sources });
  } catch (err) {
    console.error('[knowledge get] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

