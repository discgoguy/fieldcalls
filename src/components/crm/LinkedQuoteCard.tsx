import { useState, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CrmDeal, Quote } from '@/api/entities';
import type { CrmDealRow, QuoteRow } from '@/api/entities';
import { formatMoney, SELECT_CLASS } from './crmUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, ExternalLink, Link2Off, Link2 } from 'lucide-react';


interface LinkedQuoteCardProps {
  /** The deal to show/attach a quote for. */
  deal: CrmDealRow;
  /** Called after the linked quote changes. */
  onChange?: () => void;
}

/**
 * Links a CRM deal to an existing quote (via crm_deals.quote_id) and shows its summary.
 * Quote creation stays in the existing Quotes flow; here you associate one and jump to it.
 */
export default function LinkedQuoteCard({ deal, onChange }: LinkedQuoteCardProps) {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const all = await Quote.list('-created_date');
        if (!active) return;
        setQuotes(all || []);
        if (deal.quote_id) {
          setQuote((all || []).find((q) => q.id === deal.quote_id) || await Quote.get(deal.quote_id).catch(() => null));
        } else {
          setQuote(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [deal.quote_id]);

  const link = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await CrmDeal.update(deal.id, { quote_id: selected });
      setSelected('');
      onChange?.();
    } finally {
      setSaving(false);
    }
  };

  const unlink = async () => {
    setSaving(true);
    try {
      await CrmDeal.update(deal.id, { quote_id: null });
      onChange?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center"><FileText className="h-4 w-4 mr-2" />Quote</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
        ) : quote ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{quote.quote_number}</div>
                <div className="text-xs text-gray-500">{formatMoney(quote.total_amount, quote.currency)}</div>
              </div>
              <Badge variant="secondary">{quote.status}</Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(createPageUrl('Quotes'))}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />View in Quotes
              </Button>
              <Button size="sm" variant="ghost" onClick={unlink} disabled={saving} title="Unlink quote">
                <Link2Off className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 italic">No quote linked.</p>
            <div className="flex gap-2">
              <select className={SELECT_CLASS} value={selected} onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelected(e.target.value)}>
                <option value="">Link an existing quote…</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>{q.quote_number} · {formatMoney(q.total_amount, q.currency)}</option>
                ))}
              </select>
              <Button size="sm" onClick={link} disabled={!selected || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
