import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT — update Q&A pair
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const existing = await redis.hgetall(`qa:${id}`);
    if (!existing || Object.keys(existing).length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { question, answer, category, active } = body;

    const updates: Record<string, string | number> = {};

    if (question !== undefined) updates.question = question.trim();
    if (answer !== undefined)   updates.answer = answer.trim();
    if (category !== undefined) updates.category = category.trim();
    if (active !== undefined)   updates.active = active ? 1 : 0;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    await redis.hset(`qa:${id}`, updates);

    const updated = await redis.hgetall(`qa:${id}`);
    
    // Normalize numeric fields for consistency
    if (updated && updated.active !== undefined) updated.active = Number(updated.active);

    return NextResponse.json({ success: true, pair: updated });
  } catch (err) {
    console.error('[qa update] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove Q&A pair
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const exists = await redis.exists(`qa:${id}`);
    if (!exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const pipeline = redis.pipeline();
    pipeline.del(`qa:${id}`);
    pipeline.srem('qa:all', id);
    await pipeline.exec();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[qa delete] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

