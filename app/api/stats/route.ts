import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();

    const stats = {
      knowledgeSources: (db.prepare(`SELECT COUNT(*) as n FROM knowledge_sources WHERE status = 'ready'`).get() as { n: number }).n,
      totalChunks:      (db.prepare(`SELECT COUNT(*) as n FROM chunks`).get() as { n: number }).n,
      qaPairs:          (db.prepare(`SELECT COUNT(*) as n FROM qa_pairs WHERE active = 1`).get() as { n: number }).n,
      conversations:    (db.prepare(`SELECT COUNT(*) as n FROM conversations`).get() as { n: number }).n,
      messages:         (db.prepare(`SELECT COUNT(*) as n FROM messages`).get() as { n: number }).n,
      recentConvs:      db.prepare(
        `SELECT c.id, c.title, c.created_at, COUNT(m.id) as message_count
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         GROUP BY c.id ORDER BY c.created_at DESC LIMIT 5`
      ).all(),
    };

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
