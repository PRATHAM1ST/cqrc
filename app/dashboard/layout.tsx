'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  BookOpen,
  MessageSquarePlus,
  Settings,
  MessageCircle,
  Menu,
  X,
  Bot,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

const nav = [
  { name: 'Overview',       href: '/dashboard',               icon: LayoutDashboard },
  { name: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: BookOpen },
  { name: 'Q&A Pairs',      href: '/dashboard/qa-pairs',       icon: MessageSquarePlus },
  { name: 'Conversations',  href: '/dashboard/conversations',  icon: MessageCircle },
  { name: 'Settings',       href: '/dashboard/settings',       icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const crumb = nav.find((n) => n.href === pathname)?.name ?? '';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/50 transition-transform duration-200',
          'bg-card/80 backdrop-blur-xl',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 px-5 border-b border-border/50">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-500 text-primary-foreground shadow-lg shadow-primary/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">QueryBot</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Admin Dashboard</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {nav.map(({ name, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-3 h-9 font-normal transition-all',
                    active && 'font-medium bg-secondary/80'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                  <span className="truncate">{name}</span>
                  {active && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                </Button>
              </Link>
            );
          })}
        </nav>

        <Separator className="opacity-50" />

        {/* Open chatbot */}
        <div className="p-3">
          <Link href="/chat" target="_blank">
            <Button variant="outline" className="w-full justify-start gap-3 h-9 font-normal border-border/50 hover:border-primary/50 transition-colors">
              <ExternalLink className="h-4 w-4" />
              Open Chatbot
              <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                Live
              </Badge>
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border/50 bg-card/40 backdrop-blur-sm px-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            {crumb && crumb !== 'Overview' && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">{crumb}</span>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
