import { useState, useEffect, type ChangeEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUrlFilters } from '@/lib/useUrlFilters';
import { CrmContact, CrmCompany } from '@/api/entities';
import type { CrmContactRow } from '@/api/entities';
import { contactName } from '@/components/crm/crmUtils';
import ContactForm from '@/components/crm/ContactForm';
import FilterSelect from '@/components/crm/FilterSelect';
import { contactColumns } from '@/components/crm/exportColumns';
import { exportCsv, csvFilename } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Contact as ContactIcon, Loader2, AlertTriangle, Search, Pencil, Download } from 'lucide-react';

// Search (`q`) + company filter live in the URL (via useUrlFilters) so they survive a
// detail-page round-trip and browser Back.
const FILTERS = { q: { default: '' }, company: { default: 'all' } } as const;

export default function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<CrmContactRow[]>([]);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { values, setFilter } = useUrlFilters(FILTERS);
  const search = values.q;
  const companyFilter = values.company;
  const setSearch = (v: string) => setFilter('q', v);
  const setCompanyFilter = (v: string) => setFilter('company', v);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CrmContactRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ct, co] = await Promise.all([CrmContact.list('first_name'), CrmCompany.list('name')]);
      setContacts(ct || []);
      setCompanies(Object.fromEntries((co || []).map((c) => [c.id, c.name] as const)));
    } catch {
      setError('Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Only offer companies that actually have contacts, sorted by name.
  const companyOpts = Array.from(new Set(contacts.map((c) => c.company_id).filter((id): id is string => !!id)))
    .map((id) => ({ value: id, label: companies[id] || 'Unknown' }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const q = search.toLowerCase();
  const filtered = contacts.filter((c) =>
    [contactName(c), c.email, c.phone, c.title].some((v) => v?.toLowerCase().includes(q))
    && (companyFilter === 'all' || c.company_id === companyFilter)
  );

  const exportRows = () => exportCsv(csvFilename('crm-contacts'), contactColumns(companies), filtered);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: MouseEvent, c: CrmContactRow) => { e.stopPropagation(); setEditing(c); setFormOpen(true); };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center"><ContactIcon className="mr-2" />Contacts</CardTitle>
            <CardDescription>People in your CRM.</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" className="hidden sm:inline-flex" onClick={exportRows} disabled={filtered.length === 0}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            <Button onClick={openNew} className="px-3 sm:px-4" aria-label="Add Contact" title="Add Contact"><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Add Contact</span></Button>
          </div>
        </div>
        <div className="mt-4 relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." className="pl-8" value={search} onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <FilterSelect label="Company" value={companyFilter} options={companyOpts} onChange={setCompanyFilter} />
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
                <TableHead className="hidden sm:table-cell">Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(createPageUrl('ContactDetail') + '?id=' + c.id)}>
                  <TableCell className="font-medium">{contactName(c)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{c.title}</TableCell>
                  <TableCell>{c.company_id ? companies[c.company_id] || '' : ''}</TableCell>
                  <TableCell className="hidden sm:table-cell">{c.email}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e: MouseEvent) => openEdit(e, c)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan="6" className="text-center text-gray-500">No contacts found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <ContactForm open={formOpen} onOpenChange={setFormOpen} contact={editing} onSaved={load} />
    </Card>
  );
}
