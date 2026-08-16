import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wrench, Package, Printer, Save, ChevronDown, Pencil, Trash2, Check, Loader2, Send, Mail } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { invokeApi } from '@/api/supabaseClient';
import { format } from '@/lib/dateUtils';
import QuotePrintLayout from './QuotePrintLayout';
import ConvertToTicketModal from './ConvertToTicketModal';


// Main component
export default function QuoteDetail({ quote, customer, parts, users, isOpen, onOpenChange, onUpdate }) {
    const [isConvertingToOrder, setIsConvertingToOrder] = useState(false);
    const [conversionType, setConversionType] = useState(null);
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [emailMessage, setEmailMessage] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailSuccess, setEmailSuccess] = useState('');
    const [emailError, setEmailError] = useState('');

    const statusColors = {
        Draft: "bg-gray-100 text-gray-800",
        Sent: "bg-blue-100 text-blue-800",
        Accepted: "bg-green-100 text-green-800",
        Declined: "bg-red-100 text-red-800",
        Expired: "bg-yellow-100 text-yellow-800",
    };

    const handleSendEmail = async () => {
        setIsSendingEmail(true);
        setEmailError('');
        try {
            const result = await invokeApi('sendQuote', {
                quoteId: quote.id,
                message: emailMessage,
            });
            setEmailSuccess(`Quote sent to ${result.sentTo}`);
            setShowEmailDialog(false);
            setEmailMessage('');
            if (onUpdate) onUpdate({ type: 'statusChange', quoteId: quote.id, newStatus: 'Sent' });
            setTimeout(() => setEmailSuccess(''), 5000);
        } catch (e) {
            setEmailError(e.message || 'Failed to send email.');
        } finally {
            setIsSendingEmail(false);
        }
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
                                {emailSuccess && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <Check className="h-3 w-3" /> {emailSuccess}
                                </span>
                            )}
                            {customer?.email ? (
                                <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-md" onClick={() => setShowEmailDialog(true)}>
                                    <Mail className="h-4 w-4"/>Email to Customer
                                </button>
                            ) : (
                                <button disabled className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 text-gray-400 rounded-md cursor-not-allowed" title="No email on file for this customer">
                                    <Mail className="h-4 w-4 opacity-40"/>No Customer Email
                                </button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/>Print</Button>
                            </div>
                           
                            <div className="flex gap-2">
                                {quote.status === 'Draft' && (
                                    <Button size="sm" variant="outline" onClick={() => handleStatusChange('Sent')}>
                                        <Send className="h-4 w-4 mr-2"/>Mark as Sent
                                    </Button>
                                )}
                                {quote.status === 'Sent' && (
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusChange('Accepted')}>
                                        <Check className="h-4 w-4 mr-2"/>Mark as Approved
                                    </Button>
                                )}
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
        {/* Email Dialog */}
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" /> Email Quote
                    </DialogTitle>
                    <DialogDescription>
                        Send {quote.quote_number} to {customer?.contact_person || customer?.company_name} ({customer?.email})
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Subject</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                            Quote {quote.quote_number}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Message (optional)</label>
                        <Textarea
                            placeholder="Add a message to the customer..."
                            value={emailMessage}
                            onChange={e => setEmailMessage(e.target.value)}
                            rows={4}
                        />
                    </div>
                    {emailError && <p className="text-sm text-red-600">{emailError}</p>}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                        <p className="font-medium">This email will include:</p>
                        <p>• PDF attachment: <strong>{quote.quote_number}.pdf</strong></p>
                        <p>• Quote summary with total amount</p>
                        {quote.status === 'Draft' && <p>• Status will update to <strong>Sent</strong></p>}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
                    <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                        {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Send to {customer?.contact_person || customer?.company_name}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <ConvertToTicketModal
                    isOpen={isConvertingToOrder}
                    onOpenChange={() => setIsConvertingToOrder(false)}
                    onSubmit={handleConvert}
                    conversionType={conversionType}
                    quote={quote}
                    parts={parts}
                    users={users}
                />
           
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