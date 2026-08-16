import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Technician } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle, Trash2, Phone, CalendarDays } from 'lucide-react';

const EVENT_TYPES = ['Vacation','Time Off','Out of Office','Sick','Appointment','On Call','Maintenance'];

const EVENT_COLORS = {
  'Vacation':      { bg: 'bg-blue-500',   light: 'bg-blue-100 text-blue-800',   border: 'border-blue-400' },
  'Time Off':      { bg: 'bg-purple-500', light: 'bg-purple-100 text-purple-800', border: 'border-purple-400' },
  'Out of Office': { bg: 'bg-orange-500', light: 'bg-orange-100 text-orange-800', border: 'border-orange-400' },
  'Sick':          { bg: 'bg-red-500',    light: 'bg-red-100 text-red-800',     border: 'border-red-400' },
  'Appointment':   { bg: 'bg-yellow-500', light: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-400' },
  'On Call':       { bg: 'bg-green-500',  light: 'bg-green-100 text-green-800', border: 'border-green-400' },
  'Maintenance':   { bg: 'bg-slate-500',  light: 'bg-slate-100 text-slate-800', border: 'border-slate-400' },
};

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Calendar() {
  const [events, setEvents]           = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [today]                       = useState(new Date());
  const [current, setCurrent]         = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [loading, setLoading]         = useState(true);
  const [isAddOpen, setIsAddOpen]     = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [success, setSuccess]         = useState('');
  const [filterTech, setFilterTech]   = useState('all');
  const [filterType, setFilterType]   = useState('all');

  const [form, setForm] = useState({
    title: '', event_type: 'Vacation', start_date: '', end_date: '',
    all_day: true, notes: '', assigned_technician_ids: [], assigned_technician_names: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: eventsData }, techData] = await Promise.all([
        supabase.from('calendar_events').select('*').order('start_date'),
        Technician.list(),
      ]);
      setEvents(eventsData || []);
      setTechnicians(techData?.filter(t => t.active !== false) || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleSave = async () => {
    if (!form.event_type || !form.start_date) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      const payload = {
        title: form.title || form.event_type,
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: form.end_date || form.start_date,
        all_day: form.all_day,
        notes: form.notes || '',
        user_id: user.id,
        user_name: profile?.full_name || user.email,
        is_admin_managed: true,
        assigned_technician_ids: form.assigned_technician_ids,
        assigned_technician_names: form.assigned_technician_names,
        assigned_customer_ids: [],
        assigned_customer_names: [],
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      };
      const { error } = await supabase.from('calendar_events').insert([payload]);
      if (error) throw error;
      setIsAddOpen(false);
      setForm({ title:'', event_type:'Vacation', start_date:'', end_date:'', all_day:true, notes:'', assigned_technician_ids:[], assigned_technician_names:[] });
      showSuccess('Event added.');
      await loadData();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (eventId) => {
    await supabase.from('calendar_events').delete().eq('id', eventId);
    setSelectedEvent(null);
    showSuccess('Event deleted.');
    await loadData();
  };

  const toggleTechnician = (tech) => {
    const ids = form.assigned_technician_ids;
    const names = form.assigned_technician_names;
    if (ids.includes(tech.id)) {
      setForm(p => ({ ...p, assigned_technician_ids: ids.filter(i => i !== tech.id), assigned_technician_names: names.filter(n => n !== tech.full_name) }));
    } else {
      setForm(p => ({ ...p, assigned_technician_ids: [...ids, tech.id], assigned_technician_names: [...names, tech.full_name] }));
    }
  };

  // Build calendar grid
  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  const getEventsForDay = (day) => {
    if (!day) return [];
    const date = new Date(current.year, current.month, day);
    return events.filter(e => {
      if (filterTech !== 'all' && !(e.assigned_technician_ids || []).includes(filterTech)) return false;
      if (filterType !== 'all' && e.event_type !== filterType) return false;
      const start = new Date(e.start_date.slice(0,10) + 'T12:00:00');
      const end = new Date((e.end_date || e.start_date).slice(0,10) + 'T12:00:00');
      start.setHours(0,0,0,0); end.setHours(23,59,59,999);
      return date >= start && date <= end;
    });
  };

  const prevMonth = () => setCurrent(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCurrent(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  const isToday = (day) => day && today.getFullYear() === current.year && today.getMonth() === current.month && today.getDate() === day;

  // On Call this week
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const onCallThisWeek = events.filter(e => {
    if (e.event_type !== 'On Call') return false;
    const d = new Date(e.start_date.slice(0,10) + 'T12:00:00');
    return d >= weekStart && d <= weekEnd;
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <CalendarDays className="h-8 w-8" /> Team Calendar
          </h1>
          <p className="text-gray-500 mt-1">Schedule and track technician availability.</p>
        </div>
        <Button onClick={() => { setSelectedDay(null); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Event
        </Button>
      </div>

      {success && <Alert className="bg-green-50 border-green-200"><CheckCircle className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}

      {/* On Call this week */}
      {onCallThisWeek.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-sm">
          <Phone className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-green-800 font-medium">On call this week:</span>
          <span className="text-green-700">{onCallThisWeek.map(e => (e.assigned_technician_names || []).join(', ')).join(' · ')}</span>
        </div>
      )}

      {/* Filters + nav */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold w-44 text-center">{MONTHS[current.month]} {current.year}</h2>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrent({ year: today.getFullYear(), month: today.getMonth() })}>Today</Button>
        </div>
        <div className="flex gap-2">
          <Select value={filterTech} onValueChange={setFilterTech}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All technicians" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All technicians</SelectItem>
              {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentDay = isToday(day);
                return (
                  <div key={i}
                    className={`min-h-24 p-1.5 border-r border-b last:border-r-0 ${!day ? 'bg-gray-50/50' : 'cursor-pointer hover:bg-gray-50/70'} ${isCurrentDay ? 'bg-blue-50/40' : ''}`}
                    onClick={() => { if (day) { setSelectedDay(new Date(current.year, current.month, day)); setIsAddOpen(true); setForm(p => ({ ...p, start_date: `${current.year}-${String(current.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` })); } }}>
                    {day && (
                      <>
                        <div className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isCurrentDay ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map(event => {
                            const color = EVENT_COLORS[event.event_type] || EVENT_COLORS['Appointment'];
                            const names = (event.assigned_technician_names || []).join(', ');
                            return (
                              <div key={event.id}
                                onClick={e => { e.stopPropagation(); setSelectedEvent(event); }}
                                className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${color.light} border-l-2 ${color.border}`}>
                                {names || event.title || event.event_type}
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-gray-400 pl-1">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map(type => {
          const color = EVENT_COLORS[type];
          return <span key={type} className={`text-xs px-2 py-1 rounded-full ${color.light}`}>{type}</span>;
        })}
      </div>

      {/* Add event dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.event_type} onValueChange={v => setForm(p => ({ ...p, event_type: v, title: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Title (optional)</Label>
                <Input placeholder={form.event_type} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value, end_date: p.end_date || e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign Technicians</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {technicians.map(t => (
                  <button key={t.id} onClick={() => toggleTechnician(t)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      form.assigned_technician_ids.includes(t.id)
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}>
                    {t.full_name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.start_date}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-sm">
          {selectedEvent && (() => {
            const color = EVENT_COLORS[selectedEvent.event_type] || EVENT_COLORS['Appointment'];
            const names = (selectedEvent.assigned_technician_names || []).join(', ');
            const start = new Date(selectedEvent.start_date.slice(0,10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
            const end = new Date((selectedEvent.end_date || selectedEvent.start_date).slice(0,10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <Badge className={color.light}>{selectedEvent.event_type}</Badge>
                    <DialogTitle className="text-base">{selectedEvent.title || selectedEvent.event_type}</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="space-y-2 text-sm py-2">
                  <p className="text-gray-600">{start === end ? start : `${start} → ${end}`}</p>
                  {names && <p><span className="font-medium">Technician:</span> {names}</p>}
                  {selectedEvent.notes && <p className="text-gray-600 bg-gray-50 rounded p-2">{selectedEvent.notes}</p>}
                  <p className="text-xs text-gray-400">Created by {selectedEvent.user_name}</p>
                </div>
                <DialogFooter>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(selectedEvent.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedEvent(null)}>Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
