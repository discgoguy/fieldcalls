import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { invokeApi } from '@/api/supabaseClient';
import { Part, Category } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, ClipboardCheck, MapPin, CheckCircle, X, Search, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from '@/lib/dateUtils';

export default function InventoryCount() {
  const [sessions, setSessions]         = useState([]);
  const [parts, setParts]               = useState([]);
  const [categories, setCategories]     = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [countItems, setCountItems]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [committing, setCommitting]     = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [search, setSearch]             = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showNewSession, setShowNewSession] = useState(false);
  const [showCommitConfirm, setShowCommitConfirm] = useState(false);
  const [newSession, setNewSession]     = useState({ name: '', category_filter: 'all', locations: ['Stockroom'], notes: '' });
  const [newLocation, setNewLocation]   = useState('');
  const [currentLocation, setCurrentLocation] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [partsData, catsData] = await Promise.all([Part.list(), Category.list()]);
      setParts(partsData || []);
      setCategories(catsData || []);
      const { data: sessionsData } = await supabase
        .from('inventory_counts').select('*').order('created_date', { ascending: false });
      setSessions(sessionsData || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadSessionItems = async (session) => {
    const { data } = await supabase.from('inventory_count_items')
      .select('*').eq('count_id', session.id).order('part_name');
    setCountItems(data || []);
    setCurrentLocation((session.locations || [])[0] || '');
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeSession) loadSessionItems(activeSession); }, [activeSession]);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const handleCreateSession = async () => {
    if (!newSession.name) return;
    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', authUser.id).maybeSingle();

      const locations = newSession.locations.filter(Boolean);
      const { data: session, error: sessionError } = await supabase.from('inventory_counts').insert([{
        name: newSession.name,
        locations,
        category_filter: newSession.category_filter === 'all' ? null : newSession.category_filter,
        notes: newSession.notes || null,
        created_by: authUser.id,
        created_by_name: profile?.full_name || authUser.email,
      }]).select().single();
      if (sessionError) throw sessionError;

      // Pre-populate items from parts
      const filteredParts = newSession.category_filter === 'all'
        ? parts
        : parts.filter(p => p.category === newSession.category_filter || p.category_id === newSession.category_filter);

      const items = filteredParts.map(p => ({
        count_id: session.id,
        part_id: p.id,
        part_name: p.part_name,
        part_number: p.part_number || null,
        category: p.category || null,
        system_quantity: p.quantity_in_inventory || 0,
        location_counts: {},
        total_counted: 0,
      }));

      if (items.length > 0) {
        // Insert in batches
        for (let i = 0; i < items.length; i += 100) {
          await supabase.from('inventory_count_items').insert(items.slice(i, i + 100));
        }
      }

      setShowNewSession(false);
      setNewSession({ name: '', category_filter: 'all', locations: ['Stockroom'], notes: '' });
      await loadData();
      const fullSession = { ...session, locations };
      setActiveSession(fullSession);
      showSuccess(`Session "${session.name}" created with ${items.length} parts.`);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleCountChange = async (itemId, location, value) => {
    const qty = value === '' ? null : Math.max(0, Number(value));
    setCountItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newLocationCounts = { ...item.location_counts };
      if (qty === null) delete newLocationCounts[location];
      else newLocationCounts[location] = qty;
      const total = Object.values(newLocationCounts).reduce((s, v) => s + (Number(v) || 0), 0);
      return { ...item, location_counts: newLocationCounts, total_counted: total };
    }));

    // Debounced save
    clearTimeout(window._countSaveTimer);
    window._countSaveTimer = setTimeout(async () => {
      const item = countItems.find(i => i.id === itemId);
      if (!item) return;
      const newLocationCounts = { ...item.location_counts };
      if (qty === null) delete newLocationCounts[location];
      else newLocationCounts[location] = qty;
      const total = Object.values(newLocationCounts).reduce((s, v) => s + (Number(v) || 0), 0);
      await supabase.from('inventory_count_items').update({
        location_counts: newLocationCounts,
        total_counted: total,
        updated_date: new Date().toISOString(),
      }).eq('id', itemId);
    }, 800);
  };

  const handleCommit = async () => {
    setCommitting(true);
    setError('');
    try {
      const result = await invokeApi('inventory', { action: 'commitCount', countId: activeSession.id });
      showSuccess(`Committed — ${result.partsUpdated} parts updated, ${result.auditRecords} adjustments logged.`);
      setShowCommitConfirm(false);
      setActiveSession(null);
      await loadData();
    } catch(e) { setError(e.message); }
    finally { setCommitting(false); }
  };

  // Filter items
  const filteredItems = countItems.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (search) {
      const s = search.toLowerCase();
      return (item.part_name || '').toLowerCase().includes(s) ||
             (item.part_number || '').toLowerCase().includes(s);
    }
    return true;
  });

  // Stats
  const counted   = countItems.filter(i => Object.keys(i.location_counts || {}).length > 0).length;
  const variances = countItems.filter(i => Object.keys(i.location_counts || {}).length > 0 && i.total_counted !== i.system_quantity);
  const overCount = variances.filter(i => i.total_counted > i.system_quantity).length;
  const underCount = variances.filter(i => i.total_counted < i.system_quantity).length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8" /> Inventory Count
          </h1>
          <p className="text-gray-500 mt-1">Count stock across multiple locations and commit adjustments in one step.</p>
        </div>
        {!activeSession && (
          <Button onClick={() => setShowNewSession(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Count Session
          </Button>
        )}
      </div>

      {success && <Alert className="bg-green-50 border-green-200"><CheckCircle className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-800">{success}</AlertDescription></Alert>}
      {error   && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      {/* Active session */}
      {activeSession ? (
        <div className="space-y-4">
          {/* Session header */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{activeSession.name}</CardTitle>
                  <CardDescription>
                    {counted} of {countItems.length} parts counted
                    {variances.length > 0 && ` · ${variances.length} variances`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveSession(null)}>
                    <X className="h-4 w-4 mr-1" /> Close
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setShowCommitConfirm(true)} disabled={counted === 0}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Commit Count
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-3 mt-3">
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-gray-500">Counted</p>
                  <p className="text-lg font-medium">{counted}/{countItems.length}</p>
                </div>
                <div className="bg-green-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-green-600">Over</p>
                  <p className="text-lg font-medium text-green-700">+{overCount}</p>
                </div>
                <div className="bg-red-50 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-red-600">Under</p>
                  <p className="text-lg font-medium text-red-700">-{underCount}</p>
                </div>
              </div>

              {/* Location tabs */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {(activeSession.locations || []).map(loc => (
                  <button key={loc}
                    onClick={() => setCurrentLocation(loc)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      currentLocation === loc
                        ? 'bg-slate-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    <MapPin className="h-3 w-3 inline mr-1" />{loc}
                  </button>
                ))}
                <div className="flex gap-1">
                  <Input placeholder="Add location..." value={newLocation}
                    onChange={e => setNewLocation(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newLocation.trim()) {
                        const updated = { ...activeSession, locations: [...(activeSession.locations || []), newLocation.trim()] };
                        supabase.from('inventory_counts').update({ locations: updated.locations }).eq('id', activeSession.id);
                        setActiveSession(updated);
                        setCurrentLocation(newLocation.trim());
                        setNewLocation('');
                      }
                    }}
                    className="h-8 w-36 text-sm" />
                  <Button size="sm" variant="outline" className="h-8 px-2"
                    onClick={() => {
                      if (!newLocation.trim()) return;
                      const updated = { ...activeSession, locations: [...(activeSession.locations || []), newLocation.trim()] };
                      supabase.from('inventory_counts').update({ locations: updated.locations }).eq('id', activeSession.id);
                      setActiveSession(updated);
                      setCurrentLocation(newLocation.trim());
                      setNewLocation('');
                    }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search parts..." className="pl-9 h-8 text-sm"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Part</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-24">System</th>
                    <th className="text-center px-4 py-2.5 font-medium text-gray-600 w-32">{currentLocation || 'Location'}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-24">Total</th>
                    <th className="text-right px-4 py-2.5 font-medium text-gray-600 w-24">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map((item, i) => {
                    const locQty = currentLocation ? (item.location_counts?.[currentLocation] ?? '') : '';
                    const hasCounts = Object.keys(item.location_counts || {}).length > 0;
                    const variance = hasCounts ? item.total_counted - item.system_quantity : null;
                    return (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-800">{item.part_name}</p>
                          {item.part_number && <p className="text-xs text-gray-400">{item.part_number}</p>}
                          {item.category && <p className="text-xs text-gray-400">{item.category}</p>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">{item.system_quantity}</td>
                        <td className="px-4 py-2 text-center">
                          {currentLocation ? (
                            <input
                              type="number"
                              min="0"
                              value={locQty}
                              onChange={e => handleCountChange(item.id, currentLocation, e.target.value)}
                              placeholder="—"
                              className="w-20 text-center border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                            />
                          ) : <span className="text-gray-400 text-xs">select location</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {hasCounts ? (
                            <span>
                              {item.total_counted}
                              {Object.keys(item.location_counts).length > 1 && (
                                <span className="text-xs text-gray-400 ml-1">
                                  ({Object.entries(item.location_counts).map(([l,q]) => `${l}:${q}`).join(', ')})
                                </span>
                              )}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {variance !== null ? (
                            <span className={`font-medium flex items-center justify-end gap-1 ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {variance > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : variance < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                              {variance > 0 ? '+' : ''}{variance}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Session list */
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">No count sessions yet</p>
                <p className="text-gray-400 text-sm mt-1">Create a session to start counting inventory across locations.</p>
                <Button className="mt-4" onClick={() => setShowNewSession(true)}>
                  <Plus className="h-4 w-4 mr-2" /> New Count Session
                </Button>
              </CardContent>
            </Card>
          ) : sessions.map(session => {
            const statusColor = session.status === 'committed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
            return (
              <Card key={session.id} className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => session.status !== 'committed' && setActiveSession(session)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{session.name}</p>
                      <Badge className={`text-xs ${statusColor}`}>{session.status === 'committed' ? 'Committed' : 'In Progress'}</Badge>
                      {session.category_filter && <Badge variant="outline" className="text-xs">{session.category_filter}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500">
                      {session.status === 'committed'
                        ? `Committed by ${session.committed_by_name} on ${format(session.committed_at, 'MMM d, yyyy')}`
                        : `Started ${format(session.created_date, 'MMM d, yyyy')} · Locations: ${(session.locations || []).join(', ')}`}
                    </p>
                  </div>
                  {session.status !== 'committed' && (
                    <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setActiveSession(session); }}>
                      Continue →
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New session dialog */}
      <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New count session</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Session name</Label>
              <Input placeholder="e.g. May 2026 Full Count" value={newSession.name}
                onChange={e => setNewSession(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Filter by category (optional)</Label>
              <Select value={newSession.category_filter} onValueChange={v => setNewSession(p => ({ ...p, category_filter: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parts ({parts.length})</SelectItem>
                  {categories.map(c => {
                    const count = parts.filter(p => p.category === c.name).length;
                    return <SelectItem key={c.id} value={c.name}>{c.name} ({count})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Locations</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newSession.locations.map((loc, i) => (
                  <div key={i} className="flex items-center gap-1 bg-gray-100 rounded-md px-2 py-1 text-sm">
                    {loc}
                    <button onClick={() => setNewSession(p => ({ ...p, locations: p.locations.filter((_, j) => j !== i) }))}>
                      <X className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add location..." value={newLocation} onChange={e => setNewLocation(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newLocation.trim()) {
                      setNewSession(p => ({ ...p, locations: [...p.locations, newLocation.trim()] }));
                      setNewLocation('');
                    }
                  }} />
                <Button variant="outline" onClick={() => {
                  if (!newLocation.trim()) return;
                  setNewSession(p => ({ ...p, locations: [...p.locations, newLocation.trim()] }));
                  setNewLocation('');
                }}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any notes about this count..." value={newSession.notes}
                onChange={e => setNewSession(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSession(false)}>Cancel</Button>
            <Button onClick={handleCreateSession} disabled={saving || !newSession.name || newSession.locations.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commit confirm dialog */}
      <Dialog open={showCommitConfirm} onOpenChange={setShowCommitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Commit inventory count?</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-gray-600">This will update inventory for all parts with variances and cannot be undone.</p>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-amber-800">Summary</p>
              <p className="text-amber-700">{counted} parts counted</p>
              <p className="text-amber-700">{variances.length} adjustments will be made</p>
              <p className="text-amber-700">{overCount} parts over · {underCount} parts under</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommitConfirm(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleCommit} disabled={committing}>
              {committing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Commit {variances.length} adjustments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
