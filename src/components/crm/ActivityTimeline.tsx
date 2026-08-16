import { useState, useEffect, useCallback } from 'react';
import { CrmActivity } from '@/api/entities';
import type { CrmActivityRow, Filters } from '@/api/entities';
import ActivityComposer from './ActivityComposer';
import type { ActivityLinks } from './ActivityComposer';
import { Button } from '@/components/ui/button';
import { format } from '@/lib/dateUtils';
import { StickyNote, Phone, Users, CheckSquare, Mail, Loader2, Circle, CheckCircle2, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = { note: StickyNote, call: Phone, meeting: Users, task: CheckSquare, email: Mail };

function fmt(d: string | null | undefined): string {
  return d ? format(d, 'MMM d, yyyy • h:mm a') : '';
}

interface ActivityTimelineProps {
  /** The record whose activities to show, as a relating id, e.g. { contact_id: id }. */
  links?: ActivityLinks;
  /** Prefill the compose-email "To" field (passed through to the composer). */
  defaultEmail?: string | null;
}

/**
 * Activity timeline for a CRM record. `links` is the relating id, e.g. { contact_id: id }.
 * The first key of `links` is used to filter the timeline.
 */
export default function ActivityTimeline({ links = {}, defaultEmail }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<CrmActivityRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const filterKey = Object.keys(links)[0] as keyof ActivityLinks;
  const filterVal = links[filterKey];

  const load = useCallback(async () => {
    if (!filterVal) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await CrmActivity.filter({ [filterKey]: filterVal } as Filters<'crm_activities'>, '-created_date');
      setActivities(data || []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [filterKey, filterVal]);

  useEffect(() => { load(); }, [load]);

  const toggleComplete = async (a: CrmActivityRow) => {
    const completed = !a.completed;
    await CrmActivity.update(a.id, { completed, completed_at: completed ? new Date().toISOString() : null });
    load();
  };

  const remove = async (a: CrmActivityRow) => {
    await CrmActivity.delete(a.id);
    load();
  };

  return (
    <div className="space-y-4">
      <ActivityComposer links={links} defaultEmail={defaultEmail} onLogged={load} />

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-6">No activity yet.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const Icon = ICONS[a.type as string] || StickyNote;
            return (
              <div key={a.id} className="flex gap-3 group">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-gray-500" />
                  </div>
                </div>
                <div className="flex-1 border rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {a.type === 'task' && (
                        <button onClick={() => toggleComplete(a)} title={a.completed ? 'Mark incomplete' : 'Mark complete'}>
                          {a.completed ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-gray-400" />}
                        </button>
                      )}
                      <span className={`font-medium text-sm ${a.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {a.subject || a.type}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-gray-400">{a.type}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => remove(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                  </div>
                  {a.body && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>}
                  <div className="text-xs text-gray-400 mt-1">
                    {fmt(a.created_date)}
                    {a.type === 'email' && a.email_to && <> • {a.direction === 'inbound' ? 'From' : 'To'} {a.email_to}</>}
                    {a.type === 'task' && a.due_date && <> • Due {fmt(a.due_date)}</>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
