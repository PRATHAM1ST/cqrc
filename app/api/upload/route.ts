import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/db';
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

    const sourceId = nanoid();
    const now = new Date().toISOString();

    // Insert source record with "processing" status
    await redis.hset(`ks:${sourceId}`, {
      id: sourceId,
      name: file.name,
      type: ext,
      size: file.size,
      chunks_count: 0,
      created_at: now,
      status: 'processing',
      error_message: '',
    });
    await redis.sadd('ks:all', sourceId);

    // Parse the file
    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;

    try {
      text = await parseFile(buffer, file.name);
    } catch (err) {
      await redis.hset(`ks:${sourceId}`, {
        status: 'error',
        error_message: String(err),
      });
      return NextResponse.json({ error: `Failed to parse file: ${err}` }, { status: 422 });
    }

    if (!text || text.trim().length < 10) {
      await redis.hset(`ks:${sourceId}`, {
        status: 'error',
        error_message: 'File appears to be empty or could not be read',
      });
      return NextResponse.json({ error: 'File appears to be empty' }, { status: 422 });
    }

    // Chunk and store
    const rawChunks = chunkText(text);

    if (rawChunks.length === 0) {
      await redis.hset(`ks:${sourceId}`, {
        status: 'error',
        error_message: 'No usable text found in file',
      });
      return NextResponse.json({ error: 'No usable text found in file' }, { status: 422 });
    }

    const pipeline = redis.pipeline();

    rawChunks.forEach((content, idx) => {
      const chunkObj = {
        id: nanoid(),
        source_id: sourceId,
        content,
        chunk_index: idx,
        metadata: JSON.stringify({ fileName: file.name, fileType: ext, chunkIndex: idx }),
      };
      pipeline.rpush(`chunks:${sourceId}`, JSON.stringify(chunkObj));
    });

    pipeline.hset(`ks:${sourceId}`, {
      status: 'ready',
      chunks_count: rawChunks.length,
    });

    await pipeline.exec();

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

