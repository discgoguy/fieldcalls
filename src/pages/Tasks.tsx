import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrlFilters } from '@/lib/useUrlFilters';
import type { FilterSpecs } from '@/lib/urlFilters.logic';
import { createPageUrl } from '@/utils';
import { CrmActivity, CrmCompany, CrmContact, CrmDeal } from '@/api/entities';
import type { CrmActivityRow } from '@/api/entities';
import { contactName } from '@/components/crm/crmUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isPast, isToday } from 'date-fns';
import { format } from '@/lib/dateUtils';
import { CheckSquare, Loader2, Circle, CheckCircle2, Building2, Contact as ContactIcon, TrendingUp, CalendarClock } from 'lucide-react';

function dueLabel(d: string | null | undefined): string | null {
  return d ? format(d, 'MMM d, h:mm a') : null;
}

const distinctIds = (vals: (string | null | undefined)[]): string[] => [...new Set(vals.filter((v): v is string => !!v))];

// "Show completed" toggle lives in the URL (via useUrlFilters) so it survives a
// detail-page round-trip and browser Back. Stored as done=1; hidden ('') is dropped.
const FILTER_SPEC = { done: { default: '' } } as const satisfies FilterSpecs;

export default function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CrmActivityRow[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [deals, setDeals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const { values, setFilter } = useUrlFilters(FILTER_SPEC);
  const showDone = values.done === '1';
  const setShowDone = (value: boolean) => setFilter('done', value ? '1' : '');

  const load = async () => {
    setLoading(true);
    try {
      const t = (await CrmActivity.filter({ type: 'task' }, 'due_date')) || [];
      setTasks(t);
      // Resolve only the entities these tasks reference, not the whole tables.
      const companyIds = distinctIds(t.map((x) => x.company_id));
      const contactIds = distinctIds(t.map((x) => x.contact_id));
      const dealIds = distinctIds(t.map((x) => x.deal_id));
      const [co, ct, d] = await Promise.all([
        companyIds.length ? CrmCompany.filter({ id: companyIds }) : Promise.resolve([]),
        contactIds.length ? CrmContact.filter({ id: contactIds }) : Promise.resolve([]),
        dealIds.length ? CrmDeal.filter({ id: dealIds }) : Promise.resolve([]),
      ]);
      setCompanies(Object.fromEntries(co.map((x) => [x.id, x.name] as const)));
      setContacts(Object.fromEntries(ct.map((x) => [x.id, contactName(x)] as const)));
      setDeals(Object.fromEntries(d.map((x) => [x.id, x.name] as const)));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (t: CrmActivityRow) => {
    const completed = !t.completed;
    // Patch the single row in place with what update() returns — a completed flag
    // can't change the company/contact/deal name maps, and the open/done/overdue
    // groupings are derived from `tasks` on render, so a full reload (4 queries + a
    // spinner flash) is unnecessary.
    const updated = await CrmActivity.update(t.id, { completed, completed_at: completed ? new Date().toISOString() : null });
    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
  };

  const related = (t: CrmActivityRow) => {
    if (t.deal_id && deals[t.deal_id]) return { icon: TrendingUp, label: deals[t.deal_id], to: createPageUrl('DealDetail') + '?id=' + t.deal_id };
    if (t.contact_id && contacts[t.contact_id]) return { icon: ContactIcon, label: contacts[t.contact_id], to: createPageUrl('ContactDetail') + '?id=' + t.contact_id };
    if (t.company_id && companies[t.company_id]) return { icon: Building2, label: companies[t.company_id], to: createPageUrl('CompanyDetail') + '?id=' + t.company_id };
    return null;
  };

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const overdue = open.filter((t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const dueToday = open.filter((t) => t.due_date && isToday(new Date(t.due_date)));
  const upcoming = open.filter((t) => !t.due_date || (!isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))));

  const Row = ({ t, tone }: { t: CrmActivityRow; tone: string }) => {
    const rel = related(t);
    const RelIcon = rel?.icon;
    return (
      <div className="flex items-start gap-3 p-3 border rounded-lg bg-white">
        <button onClick={() => toggle(t)} className="mt-0.5" title={t.completed ? 'Mark incomplete' : 'Mark complete'}>
          {t.completed ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-gray-300 hover:text-gray-500" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${t.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.subject || 'Task'}</div>
          {t.body && <div className="text-sm text-gray-500 truncate">{t.body}</div>}
          {rel && RelIcon && (
            <button className="text-xs text-blue-600 flex items-center gap-1 mt-1" onClick={() => navigate(rel.to)}>
              <RelIcon className="h-3 w-3" />{rel.label}
            </button>
          )}
        </div>
        {t.due_date && (
          <Badge variant="secondary" className={tone === 'overdue' ? 'bg-red-100 text-red-700 hover:bg-red-200' : tone === 'today' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : ''}>
            <CalendarClock className="h-3 w-3 mr-1" />{dueLabel(t.due_date)}
          </Badge>
        )}
      </div>
    );
  };

  const Section = ({ title, items, tone }: { title: string; items: CrmActivityRow[]; tone: string }) => items.length === 0 ? null : (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-600">{title} <span className="text-gray-400">({items.length})</span></h3>
      {items.map((t) => <Row key={t.id} t={t} tone={tone} />)}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center"><CheckSquare className="mr-2" />Tasks</CardTitle>
            <CardDescription>Open follow-ups across your CRM.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide completed' : `Show completed (${done.length})`}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : open.length === 0 && (!showDone || done.length === 0) ? (
          <p className="text-center text-gray-500 py-8">No tasks. Log a task from any contact, company or deal.</p>
        ) : (
          <div className="space-y-6">
            <Section title="Overdue" items={overdue} tone="overdue" />
            <Section title="Due today" items={dueToday} tone="today" />
            <Section title="Upcoming" items={upcoming} tone="upcoming" />
            {showDone && <Section title="Completed" items={done} tone="done" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
