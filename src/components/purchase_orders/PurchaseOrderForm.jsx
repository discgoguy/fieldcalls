import React, { useState, useEffect } from 'react';
import { Setting } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, X, Loader2, Building } from 'lucide-react';

const SHIP_TO_ADDRESS = {
    name: "FieldCalls Inc.",
    address: "163 Zack Road",
    cityStateZip: "Lutes Mountain, NB E1G 2V1",
    country: "Canada"
};

export default function PurchaseOrderForm({ initialData, suppliers, parts, categories, onSubmit, exchangeRate }) {
    const [poData, setPoData] = useState({
        supplier_id: '',
        order_date: new Date().toISOString().split('T')[0],
        payment_type: 'Net 30',
        shipping_method: 'Ground',
        approved_by_user_name: '',
        tax_rate: 0,
        shipping_expense: '',
        notes: ''
    });
    // Added unit_cost: 0 to initial item state
    const [items, setItems] = useState([{ part_id: '', category: 'all', quantity_ordered: 1, unit_cost: 0 }]);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [availableCategories, setAvailableCategories] = useState([]); // State for filtered categories
    const [subtotal, setSubtotal] = useState(0);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentTypes, setPaymentTypes] = useState(["Credit Card", "Account", "COD", "Net 30", "Online"]);
    const [shippingMethods, setShippingMethods] = useState(["Express", "Air", "Ground", "Sea"]);

    // New useEffect for handling initialData (edit mode or cart pre-fill)
    useEffect(() => {
        if (initialData && parts.length > 0 && suppliers.length > 0) {
            const supplier = suppliers.find(s => s.id === initialData.supplier_id);
            
            // Set supplier and form data
            setSelectedSupplier(supplier || null);
            setPoData({
                supplier_id: initialData.supplier_id || '',
                order_date: initialData.order_date ? initialData.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
                payment_type: initialData.payment_type || 'Net 30',
                shipping_method: initialData.shipping_method || 'Ground',
                approved_by_user_name: initialData.approved_by_user_name || '',
                tax_rate: initialData.tax_rate || 0,
                shipping_expense: initialData.shipping_expense || '',
                notes: initialData.notes || ''
            });
        }
    }, [initialData, suppliers, parts]);

    // Separate useEffect to set items AFTER supplier is set
    useEffect(() => {
        if (initialData && initialData.items && initialData.items.length > 0 && selectedSupplier) {
            const mappedItems = (initialData.items || []).map(item => ({
                part_id: item.part_id,
                category: item.category || 'all',
                quantity_ordered: item.quantity_ordered || 1,
                unit_cost: item.unit_cost !== undefined ? item.unit_cost : 0
            }));
            setItems(mappedItems);
        }
    }, [selectedSupplier, initialData]);

    // Existing useEffect for subtotal calculation, adjusted for item.unit_cost
    useEffect(() => {
        const isUsd = selectedSupplier?.is_usd;
        const newSubtotal = items.reduce((acc, item) => {
            const partDetails = parts.find(p => p.id === item.part_id);
            // Prioritize item.unit_cost if it exists (from initialData or explicitly set)
            // Fallback to partDetails cost for new items or if item.unit_cost is not defined
            const itemCost = item.unit_cost !== undefined && item.unit_cost !== null
                ? item.unit_cost
                : (isUsd ? (partDetails?.cost_usd || 0) : (partDetails?.cost || 0));
            return acc + (itemCost * (item.quantity_ordered || 0));
        }, 0);
        setSubtotal(newSubtotal);
    }, [items, parts, selectedSupplier]);

    // Existing useEffect for availableCategories
    useEffect(() => {
        if (selectedSupplier) {
            // Get all parts from the selected supplier
            const supplierParts = parts.filter(p => p.supplier === selectedSupplier.name);
            // Get a unique list of category names from those parts
            const categoryNames = [...new Set(supplierParts.map(p => p.category).filter(Boolean))];
            // Filter the main categories list to only include the ones found
            const filteredCategories = categories.filter(c => categoryNames.includes(c.name));
            setAvailableCategories(filteredCategories);
        } else {
            // If no supplier is selected, clear the available categories
            setAvailableCategories([]);
        }
    }, [selectedSupplier, parts, categories]);

    // Load dropdown options from settings
    useEffect(() => {
        const loadDropdownOptions = async () => {
            try {
                const [paymentSetting, shippingSetting] = await Promise.all([
                    Setting.filter({ key: 'payment_types' }),
                    Setting.filter({ key: 'shipping_methods' })
                ]);
                
                if (paymentSetting && paymentSetting.length > 0) {
                    setPaymentTypes(JSON.parse(paymentSetting[0].value));
                }
                
                if (shippingSetting && shippingSetting.length > 0) {
                    setShippingMethods(JSON.parse(shippingSetting[0].value));
                }
            } catch (e) {
                console.error('Failed to load dropdown options', e);
            }
        };
        loadDropdownOptions();
    }, []);


    const handleSupplierChange = (supplierId) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        setSelectedSupplier(supplier);
        setPoData(prev => ({ ...prev, supplier_id: supplierId }));
        // Reset items when supplier changes to ensure parts are from the correct supplier
        // Ensure unit_cost is reset along with other item properties
        setItems([{ part_id: '', category: 'all', quantity_ordered: 1, unit_cost: 0 }]);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        if (field === 'category') {
            newItems[index].part_id = ''; // Reset part selection when category changes
            newItems[index].unit_cost = 0; // Reset unit cost too
        } else if (field === 'part_id') {
            // When part_id changes, update the unit_cost in the item state
            const selectedPart = parts.find(p => p.id === value);
            const isUsd = selectedSupplier?.is_usd;
            // For pack parts, the PO unit cost is the cost per pack (what you pay per order unit)
            if (selectedPart?.is_pack && selectedPart?.cost_per_pack) {
                newItems[index].unit_cost = selectedPart.cost_per_pack;
            } else {
                newItems[index].unit_cost = selectedPart ? (isUsd ? (selectedPart.cost_usd || 0) : (selectedPart.cost || 0)) : 0;
            }
        }
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { part_id: '', category: 'all', quantity_ordered: 1, unit_cost: 0 }]); // Ensure new item has unit_cost
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!poData.supplier_id || items.some(item => !item.part_id || !item.quantity_ordered)) {
            setError('Please select a supplier and ensure all item fields are complete.');
            return;
        }

        setIsSubmitting(true);
        const isUsd = selectedSupplier?.is_usd;
        const finalItems = items.map(item => {
            const partDetails = parts.find(p => p.id === item.part_id);
            // Use existing unit_cost if available on item (from initialData or explicitly set by user interaction)
            // Fallback to partDetails cost if item.unit_cost is not defined or is 0 and not from initialData
            const unitCost = (item.unit_cost !== undefined && item.unit_cost !== null)
                ? item.unit_cost
                : (isUsd ? (partDetails?.cost_usd || 0) : (partDetails?.cost || 0));

            return {
                part_id: item.part_id,
                description: partDetails ? `${partDetails.part_name} (${partDetails.part_number})` : item.description || 'Unknown Part', // Use existing description if available, otherwise derive
                quantity_ordered: Number(item.quantity_ordered),
                unit_cost: unitCost,
                total_cost: unitCost * Number(item.quantity_ordered)
            };
        });

        const taxAmount = subtotal * (poData.tax_rate / 100);
        const shippingExpense = parseFloat(poData.shipping_expense) || 0;
        const totalAmount = subtotal + taxAmount + shippingExpense;
        const finalPoData = { ...poData, subtotal, tax_amount: taxAmount, shipping_expense: shippingExpense, total_amount: totalAmount };
        
        // Pass initialData.id if it exists to indicate an update operation
        const result = await onSubmit(finalPoData, finalItems, initialData?.id);
        if (result !== true) {
            setError(result);
        }
        setIsSubmitting(false);
    };
    
    const getFilteredParts = (categoryFilter) => {
        // If no supplier is selected for the PO, show no parts.
        if (!selectedSupplier) {
            return [];
        }

        // Start with parts from the selected supplier
        let filtered = parts.filter(part => part.supplier === selectedSupplier.name);

        // Then, filter by category if a category is selected on the line item
        if (categoryFilter && categoryFilter !== 'all') {
            filtered = filtered.filter(part => part.category === categoryFilter);
        }

        return filtered;
    };

    const isUsdSupplier = selectedSupplier?.is_usd;
    const currencySymbol = isUsdSupplier ? '$' : '$'; // Both are $, but could be 'C$' vs '$'
    const currencyCode = isUsdSupplier ? 'USD' : 'CAD';

    return (
        <form onSubmit={handleSubmit} className="space-y-6 p-1 max-h-[80vh] overflow-y-auto">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Select onValueChange={handleSupplierChange} value={poData.supplier_id} required>
                        <SelectTrigger><SelectValue placeholder="Select a supplier" /></SelectTrigger>
                        <SelectContent>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="date">Order Date *</Label>
                    <Input id="date" type="date" value={poData.order_date} onChange={e => setPoData(prev => ({ ...prev, order_date: e.target.value }))} required/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="border p-4 rounded-lg space-y-2">
                    <h3 className="font-semibold flex items-center text-gray-700"><Building className="mr-2 h-4 w-4"/>Supplier Info</h3>
                    {selectedSupplier ? (
                        <div className="text-sm">
                            <p className="font-bold">{selectedSupplier.name}</p>
                            <p className="whitespace-pre-wrap">{selectedSupplier.address}</p>
                            <p>{selectedSupplier.phone}</p>
                            <p>Attn: {selectedSupplier.sales_person}</p>
                        </div>
                    ) : <p className="text-sm text-gray-500">Select a supplier to see details.</p>}
                </div>
                <div className="border p-4 rounded-lg space-y-2">
                    <h3 className="font-semibold text-gray-700">Ship To</h3>
                     <div className="text-sm">
                        <p className="font-bold">{SHIP_TO_ADDRESS.name}</p>
                        <p>{SHIP_TO_ADDRESS.address}</p>
                        <p>{SHIP_TO_ADDRESS.cityStateZip}</p>
                        <p>{SHIP_TO_ADDRESS.country}</p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-2">Items</h3>
                <div className="space-y-4">
                    {items.map((item, index) => {
                        const partDetails = parts.find(p => p.id === item.part_id);
                        // Display item.unit_cost if available, otherwise derive from partDetails
                        const unitCost = item.unit_cost !== undefined && item.unit_cost !== null
                            ? item.unit_cost
                            : (isUsdSupplier ? (partDetails?.cost_usd || 0) : (partDetails?.cost || 0));
                        return (
                            <div key={index}>
                                {/* Desktop Layout */}
                                <div className="hidden md:block p-3 border rounded-lg bg-gray-50/50 space-y-2">
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-3">
                                            <Label>Category</Label>
                                            <Select
                                                value={item.category}
                                                onValueChange={val => handleItemChange(index, 'category', val)}
                                                disabled={!selectedSupplier}
                                            >
                                                <SelectTrigger><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Categories</SelectItem>
                                                    {availableCategories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-5">
                                            <Label>Part *</Label>
                                            <Select value={item.part_id} onValueChange={val => handleItemChange(index, 'part_id', val)} required>
                                                <SelectTrigger><SelectValue placeholder="Select part"/></SelectTrigger>
                                                <SelectContent>
                                                    {getFilteredParts(item.category).map(p =>
                                                        <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number}){(p.pack_size || 1) > 1 ? ` — pack of ${p.pack_size}` : ''}</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-1">
                                            <Label>Cost/Pack</Label>
                                            <Input value={`${currencySymbol}${unitCost.toFixed(2)}`} readOnly className="bg-gray-100"/>
                                        </div>
                                        <div className="col-span-1">
                                            <Label>Packs *</Label>
                                            <Input type="number" value={item.quantity_ordered} onChange={e => handleItemChange(index, 'quantity_ordered', e.target.value)} min="1" required/>
                                        </div>
                                        <div className="col-span-1">
                                            <Label>Total</Label>
                                            <Input value={`${currencySymbol}${((unitCost) * (item.quantity_ordered || 0)).toFixed(2)}`} readOnly className="bg-gray-100"/>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-end">
                                            {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(index)}><X className="h-4 w-4 text-red-500"/></Button>}
                                        </div>
                                    </div>
                                    {partDetails && (partDetails.pack_size || 1) > 1 && (
                                        <p className="text-xs text-blue-600 font-medium">
                                            Pack of {partDetails.pack_size} — {item.quantity_ordered || 0} pack{(item.quantity_ordered || 0) !== 1 ? 's' : ''} = <strong>{(item.quantity_ordered || 0) * partDetails.pack_size} individual units</strong> added to inventory on receipt
                                        </p>
                                    )}
                                </div>

                                {/* Mobile Layout */}
                                <div className="md:hidden p-3 border rounded-lg bg-gray-50/50 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium text-sm">Item #{index + 1}</span>
                                        {items.length > 1 && (
                                            <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                                                <X className="h-4 w-4 text-red-500"/>
                                            </Button>
                                        )}
                                    </div>

                                    <div>
                                        <Label>Category</Label>
                                        <Select
                                            value={item.category}
                                            onValueChange={val => handleItemChange(index, 'category', val)}
                                            disabled={!selectedSupplier}
                                        >
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Categories</SelectItem>
                                                {availableCategories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Part *</Label>
                                        <Select value={item.part_id} onValueChange={val => handleItemChange(index, 'part_id', val)} required>
                                            <SelectTrigger><SelectValue placeholder="Select part"/></SelectTrigger>
                                            <SelectContent>
                                                {getFilteredParts(item.category).map(p =>
                                                    <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number}){(p.pack_size || 1) > 1 ? ` — pack of ${p.pack_size}` : ''}</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Label className="text-xs">Cost/Pack</Label>
                                            <Input value={`${currencySymbol}${unitCost.toFixed(2)}`} readOnly className="bg-gray-100 text-sm"/>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Packs *</Label>
                                            <Input type="number" value={item.quantity_ordered} onChange={e => handleItemChange(index, 'quantity_ordered', e.target.value)} min="1" required className="text-sm"/>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Total</Label>
                                            <Input value={`${currencySymbol}${((unitCost) * (item.quantity_ordered || 0)).toFixed(2)}`} readOnly className="bg-gray-100 font-semibold text-sm"/>
                                        </div>
                                    </div>
                                    {partDetails && (partDetails.pack_size || 1) > 1 && (
                                        <p className="text-xs text-blue-600 font-medium">
                                            Pack of {partDetails.pack_size} — {item.quantity_ordered || 0} pack{(item.quantity_ordered || 0) !== 1 ? 's' : ''} = <strong>{(item.quantity_ordered || 0) * partDetails.pack_size} individual units</strong> added to inventory on receipt
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-4"><Plus className="mr-2 h-4 w-4"/>Add Item</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                 <div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="payment_type">Payment Type</Label>
                            <Select value={poData.payment_type} onValueChange={val => setPoData(prev => ({...prev, payment_type: val}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {paymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="shipping_method">Shipping Method</Label>
                            <Select value={poData.shipping_method} onValueChange={val => setPoData(prev => ({...prev, shipping_method: val}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {shippingMethods.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="approved_by">Approved by:</Label>
                        <Input 
                            id="approved_by" 
                            placeholder="Enter approver's name"
                            value={poData.approved_by_user_name} 
                            onChange={e => setPoData(prev => ({...prev, approved_by_user_name: e.target.value}))}
                        />
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="tax_rate">Tax Rate (%):</Label>
                        <Input 
                            id="tax_rate" 
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={poData.tax_rate} 
                            onChange={e => setPoData(prev => ({...prev, tax_rate: parseFloat(e.target.value) || 0}))}
                        />
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="shipping_expense">Shipping Expense (Optional):</Label>
                        <Input 
                            id="shipping_expense" 
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={poData.shipping_expense} 
                            onChange={e => setPoData(prev => ({...prev, shipping_expense: e.target.value}))}
                        />
                    </div>
                     <Label htmlFor="notes" className="mt-4 block">Notes</Label>
                     <Textarea id="notes" value={poData.notes} onChange={e => setPoData(prev => ({ ...prev, notes: e.target.value }))} />
                 </div>
                 <div className="text-right space-y-2 pt-5">
                 <div className="flex justify-between text-lg"><span className="text-gray-600">Subtotal:</span> <span className="font-semibold">{currencySymbol}{subtotal.toFixed(2)} {currencyCode}</span></div>
                 <div className="flex justify-between text-lg"><span className="text-gray-600">Tax ({poData.tax_rate}%):</span> <span className="font-semibold">{currencySymbol}{(subtotal * (poData.tax_rate / 100)).toFixed(2)}</span></div>
                 {parseFloat(poData.shipping_expense) > 0 && (
                    <div className="flex justify-between text-lg"><span className="text-gray-600">Shipping:</span> <span className="font-semibold">{currencySymbol}{parseFloat(poData.shipping_expense).toFixed(2)}</span></div>
                 )}
                 <div className="flex justify-between text-xl font-bold border-t pt-2"><span>Total:</span> <span>{currencySymbol}{(subtotal + (subtotal * (poData.tax_rate / 100)) + (parseFloat(poData.shipping_expense) || 0)).toFixed(2)} {currencyCode}</span></div>
                 </div>
            </div>

            <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving...</> : (initialData ? 'Update Purchase Order' : 'Create Purchase Order')}
                </Button>
            </div>
        </form>
    );
}