
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Quote } from '@/entities/Quote';
import { QuoteItem } from '@/entities/QuoteItem';
import { Customer } from '@/entities/Customer';
import { Part } from '@/entities/Part';
import { Technician } from '@/entities/Technician';
import { Ticket } from '@/entities/Ticket';
import { Category } from '@/entities/Category';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, FileText, CheckCircle, AlertTriangle, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import DateRangePicker from '../components/reports/DateRangePicker';
import QuoteForm from '../components/quotes/QuoteForm';
import QuoteCard from '../components/quotes/QuoteCard';
import QuoteDetail from '../components/quotes/QuoteDetail';
import ConvertToTicketModal from '../components/quotes/ConvertToTicketModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addTenantId, withTenantFilter } from '@/components/utils/tenant'; // Added tenant utility imports

export default function QuotesPage() {
    const [quotes, setQuotes] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState(null);
    const [editingQuote, setEditingQuote] = useState(null);
    const [ticketCreationData, setTicketCreationData] = useState(null);
    const [quoteToDelete, setQuoteToDelete] = useState(null);

    const [filters, setFilters] = useState({
        customerId: 'all',
        dateRange: { from: null, to: null },
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filter = await withTenantFilter(); // Get the tenant filter
            const [quoteData, customerData, partData, technicianData, categoryData] = await Promise.all([
                Quote.filter(filter, '-created_date'), // Apply tenant filter
                Customer.filter(filter), // Apply tenant filter
                Part.filter(filter), // Apply tenant filter
                Technician.filter(filter), // Apply tenant filter
                Category.filter(filter), // Apply tenant filter
            ]);
            setQuotes(quoteData || []);
            setCustomers(customerData || []);
            setParts(partData || []);
            setTechnicians(technicianData || []);
            setCategories(categoryData || []);
        } catch (e) {
            setError('Failed to load data. Please refresh the page.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFormSubmit = async (quoteData, items) => {
        try {
            if (quoteData.id) {
                const { id, ...dataToUpdate } = quoteData;
                await Quote.update(id, dataToUpdate);
                const oldItems = await QuoteItem.filter({ quote_id: id });
                await Promise.all(oldItems.map(item => QuoteItem.delete(item.id)));
                const itemsWithTenant = await Promise.all(
                    items.map(async (item) => await addTenantId({ ...item, quote_id: id }))
                );
                await QuoteItem.bulkCreate(itemsWithTenant);
                setSuccess('Quote updated successfully!');
            } else {
                const lastQuote = await Quote.list('-created_date', 1);
                const lastNum = lastQuote.length > 0 ? parseInt(lastQuote[0].quote_number.split('-')[1]) : 0;
                const newQuoteNumber = `QUO-${(lastNum + 1).toString().padStart(5, '0')}`;
                
                // CRITICAL FIX: Add tenant_id to quote data
                const quoteWithTenant = await addTenantId({ ...quoteData, quote_number: newQuoteNumber });
                const newQuote = await Quote.create(quoteWithTenant);
                
                // CRITICAL FIX: Add tenant_id to quote items
                const itemsWithTenant = await Promise.all(
                    items.map(async (item) => await addTenantId({ ...item, quote_id: newQuote.id }))
                );
                await QuoteItem.bulkCreate(itemsWithTenant);
                setSuccess('Quote created successfully!');
            }
            setIsFormOpen(false);
            setEditingQuote(null);
            await loadData();
            setTimeout(() => setSuccess(''), 5000);
            return true;
        } catch (e) {
            console.error(e);
            return e.message || 'An unexpected error occurred.';
        }
    };
    
    const handleQuoteClick = async (quote) => {
        try {
            const items = await QuoteItem.filter({ quote_id: quote.id });
            setSelectedQuote({ ...quote, items });
        } catch (e) {
            setError('Failed to load quote details.');
        }
    };

    const handleStatusChange = async (quote, newStatus) => {
        if (newStatus === 'Accepted') {
            try {
                const items = await QuoteItem.filter({ quote_id: quote.id });
                setTicketCreationData({ ...quote, items });
                setSelectedQuote(null);
            } catch (e) {
                setError('Failed to load quote items.');
            }
            return;
        }
        
        try {
            await Quote.update(quote.id, { status: newStatus });
            setSuccess(`Quote status updated to ${newStatus}.`);
            await loadData();
            setSelectedQuote(null);
            setTimeout(() => setSuccess(''), 4000);
        } catch(e) {
            setError('Failed to update status.');
        }
    };
    
    const handleConvertToTicket = async (ticketDetails) => {
        try {
            const quote = ticketCreationData;
            
            const lastTicket = await Ticket.list("-created_date", 1);
            const lastTicketNum = lastTicket.length > 0 ? parseInt(lastTicket[0].ticket_number.split('-')[1]) : 0;
            const newTicketNumber = `TICKET-${(lastTicketNum + 1).toString().padStart(5, '0')}`;
            
            // CRITICAL FIX: Add tenant_id to ticket
            const ticketWithTenant = await addTenantId({
                ...ticketDetails,
                ticket_number: newTicketNumber,
                customer_id: quote.customer_id,
                quote_id: quote.id,
                status: 'Open',
                priority: 'Medium', // Kept 'priority' as per original code, outline had 'urgency'
                created_date: new Date().toISOString(),
            });
            
            await Ticket.create(ticketWithTenant);
            await Quote.update(quote.id, { status: 'Accepted' });
            
            setSuccess(`Quote converted to a new ticket (${newTicketNumber}) successfully!`);
            setTicketCreationData(null);
            await loadData();
            setTimeout(() => setSuccess(''), 5000);
            return true;
        } catch(e) {
            console.error(e);
            setError(e.message || "Failed to convert quote to ticket.");
            return e.message || "Failed to convert quote to ticket.";
        }
    };
    
    const handleEditQuote = (quote) => {
        setEditingQuote(quote);
        setSelectedQuote(null);
        setIsFormOpen(true);
    };

    const handleDeleteRequest = (quote) => {
        setQuoteToDelete(quote);
        setSelectedQuote(null);
    };

    const confirmDeleteQuote = async () => {
        if (!quoteToDelete) return;
        try {
            const items = await QuoteItem.filter({ quote_id: quoteToDelete.id });
            await Promise.all(items.map(item => QuoteItem.delete(item.id)));
            await Quote.delete(quoteToDelete.id);
            setSuccess('Quote deleted successfully.');
            setQuoteToDelete(null);
            await loadData();
            setTimeout(() => setSuccess(''), 4000);
        } catch(e) {
            setError('Failed to delete quote.');
            console.error(e);
        }
    };

    const handleUpdateFromDetail = (event) => {
        const { type, quoteId, newStatus, conversionType, ...rest } = event;
        const quote = quotes.find(q => q.id === quoteId);
        if (!quote) return;

        switch (type) {
            case 'statusChange':
                handleStatusChange(quote, newStatus);
                break;
            case 'edit':
                handleEditQuote(quote);
                break;
            case 'delete':
                handleDeleteRequest(quote);
                break;
            case 'convert':
                if (conversionType === 'service') {
                    window.location.href = createPageUrl(`OnSiteService?fromQuote=${quote.id}`);
                } else if (conversionType === 'order') {
                    window.location.href = createPageUrl(`PartsOrder?fromQuote=${quote.id}`);
                }
                break;
            default:
                break;
        }
    };

    const customerMap = useMemo(() => customers.reduce((acc, c) => ({ ...acc, [c.id]: c }), {}), [customers]);

    const filteredQuotes = useMemo(() => {
        return quotes.filter(quote => {
            const customerMatch = filters.customerId === 'all' || quote.customer_id === filters.customerId;
            
            const date = new Date(quote.created_date);
            const from = filters.dateRange.from;
            const to = filters.dateRange.to;
            
            let dateMatch = true;
            if (from && to) {
                 const toEndOfDay = new Date(to);
                toEndOfDay.setHours(23, 59, 59, 999);
                dateMatch = date >= from && date <= toEndOfDay;
            } else if (from) {
                const fromStartOfDay = new Date(from);
                fromStartOfDay.setHours(0, 0, 0, 0);
                dateMatch = date >= fromStartOfDay;
            } else if (to) {
                const toEndOfDay = new Date(to);
                toEndOfDay.setHours(23, 59, 59, 999);
                dateMatch = date <= toEndOfDay;
            }
            
            return customerMatch && dateMatch;
        });
    }, [quotes, filters]);

    const renderQuoteList = (statusList) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuotes.filter(q => statusList.includes(q.status)).map(quote => (
                <QuoteCard
                    key={quote.id}
                    quote={quote}
                    customerName={customerMap[quote.customer_id]?.company_name}
                    onClick={() => handleQuoteClick(quote)}
                />
            ))}
        </div>
    );

    const customerForSelectedQuote = selectedQuote ? customerMap[selectedQuote.customer_id] : null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <FileText className="mr-3 h-8 w-8" />
                    Quotations
                </h1>
                <Dialog open={isFormOpen} onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) setEditingQuote(null);
                }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" />New Quote</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create a New Quote'}</DialogTitle>
                        </DialogHeader>
                        <QuoteForm
                            customers={customers}
                            parts={parts}
                            categories={categories}
                            onSubmit={handleFormSubmit}
                            initialQuote={editingQuote}
                            initialItems={editingQuote?.items}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {success && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertTitle>Success</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="bg-gray-50 p-4 rounded-lg border flex flex-wrap items-end gap-4">
                 <div className="flex items-center gap-2">
                     <Filter className="h-5 w-5 text-gray-500" />
                     <h3 className="font-semibold text-gray-700">Filter Quotes</h3>
                 </div>
                 <div className="flex-grow min-w-[180px]">
                     <Label htmlFor="customer-filter">Customer</Label>
                     <Select value={filters.customerId} onValueChange={val => setFilters(f => ({...f, customerId: val}))}>
                         <SelectTrigger id="customer-filter"><SelectValue placeholder="All Customers" /></SelectTrigger>
                         <SelectContent>
                             <SelectItem value="all">All Customers</SelectItem>
                             {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                         </SelectContent>
                     </Select>
                 </div>
                 <div className="flex-grow min-w-[280px]">
                     <Label>Date Range</Label>
                     <DateRangePicker 
                        date={filters.dateRange} 
                        onDateChange={range => setFilters(f => ({...f, dateRange: range || { from: null, to: null }}))} 
                    />
                 </div>
                 <Button variant="ghost" onClick={() => setFilters({ customerId: 'all', dateRange: { from: null, to: null }})}>Clear Filters</Button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : (
                <Tabs defaultValue="drafts" className="mt-6">
                    <TabsList>
                        <TabsTrigger value="drafts">Drafts</TabsTrigger>
                        <TabsTrigger value="sent">Sent</TabsTrigger>
                        <TabsTrigger value="active">Accepted</TabsTrigger>
                        <TabsTrigger value="archived">Declined / Expired</TabsTrigger>
                    </TabsList>
                    <TabsContent value="drafts" className="pt-4">{renderQuoteList(['Draft'])}</TabsContent>
                    <TabsContent value="sent" className="pt-4">{renderQuoteList(['Sent'])}</TabsContent>
                    <TabsContent value="active" className="pt-4">{renderQuoteList(['Accepted'])}</TabsContent>
                    <TabsContent value="archived" className="pt-4">{renderQuoteList(['Declined', 'Expired'])}</TabsContent>
                </Tabs>
            )}

            {selectedQuote && customerForSelectedQuote && (
                <QuoteDetail
                    quote={selectedQuote}
                    customer={customerForSelectedQuote}
                    isOpen={!!selectedQuote}
                    onOpenChange={() => setSelectedQuote(null)}
                    onUpdate={handleUpdateFromDetail}
                />
            )}

            {ticketCreationData && (
                <ConvertToTicketModal
                    isOpen={!!ticketCreationData}
                    onOpenChange={() => setTicketCreationData(null)}
                    quote={ticketCreationData}
                    technicians={technicians}
                    onSubmit={handleConvertToTicket}
                />
            )}

            {quoteToDelete && (
                 <AlertDialog open={!!quoteToDelete} onOpenChange={() => setQuoteToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the quote
                                <span className="font-bold"> {quoteToDelete.quote_number}</span>.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteQuote} className="bg-red-600 hover:bg-red-700">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
}
