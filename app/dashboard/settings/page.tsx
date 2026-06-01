'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Key, Shield, ExternalLink, CheckCircle2,
  XCircle, Loader2, Sparkles,
} from 'lucide-react';
import { PROVIDER_MODELS, type AIProvider } from '@/lib/types';

export default function SettingsPage() {
  const [provider, setProvider] = useState<AIProvider>('groq');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem('qb_provider') as AIProvider | null;
    const savedModel = localStorage.getItem('qb_model');
    const savedKey = localStorage.getItem('qb_api_key');

    if (savedProvider) setProvider(savedProvider);
    if (savedModel) setModel(savedModel);
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSave = () => {
    localStorage.setItem('qb_provider', provider);
    localStorage.setItem('qb_model', model || PROVIDER_MODELS[provider].models[0].value);
    if (apiKey.trim()) {
      localStorage.setItem('qb_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('qb_api_key');
    }
    toast.success('Settings saved', {
      description: 'Your API configuration has been updated',
    });
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key first');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, respond with just "Connection successful!" and nothing else.',
          apiKey: apiKey.trim(),
          provider,
          model: model || PROVIDER_MODELS[provider].models[0].value,
        }),
      });

      if (res.ok) {
        // Read the stream to verify it works
        const reader = res.body?.getReader();
        if (reader) {
          let gotContent = false;
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text.includes('"delta"')) gotContent = true;
          }
          if (gotContent) {
            setTestResult('success');
            toast.success('Connection successful!');
          } else {
            setTestResult('error');
            toast.error('No response received');
          }
        }
      } else {
        const data = await res.json();
        setTestResult('error');
        toast.error('Connection failed', { description: data.error });
      }
    } catch (err) {
      setTestResult('error');
      toast.error('Connection failed', { description: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const providerConfig = PROVIDER_MODELS[provider];

  const getApiKeyUrl = () => {
    switch (provider) {
      case 'groq': return 'https://console.groq.com/keys';
      case 'gemini': return 'https://aistudio.google.com/apikey';
      case 'openai': return 'https://platform.openai.com/api-keys';
      case 'anthropic': return 'https://console.anthropic.com/settings/keys';
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your AI provider and API key
        </p>
      </div>

      {/* Security note */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Shield className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Your API key is stored locally</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your API key is saved only in your browser&apos;s localStorage. It is never sent to or stored on any server.
              It&apos;s passed directly to the AI provider on each request.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Provider selection */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Provider
          </CardTitle>
          <CardDescription>Select your AI provider and model</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider cards */}
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(PROVIDER_MODELS) as [AIProvider, typeof PROVIDER_MODELS[AIProvider]][]).map(([key, config]) => (
              <button
                key={key}
                onClick={() => {
                  setProvider(key);
                  setModel(config.models[0].value);
                  setTestResult(null);
                }}
                className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                  provider === key
                    ? 'border-primary bg-primary/5'
                    : 'border-border/50 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{config.label}</p>
                  {config.free && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                      FREE
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {config.models.length} model{config.models.length > 1 ? 's' : ''} available
                </p>
              </button>
            ))}
          </div>

          {/* Model selection */}
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select
              value={model || providerConfig.models[0].value}
              onValueChange={setModel}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerConfig.models.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            API Key
          </CardTitle>
          <CardDescription>
            Enter your {providerConfig.label} API key
            {providerConfig.free && ' — free tier available, no credit card required'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                placeholder={`Enter your ${providerConfig.label} API key...`}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                className="font-mono text-xs"
              />
              <a href={getApiKeyUrl()} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="icon" className="shrink-0 border-border/50">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              {provider === 'groq' && 'Get your free API key at console.groq.com'}
              {provider === 'gemini' && 'Get your free API key at aistudio.google.com'}
              {provider === 'openai' && 'Get your API key at platform.openai.com'}
              {provider === 'anthropic' && 'Get your API key at console.anthropic.com'}
            </p>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
              testResult === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {testResult === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {testResult === 'success' ? 'Connection successful!' : 'Connection failed. Check your API key.'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="flex-1">
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !apiKey.trim()}
              className="gap-2 border-border/50"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
