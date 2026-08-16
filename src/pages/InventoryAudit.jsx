import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Part } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, TrendingDown, TrendingUp, RefreshCw, Package } from 'lucide-react';
import { format } from '@/lib/dateUtils';

const CHANGE_TYPE_CONFIG = {
  deduction:   { label: 'Deducted',   color: 'bg-red-100 text-red-800',    icon: TrendingDown },
  receipt:     { label: 'Received',   color: 'bg-green-100 text-green-800', icon: TrendingUp },
  adjustment:  { label: 'Adjusted',   color: 'bg-blue-100 text-blue-800',   icon: RefreshCw },
  return:      { label: 'Returned',   color: 'bg-purple-100 text-purple-800', icon: TrendingUp },
  initial:     { label: 'Initial',    color: 'bg-gray-100 text-gray-800',   icon: Package },
};

export default function InventoryAudit() {
  const [records, setRecords]     = useState([]);
  const [parts, setParts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPart, setFilterPart] = useState('all');
  const [page, setPage]           = useState(0);
  const [hasMore, setHasMore]     = useState(true);
  const PAGE_SIZE = 50;

  const loadRecords = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      let query = supabase
        .from('inventory_audit')
        .select('*')
        .order('created_date', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (filterPart !== 'all') query = query.eq('part_id', filterPart);
      if (filterType !== 'all') query = query.eq('change_type', filterType);

      const { data, error } = await query;
      if (error) throw error;

      if (reset) {
        setRecords(data || []);
        setPage(1);
      } else {
        setRecords(prev => [...prev, ...(data || [])]);
        setPage(p => p + 1);
      }
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load audit records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Part.list().then(setParts).catch(console.error);
  }, []);

  useEffect(() => {
    loadRecords(true);
  }, [filterType, filterPart]);

  const filtered = records.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.part_name || '').toLowerCase().includes(s) ||
           (r.part_number || '').toLowerCase().includes(s) ||
           (r.reference_number || '').toLowerCase().includes(s) ||
           (r.created_by_name || '').toLowerCase().includes(s);
  });

  const totalIn  = records.filter(r => r.quantity_change > 0).reduce((a, r) => a + r.quantity_change, 0);
  const totalOut = records.filter(r => r.quantity_change < 0).reduce((a, r) => a + Math.abs(r.quantity_change), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Package className="h-8 w-8" /> Inventory Audit Log
          </h1>
          <p className="text-gray-500 mt-1">Complete history of all stock movements.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total records</p>
          <p className="text-2xl font-medium">{records.length.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs text-red-500 mb-1">Total deducted</p>
          <p className="text-2xl font-medium text-red-700">{totalOut.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-xs text-green-500 mb-1">Total received</p>
          <p className="text-2xl font-medium text-green-700">{totalIn.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-blue-500 mb-1">Net change</p>
          <p className={`text-2xl font-medium ${totalIn - totalOut >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totalIn - totalOut >= 0 ? '+' : ''}{(totalIn - totalOut).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search part, reference, technician..." className="pl-9"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={v => { setFilterType(v); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="deduction">Deductions</SelectItem>
                <SelectItem value="receipt">Receipts</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPart} onValueChange={v => { setFilterPart(v); }}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All parts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parts</SelectItem>
                {parts.sort((a,b) => (a.part_name||'').localeCompare(b.part_name||'')).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.part_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && records.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No audit records found.</p>
              <p className="text-sm mt-1">Records will appear here as inventory changes are made.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Part</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Before</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Change</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">After</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((r, i) => {
                    const cfg = CHANGE_TYPE_CONFIG[r.change_type] || CHANGE_TYPE_CONFIG.adjustment;
                    const Icon = cfg.icon;
                    const isPositive = r.quantity_change > 0;
                    return (
                      <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {r.created_date ? format(r.created_date, 'MMM d, yyyy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{r.part_name || '—'}</p>
                          {r.part_number && <p className="text-xs text-gray-400">{r.part_number}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${cfg.color} text-xs gap-1`}>
                            <Icon className="h-3 w-3" /> {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{r.quantity_before}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                            {isPositive ? '+' : ''}{r.quantity_change}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{r.quantity_after}</td>
                        <td className="px-4 py-3">
                          {r.reference_number ? (
                            r.reference_type === 'purchase_order' ? (
                              <a href={`/purchaseorders?po_id=${r.reference_id}`} className="text-blue-600 text-xs font-mono hover:underline">{r.reference_number}</a>
                            ) : r.reference_type === 'parts_order' ? (
                              <a href={`/partsorder?tab=history&order_id=${r.reference_id}`} className="text-blue-600 text-xs font-mono hover:underline">{r.reference_number}</a>
                            ) : r.reference_type === 'service_order' ? (
                              <a href="/onsiteservice" className="text-blue-600 text-xs font-mono hover:underline">{r.reference_number}</a>
                            ) : r.reference_type === 'internal_movement' ? (
                              <a href="/internalpartmovements" className="text-blue-600 text-xs font-mono hover:underline">{r.reference_number}</a>
                            ) : (
                              <span className="text-gray-600 text-xs font-mono">{r.reference_number}</span>
                            )
                          ) : r.reference_type ? (
                            <span className="text-gray-400 text-xs">{r.reference_type.replace(/_/g,' ')}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.created_by_name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hasMore && (
                <div className="flex justify-center py-4 border-t">
                  <Button variant="outline" size="sm" onClick={() => loadRecords(false)} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
