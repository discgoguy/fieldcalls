import React from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Printer, Save, Check, Loader2, Pencil } from 'lucide-react';
import PurchaseOrderPrintLayout from './PurchaseOrderPrintLayout';

export default function PurchaseOrderDetail({ purchaseOrder, supplier, parts, isOpen, onOpenChange, onUpdate, onEdit }) {
    const [items, setItems] = React.useState(purchaseOrder.items || []);
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        setItems(purchaseOrder.items || []);
    }, [purchaseOrder]);

    const handleReceiveAll = (itemId) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                return { 
                    ...item, 
                    received: true, 
                    quantity_received: item.quantity_ordered,
                    receiving_mode: 'all'
                };
            }
            return item;
        }));
    };

    const handleReceivePartial = (itemId, isPartial) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                if (isPartial) {
                    return { 
                        ...item, 
                        received: false,
                        receiving_mode: 'partial'
                    };
                } else {
                    return { 
                        ...item, 
                        received: false,
                        quantity_received: item.quantity_received || 0,
                        receiving_mode: null
                    };
                }
            }
            return item;
        }));
    };

    const handlePartialQuantityChange = (itemId, newQuantity) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                const qty = parseInt(newQuantity) || 0;
                const isFullyReceived = qty >= item.quantity_ordered;
                return { 
                    ...item, 
                    quantity_received: qty,
                    received: isFullyReceived,
                    receiving_mode: isFullyReceived ? 'all' : 'partial'
                };
            }
            return item;
        }));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError('');
        try {
            const updates = [];
            const inventoryUpdates = [];
            
            for (const item of items) {
                const originalItem = purchaseOrder.items.find(i => i.id === item.id);
                const previouslyReceived = originalItem.quantity_received || 0;
                const newlyReceived = (item.quantity_received || 0) - previouslyReceived;
                
                // Only update if there's a change in quantity received
                if (newlyReceived > 0) {
                    updates.push(
                        base44.entities.PurchaseOrderItem.update(item.id, { 
                            received: item.received, 
                            quantity_received: item.quantity_received || 0
                        })
                    );
                    
                    // Update inventory with only the newly received quantity
                    const partDetails = parts.find(p => p.id === item.part_id);
                    if (partDetails) {
                        const newStock = (partDetails.quantity_in_inventory || 0) + newlyReceived;
                        inventoryUpdates.push(
                            base44.entities.Part.update(item.part_id, { quantity_in_inventory: newStock })
                        );
                    }
                }
            }

            await Promise.all(updates);
            await Promise.all(inventoryUpdates);

            // Check if all items are fully received
            const allItemsReceived = items.every(item => item.received);
            if (allItemsReceived && purchaseOrder.status !== 'Complete') {
                await base44.entities.PurchaseOrder.update(purchaseOrder.id, { status: 'Complete' });
            }
            
            await onUpdate();

        } catch (e) {
            setError(e.message || 'An error occurred while saving changes.');
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!purchaseOrder) return null;
    
    const currencySymbol = purchaseOrder.currency === 'USD' ? '$' : '$';
    const currencyCode = purchaseOrder.currency || 'CAD';
    
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Purchase Order: {purchaseOrder.po_number}</DialogTitle>
                        <DialogDescription>From: {supplier?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-6">
                        {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-800">Items to Receive</h3>
                            <Badge className={purchaseOrder.status === 'Complete' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                                {purchaseOrder.status}
                            </Badge>
                        </div>
                        
                        <div className="border rounded-lg">
                            <div className="w-full text-sm">
                                <div className="bg-gray-50 grid grid-cols-12 p-2 font-medium">
                                    <div className="col-span-5">Description</div>
                                    <div className="col-span-2 text-center">Qty Ordered</div>
                                    <div className="col-span-2 text-right">Unit Cost</div>
                                    <div className="col-span-3 text-center">Receiving Status</div>
                                </div>
                                <div>
                                    {items.map(item => {
                                        const isDisabled = purchaseOrder.status === 'Complete' || item.received;
                                        const qtyReceived = item.quantity_received || 0;
                                        const qtyOrdered = item.quantity_ordered;
                                        
                                        return (
                                            <div key={item.id} className="grid grid-cols-12 p-2 border-b items-center gap-2">
                                                <div className="col-span-5">{item.description}</div>
                                                <div className="col-span-2 text-center">
                                                    <div>{qtyOrdered}</div>
                                                    {qtyReceived > 0 && qtyReceived < qtyOrdered && (
                                                        <div className="text-xs text-blue-600 font-medium">
                                                            ({qtyReceived} received)
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="col-span-2 text-right">{currencySymbol}{(item.unit_cost || 0).toFixed(2)}</div>
                                                <div className="col-span-3">
                                                    {qtyOrdered === 1 ? (
                                                        /* Simple checkbox for single quantity */
                                                        <div className="flex justify-center items-center">
                                                            <Checkbox
                                                                id={`received-${item.id}`}
                                                                checked={item.received}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) {
                                                                        handleReceiveAll(item.id);
                                                                    } else {
                                                                        setItems(items.map(i => i.id === item.id ? {...i, received: false, quantity_received: 0} : i));
                                                                    }
                                                                }}
                                                                disabled={isDisabled}
                                                            />
                                                            <Label htmlFor={`received-${item.id}`} className="ml-2 text-sm">
                                                                Received
                                                            </Label>
                                                        </div>
                                                    ) : (
                                                        /* Received All / Partial options for multiple quantities */
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-4 justify-center">
                                                                <div className="flex items-center">
                                                                    <Checkbox
                                                                        id={`received-all-${item.id}`}
                                                                        checked={item.receiving_mode === 'all' || (item.received && !item.receiving_mode)}
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) handleReceiveAll(item.id);
                                                                        }}
                                                                        disabled={isDisabled}
                                                                    />
                                                                    <Label htmlFor={`received-all-${item.id}`} className="ml-2 text-sm cursor-pointer">
                                                                        Received All
                                                                    </Label>
                                                                </div>
                                                                <div className="flex items-center">
                                                                    <Checkbox
                                                                        id={`received-partial-${item.id}`}
                                                                        checked={item.receiving_mode === 'partial'}
                                                                        onCheckedChange={(checked) => handleReceivePartial(item.id, checked)}
                                                                        disabled={isDisabled}
                                                                    />
                                                                    <Label htmlFor={`received-partial-${item.id}`} className="ml-2 text-sm cursor-pointer">
                                                                        Partial
                                                                    </Label>
                                                                </div>
                                                            </div>
                                                            {item.receiving_mode === 'partial' && (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <Label htmlFor={`qty-${item.id}`} className="text-xs">
                                                                        Qty Received:
                                                                    </Label>
                                                                    <Input
                                                                        id={`qty-${item.id}`}
                                                                        type="number"
                                                                        min="0"
                                                                        max={qtyOrdered}
                                                                        value={item.quantity_received || 0}
                                                                        onChange={(e) => handlePartialQuantityChange(item.id, e.target.value)}
                                                                        className="w-20 h-8 text-center"
                                                                        disabled={isDisabled}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{currencySymbol}{(purchaseOrder.subtotal || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{currencySymbol}{(purchaseOrder.tax_amount || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{currencySymbol}{(purchaseOrder.total_amount || 0).toFixed(2)} {currencyCode}</span></div>
                            </div>
                        </div>

                    </div>
                    <DialogFooter className="pt-4 border-t items-center justify-between">
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/>Print</Button>
                            {purchaseOrder.status !== 'Complete' && (
                                <Button variant="outline" size="sm" onClick={onEdit}>
                                    <Pencil className="h-4 w-4 mr-2" />Edit
                                </Button>
                            )}
                        </div>
                        {purchaseOrder.status !== 'Complete' && (
                             <Button size="sm" onClick={handleSaveChanges} disabled={isSaving}>
                                {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Saving...</> : <><Check className="h-4 w-4 mr-2"/>Save Received Items</>}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="hidden print:block">
                <PurchaseOrderPrintLayout purchaseOrder={purchaseOrder} supplier={supplier} />
            </div>
            <style>{`
                @media print {
                  body > *:not(.print-container) {
                    visibility: hidden;
                  }
                  .print-container, .print-container * {
                    visibility: visible;
                  }
                  .print-container {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                  }
                }
            `}</style>
        </>
    );
}