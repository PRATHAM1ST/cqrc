import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseFile, chunkText, SUPPORTED_EXTENSIONS } from '@/lib/file-processor';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase().replace('.', '');
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const db = getDb();
    const sourceId = nanoid();
    const now = new Date().toISOString();

    // Insert source record with "processing" status
    db.prepare(
      `INSERT INTO knowledge_sources (id, name, type, size, chunks_count, created_at, status)
       VALUES (?, ?, ?, ?, 0, ?, 'processing')`
    ).run(sourceId, file.name, ext, file.size, now);

    // Parse the file
    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;

    try {
      text = await parseFile(buffer, file.name);
    } catch (err) {
      db.prepare(
        `UPDATE knowledge_sources SET status = 'error', error_message = ? WHERE id = ?`
      ).run(String(err), sourceId);
      return NextResponse.json({ error: `Failed to parse file: ${err}` }, { status: 422 });
    }

    if (!text || text.trim().length < 10) {
      db.prepare(
        `UPDATE knowledge_sources SET status = 'error', error_message = ? WHERE id = ?`
      ).run('File appears to be empty or could not be read', sourceId);
      return NextResponse.json({ error: 'File appears to be empty' }, { status: 422 });
    }

    // Chunk and store
    const rawChunks = chunkText(text);

    if (rawChunks.length === 0) {
      db.prepare(
        `UPDATE knowledge_sources SET status = 'error', error_message = ? WHERE id = ?`
      ).run('No usable text found in file', sourceId);
      return NextResponse.json({ error: 'No usable text found in file' }, { status: 422 });
    }

    const insertChunk = db.prepare(
      `INSERT INTO chunks (id, source_id, content, chunk_index, metadata) VALUES (?, ?, ?, ?, ?)`
    );

    const insertAll = db.transaction((chunks: string[]) => {
      chunks.forEach((content, idx) => {
        insertChunk.run(
          nanoid(),
          sourceId,
          content,
          idx,
          JSON.stringify({ fileName: file.name, fileType: ext, chunkIndex: idx })
        );
      });
    });

    insertAll(rawChunks);

    db.prepare(
      `UPDATE knowledge_sources SET status = 'ready', chunks_count = ? WHERE id = ?`
    ).run(rawChunks.length, sourceId);

    return NextResponse.json({
      success: true,
      sourceId,
      chunksCount: rawChunks.length,
      message: `Successfully processed "${file.name}" into ${rawChunks.length} searchable chunks`,
    });
  } catch (err) {
    console.error('[upload] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
