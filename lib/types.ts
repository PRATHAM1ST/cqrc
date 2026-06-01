export interface KnowledgeSource {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'docx' | 'xlsx' | 'xls' | 'csv' | 'txt' | 'md';
  size: number;
  chunks_count: number;
  created_at: string;
  status: 'processing' | 'ready' | 'error';
  error_message?: string;
}

export interface Chunk {
  id: string;
  source_id: string;
  content: string;
  chunk_index: number;
  metadata: string;
}

export interface QAPair {
  id: string;
  question: string;
  answer: string;
  category: string;
  created_at: string;
  updated_at: string;
  active: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  message_count?: number;
}

export type AIProvider = 'groq' | 'openai' | 'anthropic' | 'gemini';

export interface ChatRequest {
  message: string;
  conversationId?: string;
  apiKey: string;
  provider: AIProvider;
  model?: string;
  history?: Array<{ role: string; content: string }>;
}

export interface SearchResult {
  chunkId: string;
  content: string;
  sourceName: string;
  score: number;
}

export interface DashboardStats {
  knowledgeSources: number;
  totalChunks: number;
  qaPairs: number;
  conversations: number;
  messages: number;
  recentConvs: Array<{ id: string; title: string; created_at: string; message_count: number }>;
}

export const PROVIDER_MODELS: Record<AIProvider, { label: string; free: boolean; models: { value: string; label: string }[] }> = {
  groq: {
    label: 'Groq',
    free: true,
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Recommended)' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fastest)' },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    free: true,
    models: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Latest)' },
    ],
  },
  openai: {
    label: 'OpenAI',
    free: false,
    models: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    free: false,
    models: [
      { value: 'claude-haiku-4-5', label: 'Claude Haiku (Fastest)' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet' },
    ],
  },
};
