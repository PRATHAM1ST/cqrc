import { NextResponse } from 'next/server';
import { redis } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Knowledge Sources
    const ksIds = await redis.smembers('ks:all');
    let readyKsCount = 0;
    let totalChunks = 0;
    if (ksIds.length > 0) {
      const pipeline = redis.pipeline();
      ksIds.forEach(id => pipeline.hgetall(`ks:${id}`));
      const results = await pipeline.exec();
      results.forEach(res => {
        const ks = res as any;
        if (ks && ks.status === 'ready') {
          readyKsCount++;
          totalChunks += parseInt(ks.chunks_count || '0', 10);
        }
      });
    }

    // QA Pairs
    const qaIds = await redis.smembers('qa:all');
    let activeQaCount = 0;
    if (qaIds.length > 0) {
      const pipeline = redis.pipeline();
      qaIds.forEach(id => pipeline.hgetall(`qa:${id}`));
      const results = await pipeline.exec();
      results.forEach(res => {
        const qa = res as any;
        // active is stored as string '1' or '0'
        if (qa && String(qa.active) === '1') {
          activeQaCount++;
        }
      });
    }

    // Conversations
    const convCount = await redis.zcard('conv:all');
    
    // Messages (we need to get all convIds and check length of msg lists)
    let totalMessages = 0;
    const allConvIds = await redis.zrange('conv:all', 0, -1);
    if (allConvIds.length > 0) {
      const pipeline = redis.pipeline();
      allConvIds.forEach(id => pipeline.llen(`msg:${id}`));
      const results = await pipeline.exec();
      results.forEach(res => {
        totalMessages += (res as number) || 0;
      });
    }

    // Recent Convs (latest 5)
    const recentConvIds = await redis.zrange('conv:all', 0, 4, { rev: true });
    const recentConvs = [];
    if (recentConvIds.length > 0) {
      const pipeline = redis.pipeline();
      recentConvIds.forEach(id => {
        pipeline.hgetall(`conv:${id}`);
        pipeline.llen(`msg:${id}`);
      });
      const results = await pipeline.exec();
      
      for (let i = 0; i < recentConvIds.length; i++) {
        const conv = results[i * 2] as any;
        const msgCount = results[i * 2 + 1] as number;
        if (conv) {
          recentConvs.push({
            id: conv.id,
            title: conv.title,
            created_at: conv.created_at,
            message_count: msgCount || 0
          });
        }
      }
    }

    const stats = {
      knowledgeSources: readyKsCount,
      totalChunks: totalChunks,
      qaPairs: activeQaCount,
      conversations: convCount,
      messages: totalMessages,
      recentConvs: recentConvs,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error('[stats] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

