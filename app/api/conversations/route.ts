import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const convIds = await redis.zrange('conv:all', 0, 49, { rev: true });
    const conversations = [];

    if (convIds.length > 0) {
      const pipeline = redis.pipeline();
      convIds.forEach(id => {
        pipeline.hgetall(`conv:${id}`);
        pipeline.llen(`msg:${id}`);
      });
      const results = await pipeline.exec();

      for (let i = 0; i < convIds.length; i++) {
        const conv = results[i * 2] as any;
        const msgCount = results[i * 2 + 1] as number;
        if (conv && conv.id) {
          conversations.push({
            id: conv.id,
            title: conv.title,
            created_at: conv.created_at,
            message_count: msgCount || 0
          });
        }
      }
    }

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('[conv list] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const pipeline = redis.pipeline();
      pipeline.del(`conv:${id}`);
      pipeline.del(`msg:${id}`);
      pipeline.zrem('conv:all', id);
      await pipeline.exec();
    } else {
      // Clear all
      const allIds = await redis.zrange('conv:all', 0, -1);
      if (allIds.length > 0) {
        const pipeline = redis.pipeline();
        allIds.forEach(cid => {
          pipeline.del(`conv:${cid}`);
          pipeline.del(`msg:${cid}`);
        });
        pipeline.del('conv:all');
        await pipeline.exec();
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[conv delete all] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

