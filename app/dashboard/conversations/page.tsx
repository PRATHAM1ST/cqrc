'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  MessageCircle, Trash2, ChevronRight, User, Bot,
  Clock, ArrowLeft, Trash,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation, Message } from '@/lib/types';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<(Conversation & { message_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    setConversations(data.conversations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Check URL for pre-selected conversation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setSelectedId(id);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setMessagesLoading(true);
    fetch(`/api/conversations/${selectedId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? []);
      })
      .finally(() => setMessagesLoading(false));
  }, [selectedId]);

  const handleDeleteOne = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Conversation deleted');
      setConversations((c) => c.filter((x) => x.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setMessages([]);
      }
    }
  };

  const handleDeleteAll = async () => {
    const res = await fetch('/api/conversations', { method: 'DELETE' });
    if (res.ok) {
      toast.success('All conversations deleted');
      setConversations([]);
      setSelectedId(null);
      setMessages([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conversations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage chatbot conversation history
          </p>
        </div>
        {conversations.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash className="h-3.5 w-3.5" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all conversations?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {conversations.length} conversations and their messages. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '60vh' }}>
        {/* Conversation list */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">All Conversations</CardTitle>
            <CardDescription>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground px-4">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedId === c.id ? 'bg-muted/70' : ''
                      }`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">{c.message_count}</Badge>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages view */}
        <Card className="border-border/50 lg:col-span-2">
          {!selectedId ? (
            <CardContent className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Click a conversation to view its messages</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="flex-row items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={() => setSelectedId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle className="text-base truncate max-w-[300px]">
                      {conversations.find((c) => c.id === selectedId)?.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {messages.length} messages
                    </CardDescription>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteOne(selectedId)} className="bg-destructive hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {messagesLoading ? (
                    <div className="p-6 space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                              <Bot className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted/50 rounded-bl-md'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-[10px] mt-1.5 ${
                              msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}>
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          {msg.role === 'user' && (
                            <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                              <User className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
