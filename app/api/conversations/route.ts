import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const conversations = db
      .prepare(
        `SELECT c.id, c.title, c.created_at,
                COUNT(m.id) as message_count
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         GROUP BY c.id
         ORDER BY c.created_at DESC
         LIMIT 50`
      )
      .all();

    return NextResponse.json({ conversations });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const db = getDb();

    if (id) {
      db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    } else {
      db.prepare('DELETE FROM conversations').run();
      db.prepare('DELETE FROM messages').run();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
