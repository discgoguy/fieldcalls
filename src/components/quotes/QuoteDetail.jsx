import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wrench, Package, Printer, Save, ChevronDown, Pencil, Trash2, Check, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';
import QuotePrintLayout from './QuotePrintLayout';
import ConvertToTicketModal from './ConvertToTicketModal';


// Main component
export default function QuoteDetail({ quote, customer, parts, users, isOpen, onOpenChange, onUpdate }) {
    const [isConvertingToOrder, setIsConvertingToOrder] = useState(false);
    const [conversionType, setConversionType] = useState(null);

    const statusColors = {
        Draft: "bg-gray-100 text-gray-800",
        Sent: "bg-blue-100 text-blue-800",
        Accepted: "bg-green-100 text-green-800",
        Declined: "bg-red-100 text-red-800",
        Expired: "bg-yellow-100 text-yellow-800",
    };

    const handleStatusChange = (newStatus) => {
        onUpdate({
            type: 'statusChange',
            quoteId: quote.id,
            newStatus: newStatus
        });
    };

    const handleEdit = () => {
        onUpdate({ type: 'edit', quoteId: quote.id });
    };

    const handleDelete = () => {
        onUpdate({ type: 'delete', quoteId: quote.id });
    };

    const handleConvertToOrderClick = (type) => {
        setConversionType(type);
        setIsConvertingToOrder(true);
    };

    const handleConvert = async (formData) => {
        await onUpdate({
            type: 'convert',
            quoteId: quote.id,
            conversionType: conversionType,
            ...formData
        });
        setIsConvertingToOrder(false);
        setConversionType(null);
    };

    if (!quote || !customer) return null;
    
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Quote: {quote.quote_number}</DialogTitle>
                        <DialogDescription>For customer: {customer.company_name}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 mr-4">
                                <h3 className="text-lg font-semibold text-gray-800">{quote.subject}</h3>
                                {quote.valid_until && <p className="text-sm text-muted-foreground">Valid Until: {format(new Date(quote.valid_until), 'MMM d, yyyy')}</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="flex items-center gap-2">
                                             <Badge className={`${statusColors[quote.status]} mr-2`}>{quote.status}</Badge>
                                             <span className="sr-only">Change Status</span>
                                             <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'].map(status => (
                                            <DropdownMenuItem key={status} onSelect={() => handleStatusChange(status)} disabled={quote.status === status}>
                                                {quote.status === status && <Check className="h-4 w-4 mr-2"/>}
                                                Set as {status}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-2 text-left font-medium">Description</th>
                                        <th className="p-2 text-right font-medium">Qty</th>
                                        <th className="p-2 text-right font-medium">Unit Price</th>
                                        <th className="p-2 text-right font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(quote.items || []).map((item, index) => (
                                        <tr key={item.id || index} className="border-b">
                                            <td className="p-2">{item.description}</td>
                                            <td className="p-2 text-right">{item.quantity}</td>
                                            <td className="p-2 text-right">${(item.unit_price || 0).toFixed(2)}</td>
                                            <td className="p-2 text-right font-semibold">${(item.total_price || 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                                 <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>${(quote.subtotal || 0).toFixed(2)}</span></div>
                                 <div className="flex justify-between"><span className="text-muted-foreground">Tax ({quote.tax_rate}%):</span><span>${(quote.tax_amount || 0).toFixed(2)}</span></div>
                                 <div className="flex justify-between font-bold text-lg border-t pt-2"><span >Total:</span><span>${(quote.total_amount || 0).toFixed(2)}</span></div>
                            </div>
                        </div>

                        {quote.notes && <div className="p-3 bg-gray-50 rounded-md border">
                            <h4 className="font-semibold mb-1">Notes</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
                        </div>}

                        {quote.terms_and_conditions && <div className="p-3 bg-gray-50 rounded-md border">
                            <h4 className="font-semibold mb-1">Terms & Conditions</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.terms_and_conditions}</p>
                        </div>}
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <div className="flex w-full justify-between items-center">
                            <div className="flex gap-2">
                                {quote.status === 'Draft' && (
                                    <>
                                        <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2"/>Delete</Button>
                                        <Button variant="outline" size="sm" onClick={handleEdit}><Pencil className="h-4 w-4 mr-2"/>Edit</Button>
                                    </>
                                )}
                                <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/>Print</Button>
                            </div>
                           
                            <div className="flex gap-2">
                               {quote.status !== 'Draft' && <Button variant="outline" size="sm" onClick={() => handleStatusChange('Sent')}><Send className="h-4 w-4 mr-2"/>Send to Customer</Button>}

                                {quote.status === 'Accepted' && (
                                    <>
                                        <Button size="sm" variant="secondary" onClick={() => handleConvertToOrderClick('order')}><Package className="h-4 w-4 mr-2"/>Create Parts Order</Button>
                                        <Button size="sm" variant="secondary" onClick={() => handleConvertToOrderClick('service')}><Wrench className="h-4 w-4 mr-2"/>Create Service Call</Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="hidden print:block print-container">
                <QuotePrintLayout quote={quote} customer={customer} />
            </div>
            { isConvertingToOrder && (
                 <ConvertToTicketModal
                    isOpen={isConvertingToOrder}
                    onOpenChange={() => setIsConvertingToOrder(false)}
                    onSubmit={handleConvert}
                    conversionType={conversionType}
                    quote={quote}
                    parts={parts}
                    users={users}
                />
            )}
           
            <style>{`
                @media print {
                  body * {
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