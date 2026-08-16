import { useState, useEffect, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { CrmLead, CrmSource, CrmCampaign } from '@/api/entities';
import type { CrmLeadRow, CrmSourceRow, CrmCampaignRow } from '@/api/entities';
import LeadForm, { LEAD_STATUSES } from '@/components/crm/LeadForm';
import ConvertLeadDialog from '@/components/crm/ConvertLeadDialog';
import FilterSelect from '@/components/crm/FilterSelect';
import { distinctSorted } from '@/components/crm/crmUtils';
import { LEAD_COLUMNS } from '@/components/crm/exportColumns';
import { exportCsv, csvFilename } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Plus, UserPlus, Loader2, AlertTriangle, Pencil, ArrowRightCircle, CheckCircle, Download } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  working: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  qualified: 'bg-green-100 text-green-800 hover:bg-green-200',
  disqualified: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
};

// Filters live in the URL (via useUrlFilters) so they survive a detail-page round-trip
// and browser Back. status is clamped to the tab set; source is free-form. Module-level.
const FILTERS = {
  status: { default: 'all', allowed: ['all', ...LEAD_STATUSES] },
  source: { default: 'all' },
} as const;

export default function LeadsPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<CrmLeadRow[]>([]);
  const [sources, setSources] = useState<CrmSourceRow[]>([]);
  const [campaigns, setCampaigns] = useState<CrmCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { values, setFilter } = useUrlFilters(FILTERS);
  const statusFilter = values.status;
  const sourceFilter = values.source;
  const setStatusFilter = (v: string) => setFilter('status', v);
  const setSourceFilter = (v: string) => setFilter('source', v);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmLeadRow | null>(null);
  const [convertLead, setConvertLead] = useState<CrmLeadRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, src, camp] = await Promise.all([
        CrmLead.list('-created_date'),
        CrmSource.list('name'),
        CrmCampaign.list('name'),
      ]);
      setLeads(data || []);
      setSources(src || []);
      setCampaigns(camp || []);
    } catch {
      setError('Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const sourceOpts = distinctSorted(leads.map((l) => l.source)).map((v) => ({ value: v, label: v }));

  const filtered = leads.filter((l) =>
    (statusFilter === 'all' || l.status === statusFilter)
    && (sourceFilter === 'all' || l.source === sourceFilter)
  );

  const exportRows = () => exportCsv(csvFilename('crm-leads'), LEAD_COLUMNS, filtered);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: MouseEvent, l: CrmLeadRow) => { e.stopPropagation(); setEditing(l); setFormOpen(true); };
  const openConvert = (e: MouseEvent, l: CrmLeadRow) => { e.stopPropagation(); setConvertLead(l); };
  const openDetail = (l: CrmLeadRow) => navigate(createPageUrl('LeadDetail') + '?id=' + l.id);

  return (
    <TooltipProvider delayDuration={300}>
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center"><UserPlus className="mr-2" />Leads</CardTitle>
            <CardDescription>Unqualified prospects. Convert them into companies, contacts and deals.</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" className="hidden sm:inline-flex" onClick={exportRows} disabled={filtered.length === 0}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            <Button onClick={openNew} className="px-3 sm:px-4" aria-label="Add Lead" title="Add Lead"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Lead</span></Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {['all', ...LEAD_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s}
            </button>
          ))}
          {/* sm:ml-2 only - on a phone the pills wrap, and a left margin on the
              wrapped row just indents it oddly; the flex gap is enough. */}
          <div className="sm:ml-2">
            <FilterSelect label="Source" value={sourceFilter} options={sourceOpts} onChange={setSourceFilter} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : error && !formOpen && !convertLead ? (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {/* Company is folded under Name on mobile (see the cell below), so it
                    only earns its own column from `sm` up. */}
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Company</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Source</TableHead>
                <TableHead className="text-center hidden sm:table-cell">MQL</TableHead>
                <TableHead className="text-center hidden sm:table-cell">SQL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? filtered.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => openDetail(l)}>
                  <TableCell className="font-medium">
                    {/* Truncate rather than wrap, so a long lead or company name doesn't
                        turn one row into three lines on a phone. */}
                    <div className="truncate max-w-[11rem] sm:max-w-none">{l.name}</div>
                    {l.company_name && (
                      <div className="truncate max-w-[11rem] text-xs font-normal text-gray-500 sm:hidden">
                        {l.company_name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{l.company_name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{l.email}</TableCell>
                  <TableCell className="hidden sm:table-cell">{l.source}</TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {l.reached_mql
                      ? <span title={l.mql_date?.slice(0, 10) || 'Reached MQL'}><CheckCircle className="h-4 w-4 text-green-600 inline" /></span>
                      : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-center hidden sm:table-cell">
                    {l.reached_sql
                      ? <span title={l.sql_date?.slice(0, 10) || 'Reached SQL'}><CheckCircle className="h-4 w-4 text-green-600 inline" /></span>
                      : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell><Badge className={STATUS_COLOR[l.status ?? ''] || ''}>{l.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={(e: MouseEvent) => openEdit(e, l)}><Pencil className="h-4 w-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit lead</TooltipContent>
                      </Tooltip>
                      {l.converted_at ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* Match the convert Button's footprint (ghost/sm = h-8 px-3) so the
                                check lines up with the convert arrow across rows. */}
                            <span className="inline-flex items-center justify-center h-8 px-3 text-green-600"><CheckCircle className="h-4 w-4" /></span>
                          </TooltipTrigger>
                          <TooltipContent>Converted</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={(e: MouseEvent) => openConvert(e, l)}><ArrowRightCircle className="h-4 w-4 text-blue-600" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>Convert lead</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan="8" className="text-center text-gray-500">No leads found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <LeadForm
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editing}
        sources={sources}
        campaigns={campaigns}
        knownIndustries={leads.map((l) => l.industry)}
        onSaved={load}
      />
      <ConvertLeadDialog lead={convertLead} onClose={() => setConvertLead(null)} onConverted={load} />
    </Card>
    </TooltipProvider>
  );
}
