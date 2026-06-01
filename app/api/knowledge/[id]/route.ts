import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const source = db
      .prepare('SELECT id FROM knowledge_sources WHERE id = ?')
      .get(id);

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Cascades to chunks via FK
    db.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const source = db
      .prepare('SELECT * FROM knowledge_sources WHERE id = ?')
      .get(id);

    if (!source) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const chunks = db
      .prepare(
        'SELECT id, content, chunk_index FROM chunks WHERE source_id = ? ORDER BY chunk_index LIMIT 5'
      )
      .all(id);

    return NextResponse.json({ source, previewChunks: chunks });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
