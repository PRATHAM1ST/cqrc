'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Edit, MessageSquarePlus, CheckCircle, Circle } from 'lucide-react';
import type { QAPair } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

const CATEGORIES = ['General', 'Pricing', 'Technical', 'Returns', 'Shipping', 'Account', 'Other'];

function QADialog({
  pair,
  onSaved,
  trigger,
}: {
  pair?: QAPair;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    question: pair?.question ?? '',
    answer: pair?.answer ?? '',
    category: pair?.category ?? 'General',
  });

  useEffect(() => {
    if (open) {
      setForm({
        question: pair?.question ?? '',
        answer: pair?.answer ?? '',
        category: pair?.category ?? 'General',
      });
    }
  }, [open, pair]);

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error('Question and answer are required');
      return;
    }

    setSaving(true);
    try {
      const url = pair ? `/api/qa/${pair.id}` : '/api/qa';
      const method = pair ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? 'Failed to save');
      } else {
        toast.success(pair ? 'Q&A pair updated' : 'Q&A pair created');
        setOpen(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pair ? 'Edit Q&A Pair' : 'Add Q&A Pair'}</DialogTitle>
          <DialogDescription>
            {pair
              ? 'Update the question, answer, or category.'
              : 'Create a custom Q&A pair that the chatbot will use when answering related queries.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              placeholder="e.g. What is your return policy?"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              placeholder="e.g. We offer a 30-day return policy on all items..."
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              rows={5}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: cat }))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    form.category === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border/50 hover:border-primary/50 text-muted-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : pair ? 'Save Changes' : 'Create Pair'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function QAPairsPage() {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const fetchPairs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCat !== 'all') params.set('category', filterCat);
    if (search) params.set('search', search);

    const res = await fetch(`/api/qa?${params}`);
    const data = await res.json();
    setPairs(data.pairs ?? []);
    setCategories(data.categories ?? []);
    setLoading(false);
  }, [filterCat, search]);

  useEffect(() => {
    const t = setTimeout(fetchPairs, 200);
    return () => clearTimeout(t);
  }, [fetchPairs]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/qa/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Q&A pair deleted');
      fetchPairs();
    } else {
      toast.error('Failed to delete');
    }
  };

  const handleToggle = async (pair: QAPair) => {
    const res = await fetch(`/api/qa/${pair.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: pair.active === 0 ? 1 : 0 }),
    });
    if (res.ok) {
      fetchPairs();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Q&A Pairs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Custom question-answer pairs for precise chatbot responses
          </p>
        </div>
        <QADialog
          onSaved={fetchPairs}
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Q&A Pair
            </Button>
          }
        />
      </div>

      {/* Search & filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions and answers..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {['all', ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all capitalize ${
              filterCat === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border/50 hover:border-primary/50 text-muted-foreground'
            }`}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Pairs list */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-muted/50 animate-pulse" />
          ))
        ) : pairs.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-16 text-center text-muted-foreground">
              <MessageSquarePlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No Q&A pairs found</p>
              <p className="text-sm mt-1">
                {search || filterCat !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Add your first Q&A pair to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          pairs.map((pair) => (
            <Card
              key={pair.id}
              className={`transition-all border-border/50 ${pair.active === 0 ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                        {pair.category}
                      </Badge>
                      {pair.active === 1 ? (
                        <span className="text-xs text-green-400 flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle className="h-3 w-3 shrink-0" /> Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                          <Circle className="h-3 w-3 shrink-0" /> Inactive
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(pair.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{pair.question}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {pair.answer}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={pair.active === 1}
                      onCheckedChange={() => handleToggle(pair)}
                      className="scale-75"
                    />
                    <QADialog
                      pair={pair}
                      onSaved={fetchPairs}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this Q&A pair?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(pair.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
