import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/db';
import type { QAPair } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// GET — list all Q&A pairs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.toLowerCase();

    const qaIds = await redis.smembers('qa:all');
    let pairs: QAPair[] = [];
    const categoriesSet = new Set<string>();

    if (qaIds.length > 0) {
      const pipeline = redis.pipeline();
      qaIds.forEach(id => pipeline.hgetall(`qa:${id}`));
      const results = await pipeline.exec();
      
      results.forEach(res => {
        const qa = res as unknown as QAPair;
        if (qa && qa.id) {
          // Normalize types
          if (qa.active !== undefined) qa.active = Number(qa.active);
          pairs.push(qa);
          categoriesSet.add(qa.category || 'General');
        }
      });
    }

    // Filter
    if (category && category !== 'all') {
      pairs = pairs.filter(p => p.category === category);
    }

    if (search) {
      pairs = pairs.filter(p => 
        p.question.toLowerCase().includes(search) || 
        p.answer.toLowerCase().includes(search)
      );
    }

    // Sort by updated_at desc
    pairs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const categories = Array.from(categoriesSet).sort();

    return NextResponse.json({
      pairs,
      categories,
    });
  } catch (err) {
    console.error('[qa get] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — create new Q&A pair
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, category = 'General' } = body;

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { error: 'Question and answer are required' },
        { status: 400 }
      );
    }

    const id = nanoid();
    const now = new Date().toISOString();

    const pair = {
      id,
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim() || 'General',
      created_at: now,
      updated_at: now,
      active: 1
    };

    const pipeline = redis.pipeline();
    pipeline.hset(`qa:${id}`, pair);
    pipeline.sadd('qa:all', id);
    await pipeline.exec();

    return NextResponse.json({ success: true, pair }, { status: 201 });
  } catch (err) {
    console.error('[qa post] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

