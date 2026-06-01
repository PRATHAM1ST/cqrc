import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { KnowledgeSource } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const sources = db
      .prepare(
        `SELECT id, name, type, size, chunks_count, created_at, status, error_message
         FROM knowledge_sources
         ORDER BY created_at DESC`
      )
      .all() as KnowledgeSource[];

    return NextResponse.json({ sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
