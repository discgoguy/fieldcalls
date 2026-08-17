import React from 'react';
import { Part, PurchaseOrder, PurchaseOrderItem } from '@/api/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Printer, Save, Check, Loader2, Pencil, Trash2, Mail, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { invokeApi } from '@/api/supabaseClient';
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
import PurchaseOrderPrintLayout from './PurchaseOrderPrintLayout';

export default function PurchaseOrderDetail({ purchaseOrder, supplier, parts, isOpen, onOpenChange, onUpdate, onEdit }) {
    const [items, setItems] = React.useState(purchaseOrder.items || []);
    const [isSaving, setIsSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
    const [showEmailDialog, setShowEmailDialog] = React.useState(false);
    const [emailMessage, setEmailMessage] = React.useState('');
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);
    const [emailSuccess, setEmailSuccess] = React.useState('');

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
                        PurchaseOrderItem.update(item.id, { 
                            received: item.received, 
                            quantity_received: item.quantity_received || 0
                        })
                    );
                    
                    // Update inventory with only the newly received quantity
                    const partDetails = parts.find(p => p.id === item.part_id);
                    if (partDetails) {
                        const packSize = partDetails.pack_size || 1;
                        const unitsReceived = newlyReceived * packSize;
                        const previousStock = partDetails.quantity_in_inventory || 0;
                        const newStock = previousStock + unitsReceived;
                        inventoryUpdates.push(
                            Part.update(item.part_id, { quantity_in_inventory: newStock })
                        );
                        // Log to inventory audit
                        inventoryUpdates.push(
                            invokeApi('inventory', {
                                action: 'audit',
                                part_id: item.part_id,
                                change_type: 'receipt',
                                quantity_before: previousStock,
                                quantity_change: unitsReceived,
                                quantity_after: newStock,
                                reference_type: 'purchase_order',
                                reference_id: purchaseOrder.id,
                                reference_number: purchaseOrder.po_number,
                            }).catch(e => console.error('Audit log failed:', e))
                        );
                    }
                }
            }

            await Promise.all(updates);
            await Promise.all(inventoryUpdates);

            // Check if all items are fully received
            const allItemsReceived = items.every(item => item.received);
            if (allItemsReceived && purchaseOrder.status !== 'Complete') {
                await PurchaseOrder.update(purchaseOrder.id, { status: 'Complete' });
            }
            
            await onUpdate();

        } catch (e) {
            setError(e.message || 'An error occurred while saving changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsSaving(true);
        setError('');
        try {
            // Delete all items first
            await Promise.all(items.map(item => PurchaseOrderItem.delete(item.id)));
            // Then delete the PO
            await PurchaseOrder.delete(purchaseOrder.id);
            setShowDeleteDialog(false);
            onOpenChange(false);
            await onUpdate();
        } catch (e) {
            setError(e.message || 'Failed to delete purchase order.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendEmail = async () => {
        setIsSendingEmail(true);
        setError('');
        try {
            const result = await invokeApi('sendPurchaseOrder', {
                purchaseOrderId: purchaseOrder.id,
                message: emailMessage,
            });
            setEmailSuccess(`Purchase order sent to ${result.sentTo}`);
            setShowEmailDialog(false);
            setEmailMessage('');
            if (onUpdate) onUpdate();
            setTimeout(() => setEmailSuccess(''), 5000);
        } catch (e) {
            setError(e.message || 'Failed to send email.');
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const printContent = document.getElementById('po-print-content');
        
        if (printWindow && printContent) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Purchase Order - ${purchaseOrder.po_number}</title>
                        <style>
                            @page { margin: 0.5in; }
                            body { 
                                font-family: Arial, Helvetica, sans-serif;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        </style>
                    </head>
                    <body>
                        ${printContent.innerHTML}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };
    
    if (!purchaseOrder) return null;
    
    const currencySymbol = purchaseOrder.currency === 'USD' ? '$' : '$';
    const currencyCode = purchaseOrder.currency || 'CAD';
    
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl print:hidden">
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
                                {/* Desktop Header */}
                                <div className="hidden md:grid bg-gray-50 grid-cols-12 p-2 font-medium">
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
                                            <div key={item.id}>
                                                {/* Desktop Layout */}
                                                <div className="hidden md:grid grid-cols-12 p-2 border-b items-center gap-2">
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

                                                {/* Mobile Layout */}
                                                <div className="md:hidden p-3 border-b space-y-3">
                                                    <div className="font-medium text-sm">{item.description}</div>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-gray-500">Qty Ordered:</span>
                                                            <span className="ml-2 font-medium">{qtyOrdered}</span>
                                                            {qtyReceived > 0 && qtyReceived < qtyOrdered && (
                                                                <div className="text-xs text-blue-600 font-medium">
                                                                    ({qtyReceived} received)
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">Unit Cost:</span>
                                                            <span className="ml-2 font-medium">{currencySymbol}{(item.unit_cost || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2 border-t">
                                                        <div className="text-xs text-gray-500 mb-2">Receiving Status:</div>
                                                        {qtyOrdered === 1 ? (
                                                            <div className="flex items-center">
                                                                <Checkbox
                                                                    id={`received-mobile-${item.id}`}
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
                                                                <Label htmlFor={`received-mobile-${item.id}`} className="ml-2 text-sm">
                                                                    Received
                                                                </Label>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center">
                                                                        <Checkbox
                                                                            id={`received-all-mobile-${item.id}`}
                                                                            checked={item.receiving_mode === 'all' || (item.received && !item.receiving_mode)}
                                                                            onCheckedChange={(checked) => {
                                                                                if (checked) handleReceiveAll(item.id);
                                                                            }}
                                                                            disabled={isDisabled}
                                                                        />
                                                                        <Label htmlFor={`received-all-mobile-${item.id}`} className="ml-2 text-sm cursor-pointer">
                                                                            Received All
                                                                        </Label>
                                                                    </div>
                                                                    <div className="flex items-center">
                                                                        <Checkbox
                                                                            id={`received-partial-mobile-${item.id}`}
                                                                            checked={item.receiving_mode === 'partial'}
                                                                            onCheckedChange={(checked) => handleReceivePartial(item.id, checked)}
                                                                            disabled={isDisabled}
                                                                        />
                                                                        <Label htmlFor={`received-partial-mobile-${item.id}`} className="ml-2 text-sm cursor-pointer">
                                                                            Partial
                                                                        </Label>
                                                                    </div>
                                                                </div>
                                                                {item.receiving_mode === 'partial' && (
                                                                    <div className="flex items-center gap-2 pl-6">
                                                                        <Label htmlFor={`qty-mobile-${item.id}`} className="text-xs">
                                                                            Qty Received:
                                                                        </Label>
                                                                        <Input
                                                                            id={`qty-mobile-${item.id}`}
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
                                {(purchaseOrder.shipping_expense > 0) && (
                                    <div className="flex justify-between"><span className="text-muted-foreground">Shipping:</span><span>{currencySymbol}{(purchaseOrder.shipping_expense || 0).toFixed(2)}</span></div>
                                )}
                                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{currencySymbol}{(purchaseOrder.total_amount || 0).toFixed(2)} {currencyCode}</span></div>
                            </div>
                        </div>

                    </div>
                    <DialogFooter className="pt-4 border-t items-center justify-between">
                        <div className="flex gap-2">
                            {emailSuccess && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <Check className="h-3 w-3" /> {emailSuccess}
                                </span>
                            )}
                            {supplier?.email ? (
                                <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(true)} className="text-blue-600 hover:text-blue-700 border-blue-200">
                                    <Mail className="h-4 w-4 mr-2"/>Email to Supplier
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" disabled title="No email on file for this supplier">
                                    <Mail className="h-4 w-4 mr-2 opacity-40"/>No Supplier Email
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2"/>Print</Button>
                            {purchaseOrder.status !== 'Complete' && (
                                <>
                                    <Button variant="outline" size="sm" onClick={onEdit}>
                                        <Pencil className="h-4 w-4 mr-2" />Edit
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} className="text-red-600 hover:text-red-700">
                                        <Trash2 className="h-4 w-4 mr-2" />Delete
                                    </Button>
                                </>
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
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete purchase order {purchaseOrder.po_number}? This action cannot be undone and will delete all associated items.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Deleting...</> : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            {/* Email Dialog */}
            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" /> Email Purchase Order
                        </DialogTitle>
                        <DialogDescription>
                            Send {purchaseOrder.po_number} to {supplier?.name} ({supplier?.email})
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Subject</label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                                Purchase Order {purchaseOrder.po_number}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Message (optional)</label>
                            <Textarea
                                placeholder="Add a message to the supplier..."
                                value={emailMessage}
                                onChange={e => setEmailMessage(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                            <p className="font-medium mb-1">This email will include:</p>
                            <p>• PDF attachment: <strong>{purchaseOrder.po_number}.pdf</strong></p>
                            <p>• Order summary with total amount</p>
                            {purchaseOrder.status === 'Draft' && <p>• PO status will be updated to <strong>Sent</strong></p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                            {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Send to {supplier?.name}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div id="po-print-content" style={{ display: 'none' }}>
                <PurchaseOrderPrintLayout purchaseOrder={purchaseOrder} supplier={supplier} />
            </div>

        </>
    );
}