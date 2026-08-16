import { useState, useRef, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { invokeApi } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Send } from 'lucide-react';

interface ChatMsg { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  'Which source drives the most bookings?',
  'Where is my open pipeline concentrated?',
  'How is my lead funnel converting?',
];

/**
 * Ask-your-pipeline chat. Sends the question + conversation history to the
 * server-only `crmChat` route (Claude), which pulls the CRM data itself via
 * read-only tools and answers; renders the reply.
 */
export default function CrmChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setError('');
    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    try {
      const { answer } = await invokeApi('crm', { action: 'chat', question: q, history });
      setMessages((m) => [...m, { role: 'assistant', content: answer || '(no answer returned)' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center">
          <Sparkles className="h-4 w-4 mr-2 text-blue-600" />Ask your CRM
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="max-h-72 overflow-y-auto space-y-2 mb-3">
          {messages.length === 0 ? (
            <div className="text-sm text-gray-400">
              <p className="mb-2">Ask a question about the metrics on this page.</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setInput(s)} className="text-xs border rounded-full px-3 py-1 text-gray-600 hover:bg-gray-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                </span>
              </div>
            ))
          )}
          {loading && <div className="flex items-center text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin mr-2" />Thinking…</div>}
        </div>
        {error && <p className="text-xs text-amber-600 mb-2">{error}</p>}
        <form onSubmit={ask} className="flex gap-2">
          <Input value={input} onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)} placeholder="e.g. Which source has the best win rate?" />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
