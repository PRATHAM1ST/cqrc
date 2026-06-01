import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const conversation = await redis.hgetall(`conv:${id}`);

    if (!conversation || Object.keys(conversation).length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rawMsgs = await redis.lrange(`msg:${id}`, 0, -1);
    const messages = rawMsgs.map(m => typeof m === 'string' ? JSON.parse(m) : m);

    return NextResponse.json({ conversation, messages });
  } catch (err) {
    console.error('[conv get] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const exists = await redis.exists(`conv:${id}`);
    if (!exists) {
      return NextResponse.json({ success: true }); // already deleted
    }

    const pipeline = redis.pipeline();
    pipeline.del(`conv:${id}`);
    pipeline.del(`msg:${id}`);
    pipeline.zrem('conv:all', id);
    await pipeline.exec();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[conv delete] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

