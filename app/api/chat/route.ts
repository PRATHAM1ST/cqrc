import { NextRequest, NextResponse } from 'next/server';
import { searchChunks, searchQAPairs, buildContext } from '@/lib/search';
import { redis } from '@/lib/db';
import type { AIProvider } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Default model per provider ─────────────────────────────────────────────────
const DEFAULT_MODELS: Record<AIProvider, string> = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEncoder() {
  const enc = new TextEncoder();
  return (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    message,
    conversationId,
    apiKey,
    provider = 'groq',
    model,
  } = body as {
    message: string;
    conversationId?: string;
    apiKey: string;
    provider: AIProvider;
    model?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'API key is required. Please set it in the Admin Dashboard → Settings.' },
      { status: 400 }
    );
  }

  // ── RAG context retrieval ──────────────────────────────────────────────────
  const chunks = await searchChunks(message, 5);
  const qaPairs = await searchQAPairs(message, 3);
  const { context, sources } = buildContext(chunks, qaPairs);

  const hasContext = context.length > 0;

  const systemPrompt = hasContext
    ? `You are a helpful, accurate, and conversational customer support assistant.

Answer the customer's question using ONLY the information provided in the context below.
Be friendly, clear, and concise. If the context contains a direct Q&A match, prefer that answer.
If the context does not have enough information to answer accurately, say so honestly and suggest
the customer contact support directly — do NOT make up information.

When referencing information, you may mention the source document name naturally (e.g. "According to our documentation...").

--- CONTEXT START ---
${context}
--- CONTEXT END ---`
    : `You are a helpful customer support assistant. 
The knowledge base does not contain specific information about this topic.
Be honest about this limitation — say something like "I don't have specific information about that in my knowledge base."
Suggest the customer contact your support team directly for detailed assistance.
Do NOT make up or guess any information.`;

  const actualModel = model || DEFAULT_MODELS[provider];

  // ── Persist conversation & user message ───────────────────────────────────
  let convId = conversationId;

  if (!convId) {
    convId = nanoid();
    const title =
      message.length > 60 ? message.slice(0, 57) + '...' : message;
    await redis.hset(`conv:${convId}`, {
      id: convId,
      title,
      created_at: new Date().toISOString()
    });
    await redis.zadd('conv:all', { score: Date.now(), member: convId });
  }

  await redis.rpush(`msg:${convId}`, JSON.stringify({
    id: nanoid(),
    role: 'user',
    content: message,
    created_at: new Date().toISOString()
  }));

  // ── Build message history ─────────────────────────────────────────────────
  const rawHistory = await redis.lrange(`msg:${convId}`, -20, -1);
  const dbHistory = rawHistory.map(m => typeof m === 'string' ? JSON.parse(m) : m)
    .map((m: any) => ({ role: m.role, content: m.content }));

  const messagesForAI = dbHistory.slice(-12); // Keep last 12 for context window

  // ── Call AI provider ──────────────────────────────────────────────────────
  let aiResponse: Response;

  try {
    if (provider === 'groq' || provider === 'openai') {
      const baseURL =
        provider === 'groq'
          ? 'https://api.groq.com/openai/v1'
          : 'https://api.openai.com/v1';

      aiResponse = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: actualModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messagesForAI,
          ],
          stream: true,
          max_tokens: 1200,
          temperature: 0.4,
        }),
      });
    } else if (provider === 'anthropic') {
      aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: actualModel,
          system: systemPrompt,
          messages: messagesForAI
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          max_tokens: 1200,
        }),
      });
    } else if (provider === 'gemini') {
      // Convert messages: alternate user/model, merge consecutive same-role
      const geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

      for (const msg of messagesForAI) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const last = geminiMessages[geminiMessages.length - 1];
        if (last && last.role === role) {
          last.parts[0].text += '\n' + msg.content;
        } else {
          geminiMessages.push({ role, parts: [{ text: msg.content }] });
        }
      }

      // Ensure first message is user
      if (geminiMessages[0]?.role !== 'user') {
        geminiMessages.unshift({ role: 'user', parts: [{ text: '(start)' }] });
      }

      aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:streamGenerateContent?key=${apiKey}&alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiMessages,
            generationConfig: { maxOutputTokens: 1200, temperature: 0.4 },
          }),
        }
      );
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }
  } catch (fetchErr) {
    return NextResponse.json(
      { error: `Failed to reach AI provider: ${fetchErr}` },
      { status: 502 }
    );
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text().catch(() => aiResponse.statusText);
    return NextResponse.json(
      { error: `AI provider error (${aiResponse.status}): ${errText}` },
      { status: 502 }
    );
  }

  // ── Stream SSE back to client ─────────────────────────────────────────────
  const encode = makeEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      // First chunk: metadata (conversationId + sources)
      controller.enqueue(
        encode({ type: 'meta', conversationId: convId, sources })
      );

      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining buffered data
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (!data || data === '[DONE]') continue;
                
                let text = '';
                try {
                  const parsed = JSON.parse(data);
                  if (provider === 'groq' || provider === 'openai') {
                    text = parsed.choices?.[0]?.delta?.content ?? '';
                  } else if (provider === 'anthropic') {
                    if (parsed.type === 'content_block_delta') {
                      text = parsed.delta?.text ?? '';
                    }
                  } else if (provider === 'gemini') {
                    // Old format: candidates[].content.parts[].text
                    text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                    // New format: delta.text (content.delta / step.delta events)
                    if (!text && parsed.delta?.type === 'text') {
                      text = parsed.delta.text ?? '';
                    }
                  }
                } catch {}
                if (text) {
                  fullResponse += text;
                  controller.enqueue(encode({ type: 'delta', content: text }));
                }
              }
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            let text = '';
            try {
              const parsed = JSON.parse(data);

              if (provider === 'groq' || provider === 'openai') {
                text = parsed.choices?.[0]?.delta?.content ?? '';
              } else if (provider === 'anthropic') {
                if (parsed.type === 'content_block_delta') {
                  text = parsed.delta?.text ?? '';
                }
              } else if (provider === 'gemini') {
                // Old format: candidates[].content.parts[].text
                text =
                  parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                // New format: delta.text (content.delta / step.delta events)
                if (!text && parsed.delta?.type === 'text') {
                  text = parsed.delta.text ?? '';
                }
              }
            } catch {
              // Malformed JSON line — skip
            }

            if (text) {
              fullResponse += text;
              controller.enqueue(encode({ type: 'delta', content: text }));
            }
          }
        }

        // Save assistant message
        if (fullResponse.trim()) {
          const sourcesObj = sources.length > 0 ? JSON.stringify(sources) : null;
          await redis.rpush(`msg:${convId}`, JSON.stringify({
            id: nanoid(),
            role: 'assistant',
            content: fullResponse.trim(),
            created_at: new Date().toISOString(),
            sources: sourcesObj
          }));
        }

        controller.enqueue(encode({ type: 'done' }));
        controller.close();
      } catch (err) {
        controller.enqueue(encode({ type: 'error', message: String(err) }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
