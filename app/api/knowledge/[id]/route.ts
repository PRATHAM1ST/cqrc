import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const exists = await redis.exists(`ks:${id}`);

    if (!exists) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const pipeline = redis.pipeline();
    pipeline.del(`ks:${id}`);
    pipeline.del(`chunks:${id}`);
    pipeline.srem('ks:all', id);
    await pipeline.exec();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[knowledge delete] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const source = await redis.hgetall(`ks:${id}`);

    if (!source || Object.keys(source).length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Convert numbers
    if (source.size !== undefined) source.size = Number(source.size);
    if (source.chunks_count !== undefined) source.chunks_count = Number(source.chunks_count);

    const rawChunks = await redis.lrange(`chunks:${id}`, 0, 4);
    const chunks = rawChunks.map(c => {
      const parsed = typeof c === 'string' ? JSON.parse(c) : c;
      return {
        id: parsed.id,
        content: parsed.content,
        chunk_index: parsed.chunk_index
      };
    });

    return NextResponse.json({ source, previewChunks: chunks });
  } catch (err) {
    console.error('[knowledge get] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

