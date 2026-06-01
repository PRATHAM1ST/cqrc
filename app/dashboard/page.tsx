'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  MessageSquarePlus,
  MessageCircle,
  FileText,
  Layers,
  ArrowRight,
  Bot,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Stats {
  knowledgeSources: number;
  totalChunks: number;
  qaPairs: number;
  conversations: number;
  messages: number;
  recentConvs: Array<{ id: string; title: string; created_at: string; message_count: number }>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <Card className="group cursor-pointer hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 border-border/50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className={`rounded-xl p-2.5 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold tabular-nums">{value}</p>
            <p className="text-sm font-medium text-foreground mt-1">{label}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const hasApiKey = typeof window !== 'undefined' && !!localStorage.getItem('qb_api_key');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your AI knowledge base and monitor chatbot activity
          </p>
        </div>
        <Link href="/chat" target="_blank">
          <Button className="gap-2 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 shadow-lg shadow-primary/20 transition-all">
            <Bot className="h-4 w-4" />
            Test Chatbot
          </Button>
        </Link>
      </div>

      {/* API key warning */}
      {!hasApiKey && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/10 p-2">
                <Bot className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium">No API key configured</p>
                <p className="text-xs text-muted-foreground">
                  Add your Groq or Gemini API key (both free) to enable the chatbot
                </p>
              </div>
            </div>
            <Link href="/dashboard/settings">
              <Button size="sm" variant="outline" className="border-amber-500/30 hover:bg-amber-500/10">Configure</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Knowledge Sources"
          value={loading ? '—' : (stats?.knowledgeSources ?? 0)}
          sub="Uploaded documents"
          href="/dashboard/knowledge-base"
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={Layers}
          label="Text Chunks"
          value={loading ? '—' : (stats?.totalChunks ?? 0)}
          sub="Searchable knowledge units"
          href="/dashboard/knowledge-base"
          color="bg-violet-500/10 text-violet-400"
        />
        <StatCard
          icon={MessageSquarePlus}
          label="Q&A Pairs"
          value={loading ? '—' : (stats?.qaPairs ?? 0)}
          sub="Active custom answers"
          href="/dashboard/qa-pairs"
          color="bg-green-500/10 text-green-400"
        />
        <StatCard
          icon={MessageCircle}
          label="Conversations"
          value={loading ? '—' : (stats?.conversations ?? 0)}
          sub={`${stats?.messages ?? 0} total messages`}
          href="/dashboard/conversations"
          color="bg-orange-500/10 text-orange-400"
        />
      </div>

      {/* Quick actions + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick actions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Jump to common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/knowledge-base">
              <Button variant="outline" className="w-full justify-between border-border/50 hover:border-primary/50 transition-colors">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-400" />
                  Upload Knowledge Document
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/qa-pairs">
              <Button variant="outline" className="w-full justify-between border-border/50 hover:border-primary/50 transition-colors">
                <span className="flex items-center gap-2">
                  <MessageSquarePlus className="h-4 w-4 text-green-400" />
                  Add Custom Q&A Pair
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/settings">
              <Button variant="outline" className="w-full justify-between border-border/50 hover:border-primary/50 transition-colors">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-400" />
                  Configure AI Provider
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent conversations */}
        <Card className="border-border/50">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Conversations</CardTitle>
              <CardDescription>Latest chatbot interactions</CardDescription>
            </div>
            <Link href="/dashboard/conversations">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : stats?.recentConvs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start chatting to see activity here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats?.recentConvs.map((c) => (
                  <Link key={c.id} href={`/dashboard/conversations?id=${c.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageCircle className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {c.message_count} msg
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
