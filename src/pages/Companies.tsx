import { useState, useEffect, type ChangeEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { CrmCompany } from '@/api/entities';
import type { CrmCompanyRow } from '@/api/entities';
import CompanyForm from '@/components/crm/CompanyForm';
import FilterSelect from '@/components/crm/FilterSelect';
import { distinctSorted } from '@/components/crm/crmUtils';
import { COMPANY_COLUMNS } from '@/components/crm/exportColumns';
import { exportCsv, csvFilename } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Building2, Loader2, AlertTriangle, Search, Pencil, Download } from 'lucide-react';

// Search + filters live in the URL (via useUrlFilters) so they survive a detail-page
// round-trip and browser Back. Module-level for stable identity.
const FILTER_SPEC = {
  q: { default: '' },
  industry: { default: 'all' },
  country: { default: 'all' },
} as const;

export default function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CrmCompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { values, setFilter } = useUrlFilters(FILTER_SPEC);
  const { q: search, industry, country } = values;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmCompanyRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await CrmCompany.list('name');
      setCompanies(data || []);
    } catch {
      setError('Failed to load companies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const industryOpts = distinctSorted(companies.map((c) => c.industry)).map((v) => ({ value: v, label: v }));
  const countryOpts = distinctSorted(companies.map((c) => c.country)).map((v) => ({ value: v, label: v }));

  const q = search.toLowerCase();
  const filtered = companies.filter((c) =>
    [c.name, c.industry, c.domain, c.phone].some((v) => v?.toLowerCase().includes(q))
    && (industry === 'all' || c.industry === industry)
    && (country === 'all' || c.country === country)
  );

  const exportRows = () => exportCsv(csvFilename('crm-companies'), COMPANY_COLUMNS, filtered);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: MouseEvent, c: CrmCompanyRow) => { e.stopPropagation(); setEditing(c); setFormOpen(true); };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center"><Building2 className="mr-2" />Companies</CardTitle>
            <CardDescription>Accounts in your CRM.</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" className="hidden sm:inline-flex" onClick={exportRows} disabled={filtered.length === 0}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            <Button onClick={openNew} className="px-3 sm:px-4" aria-label="Add Company" title="Add Company"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Company</span></Button>
          </div>
        </div>
        <div className="mt-4 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search companies..." className="pl-8" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setFilter('q', e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <FilterSelect label="Industry" value={industry} options={industryOpts} onChange={(v) => setFilter('industry', v)} />
          <FilterSelect label="Country" value={country} options={countryOpts} onChange={(v) => setFilter('country', v)} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : error ? (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Industry</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(createPageUrl('CompanyDetail') + '?id=' + c.id)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{c.industry}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e: MouseEvent) => openEdit(e, c)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan="4" className="text-center text-gray-500">No companies found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CompanyForm open={formOpen} onOpenChange={setFormOpen} company={editing} onSaved={load} knownIndustries={companies.map((c) => c.industry)} />
    </Card>
  );
}
