'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot, Send, Plus, MessageCircle, ArrowLeft, Sparkles,
  FileText, Loader2, AlertTriangle,
} from 'lucide-react';
import { PROVIDER_MODELS, type AIProvider } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  isStreaming?: boolean;
}

interface ConvItem {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Read settings from localStorage
  const getSettings = useCallback(() => {
    const apiKey = localStorage.getItem('qb_api_key') || '';
    const provider = (localStorage.getItem('qb_provider') || 'groq') as AIProvider;
    const model = localStorage.getItem('qb_model') || PROVIDER_MODELS[provider].models[0].value;
    return { apiKey, provider, model };
  }, []);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load conversation messages
  const loadConversation = async (id: string) => {
    setConversationId(id);
    setSidebarOpen(false);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setMessages(
        (data.messages ?? []).map((m: { id: string; role: string; content: string; sources?: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.sources ? JSON.parse(m.sources) : undefined,
        }))
      );
    } catch {
      setError('Failed to load conversation');
    }
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    const { apiKey, provider, model } = getSettings();
    if (!apiKey) {
      setError('No API key configured. Go to Dashboard → Settings to add your free Groq or Gemini key.');
      return;
    }

    setError(null);
    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
    };

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          conversationId,
          apiKey,
          provider,
          model,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to get response');
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let sources: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'meta') {
              if (parsed.conversationId && !conversationId) {
                setConversationId(parsed.conversationId);
              }
              if (parsed.sources) {
                sources = parsed.sources;
              }
            } else if (parsed.type === 'delta') {
              fullText += parsed.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: fullText, isStreaming: true }
                    : m
                )
              );
            } else if (parsed.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: fullText, isStreaming: false, sources: sources.length > 0 ? sources : undefined }
                    : m
                )
              );
            } else if (parsed.type === 'error') {
              setError(parsed.message);
            }
          } catch { /* skip malformed */ }
        }
      }

      fetchConversations();
    } catch (err) {
      setError(`Network error: ${err}`);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const hasApiKey = mounted && !!localStorage.getItem('qb_api_key');

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Conversation sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-card/90 backdrop-blur-xl border-r border-border/50 flex flex-col transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:static md:translate-x-0`}>
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">QueryBot</span>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="h-3 w-3" />
              Dashboard
            </Button>
          </Link>
        </div>

        <div className="p-3">
          <Button onClick={startNewChat} className="w-full gap-2 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 pb-3 space-y-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors truncate ${
                  conversationId === c.id ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.title}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-border/50 bg-card/40 backdrop-blur-sm shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSidebarOpen(true)}>
            <MessageCircle className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {conversationId ? 'Chat' : 'New Conversation'}
            </span>
          </div>
          {hasApiKey && (
            <Badge variant="secondary" className="ml-auto text-[10px] capitalize">
              {localStorage.getItem('qb_provider') || 'groq'}
            </Badge>
          )}
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold mb-2">How can I help you?</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Ask me anything about your uploaded documents and knowledge base.
                  I&apos;ll provide accurate answers based on your data.
                </p>
                {!hasApiKey && (
                  <Link href="/dashboard/settings">
                    <Button variant="outline" className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4" />
                      Set up API Key to start
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 animate-fade-in-up ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
                    <div className={`rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border border-border/50 rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="prose-chat">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content || ' '}
                          </ReactMarkdown>
                          {msg.isStreaming && (
                            <span className="inline-flex gap-1 ml-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {/* Source citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.sources.map((src, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] gap-1 font-normal">
                            <FileText className="h-2.5 w-2.5" />
                            {src}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-border/50 bg-card/40 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={loading}
                className="flex-1 bg-background/50 border-border/50 focus:border-primary/50"
                autoFocus
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="gap-2 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 shadow-lg shadow-primary/10 px-6"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              QueryBot answers based on your uploaded documents and Q&A pairs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
