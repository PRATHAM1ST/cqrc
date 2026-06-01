import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { QAPair } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// GET — list all Q&A pairs
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = `SELECT * FROM qa_pairs`;
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (category && category !== 'all') {
      conditions.push(`category = ?`);
      args.push(category);
    }

    if (search) {
      conditions.push(`(question LIKE ? OR answer LIKE ?)`);
      args.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY updated_at DESC`;

    const pairs = db.prepare(query).all(...args) as QAPair[];

    // Get categories
    const categories = db
      .prepare(`SELECT DISTINCT category FROM qa_pairs ORDER BY category`)
      .all() as Array<{ category: string }>;

    return NextResponse.json({
      pairs,
      categories: categories.map((c) => c.category),
    });
  } catch (err) {
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

    const db = getDb();
    const id = nanoid();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO qa_pairs (id, question, answer, category, created_at, updated_at, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(id, question.trim(), answer.trim(), category.trim() || 'General', now, now);

    const created = db.prepare('SELECT * FROM qa_pairs WHERE id = ?').get(id);
    return NextResponse.json({ success: true, pair: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
