
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { addDays, format } from 'date-fns';

export default function QuoteForm({ customers, parts, categories, onSubmit, initialQuote, initialItems }) {
    const [quote, setQuote] = useState(initialQuote || {
        customer_id: '',
        subject: '',
        valid_until: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        tax_rate: 0,
        notes: '',
        terms_and_conditions: 'Payment due upon receipt. All sales are final.'
    });
    const [items, setItems] = useState(initialItems || [{
        item_type: 'Part',
        part_id: '',
        category: 'all', // Add category to item state
        description: '',
        quantity: 1,
        unit_price: 0
    }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialQuote) {
            setQuote({
                id: initialQuote.id, // Make sure to include id for updates
                customer_id: initialQuote.customer_id || '',
                subject: initialQuote.subject || '',
                valid_until: initialQuote.valid_until ? format(new Date(initialQuote.valid_until), 'yyyy-MM-dd') : format(addDays(new Date(), 30), 'yyyy-MM-dd'),
                tax_rate: initialQuote.tax_rate || 0,
                notes: initialQuote.notes || '',
                terms_and_conditions: initialQuote.terms_and_conditions || 'Payment due upon receipt. All sales are final.',
                subtotal: initialQuote.subtotal,
                tax_amount: initialQuote.tax_amount,
                total_amount: initialQuote.total_amount,
            });
            // Ensure initialItems also have the category field if they don't, defaulting to 'all'
            setItems(initialItems ? initialItems.map(item => ({ ...item, category: item.category || 'all' })) : []);
        }
    }, [initialQuote, initialItems]);
    
    useEffect(() => {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const tax_amount = subtotal * (quote.tax_rate / 100);
        const total_amount = subtotal + tax_amount;
        setQuote(q => ({ ...q, subtotal, tax_amount, total_amount }));
    }, [items, quote.tax_rate]);

    const handleQuoteChange = (field, value) => {
        setQuote(q => ({ ...q, [field]: value }));
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;

        if (field === 'item_type') {
            newItems[index].part_id = '';
            newItems[index].description = '';
            newItems[index].unit_price = 0;
            newItems[index].category = 'all';
        }

        if (field === 'category') {
             newItems[index].part_id = '';
             newItems[index].description = '';
             newItems[index].unit_price = 0;
        }

        if (field === 'part_id') {
            const part = parts.find(p => p.id === value);
            if (part) {
                newItems[index].description = `${part.part_name} (${part.part_number})`;
                newItems[index].unit_price = part.sales_price || 0;
            }
        }
        
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { item_type: 'Part', part_id: '', category: 'all', description: '', quantity: 1, unit_price: 0 }]);
    };

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!quote.customer_id || !quote.subject) {
            setError('Customer and Subject are required.');
            return;
        }
        if (items.some(item => !item.description || item.quantity <= 0)) {
            setError('All line items must have a description and a quantity greater than zero.');
            return;
        }

        setIsSubmitting(true);
        const finalItems = items.map(item => ({...item, total_price: item.quantity * item.unit_price}));
        // Pass the full quote object, including ID if it exists
        const result = await onSubmit(quote, finalItems);
        setIsSubmitting(false);

        if (result !== true) {
            setError(result);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-4">
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                    <Label htmlFor="customer">Customer *</Label>
                    <Select value={quote.customer_id} onValueChange={(val) => handleQuoteChange('customer_id', val)} required>
                        <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                        <SelectContent>
                            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="md:col-span-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input id="subject" value={quote.subject} onChange={(e) => handleQuoteChange('subject', e.target.value)} required />
                </div>
            </div>

            <div className="space-y-3 p-3 border rounded-lg">
                <Label>Line Items</Label>
                {items.map((item, index) => {
                    const filteredParts = item.category === 'all'
                        ? parts 
                        : parts.filter(p => p.category === item.category);

                    return (
                        <div key={index} className="flex items-end gap-2 p-2 bg-slate-50 rounded">
                            <div className="w-1/6"><Label>Type</Label><Select value={item.item_type} onValueChange={(val) => handleItemChange(index, 'item_type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Part">Part</SelectItem><SelectItem value="Service">Service</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></div>
                            
                            {item.item_type === 'Part' ? (
                                <>
                                    <div className="w-1/4">
                                        <Label>Category</Label>
                                        <Select value={item.category} onValueChange={(val) => handleItemChange(index, 'category', val)}>
                                            <SelectTrigger><SelectValue placeholder="Filter by category"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Categories</SelectItem>
                                                {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex-1"><Label>Part</Label><Select value={item.part_id} onValueChange={(val) => handleItemChange(index, 'part_id', val)} disabled={filteredParts.length === 0}><SelectTrigger><SelectValue placeholder="Select a part"/></SelectTrigger><SelectContent>{filteredParts.map(p => <SelectItem key={p.id} value={p.id}>{`${p.part_name} (${p.part_number})`}</SelectItem>)}</SelectContent></Select></div>
                                </>
                            ) : (
                                <div className="flex-1"><Label>Description</Label><Input value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)}/></div>
                            )}

                            <div className="w-20"><Label>Qty</Label><Input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 1)} min="1"/></div>
                            <div className="w-28"><Label>Unit Price</Label><Input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)} disabled={item.item_type === 'Part'}/></div>
                            <div className="w-28"><Label>Total</Label><Input value={`$${(item.quantity * item.unit_price).toFixed(2)}`} disabled className="font-semibold"/></div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                        </div>
                    )
                })}
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-2"/>Add Item</Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <Label htmlFor="valid_until">Valid Until</Label>
                    <Input id="valid_until" type="date" value={quote.valid_until} onChange={(e) => handleQuoteChange('valid_until', e.target.value)} />
                </div>
                 <div>
                    <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                    <Input id="tax_rate" type="number" step="0.1" value={quote.tax_rate} onChange={(e) => handleQuoteChange('tax_rate', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="font-semibold text-lg">${(quote.subtotal || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total (incl. tax)</p>
                    <p className="font-bold text-xl">${(quote.total_amount || 0).toFixed(2)}</p>
                </div>
            </div>

             <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" placeholder="Notes for the customer..." value={quote.notes} onChange={e => handleQuoteChange('notes', e.target.value)} />
            </div>
             <div>
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea id="terms" placeholder="Terms and conditions..." value={quote.terms_and_conditions} onChange={e => handleQuoteChange('terms_and_conditions', e.target.value)} />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/> Saving...</> : (initialQuote ? 'Update Quote' : 'Save Quote')}
            </Button>
        </form>
    );
}
