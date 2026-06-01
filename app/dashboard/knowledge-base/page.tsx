'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Upload, FileText, Trash2, RefreshCw, FileSpreadsheet,
  File, CheckCircle2, XCircle, Clock, Layers,
} from 'lucide-react';
import type { KnowledgeSource } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, xlsx: FileSpreadsheet, xls: FileSpreadsheet,
  csv: FileSpreadsheet, docx: FileText, doc: FileText,
  txt: File, md: File,
};

function fileIcon(type: string) {
  const Icon = FILE_ICONS[type] ?? File;
  return <Icon className="h-4 w-4" />;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const STATUS_CONFIG = {
  ready:      { label: 'Ready',      color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: CheckCircle2 },
  processing: { label: 'Processing', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',   icon: Clock },
  error:      { label: 'Error',      color: 'bg-red-500/10 text-red-400 border-red-500/20',      icon: XCircle },
};

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSources = useCallback(async () => {
    const res = await fetch('/api/knowledge');
    const data = await res.json();
    setSources(data.sources ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      setUploading(true);
      setUploadProgress(10);

      const formData = new FormData();
      formData.append('file', file);

      try {
        setUploadProgress(40);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        setUploadProgress(80);
        const data = await res.json();

        if (!res.ok) {
          toast.error(`Failed to upload "${file.name}"`, { description: data.error });
        } else {
          toast.success(`"${file.name}" uploaded successfully`, {
            description: `Created ${data.chunksCount} searchable chunks`,
          });
          await fetchSources();
        }
      } catch (err) {
        toast.error(`Upload failed: ${err}`);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string, name: string) => {
    const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success(`"${name}" deleted`);
      setSources((s) => s.filter((x) => x.id !== id));
    } else {
      toast.error('Failed to delete');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload documents to power your chatbot&apos;s answers
        </p>
      </div>

      {/* Upload zone */}
      <Card
        className={`border-2 border-dashed transition-all cursor-pointer ${
          dragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/50 hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className={`rounded-full p-4 mb-4 transition-colors ${
            dragging ? 'bg-primary/10' : 'bg-muted/50'
          }`}>
            <Upload className={`h-8 w-8 transition-colors ${
              dragging ? 'text-primary' : 'text-muted-foreground'
            }`} />
          </div>
          <p className="font-semibold text-base">
            {dragging ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Supports: PDF, DOC, DOCX, XLSX, XLS, CSV, TXT, MD
          </p>

          {uploading && (
            <div className="w-full max-w-xs mt-6 space-y-2">
              <Progress value={uploadProgress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">Processing file...</p>
            </div>
          )}
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.md"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Sources list */}
      <Card className="border-border/50">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Uploaded Documents</CardTitle>
            <CardDescription>{sources.length} document{sources.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchSources} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No documents uploaded yet</p>
              <p className="text-sm mt-1">Upload your first document to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sources.map((source) => {
                const cfg = STATUS_CONFIG[source.status];
                const StatusIcon = cfg.icon;
                return (
                  <div key={source.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 text-muted-foreground">
                      {fileIcon(source.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{source.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(source.size)}
                        </span>
                        {source.chunks_count > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {source.chunks_count} chunks
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {source.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 truncate">{source.error_message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete document?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete &quot;{source.name}&quot; and all {source.chunks_count} associated chunks.
                              The chatbot will no longer use this knowledge.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(source.id, source.name)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
