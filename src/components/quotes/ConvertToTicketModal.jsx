
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function generateDescriptionFromQuote(quote) {
    let description = `Ticket created from accepted Quote: ${quote.quote_number}\n`;
    description += `Subject: ${quote.subject}\n\n`;
    description += '--- QUOTED ITEMS ---\n';

    (quote.items || []).forEach(item => {
        description += `- ${item.quantity}x ${item.description} @ $${(item.unit_price || 0).toFixed(2)} each\n`;
    });

    description += '\n--- END OF ITEMS ---';
    return description;
}

export default function ConvertToTicketModal({ isOpen, onOpenChange, quote, technicians, onSubmit }) {
    const [ticketData, setTicketData] = useState({
        subject: quote.subject || 'Follow-up from Quote',
        ticket_type: 'Repair Request',
        urgency: 'Medium',
        technician_id: '',
        description: generateDescriptionFromQuote(quote),
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field, value) => {
        setTicketData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        const result = await onSubmit(ticketData);

        if (result !== true) {
            setError(result || 'An unknown error occurred.');
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Ticket from Quote</DialogTitle>
                    <DialogDescription>
                        The quote has been accepted. Create a new support ticket to schedule the work.
                    </DialogDescription>
                </DialogHeader>
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div>
                        <Label htmlFor="subject">Subject *</Label>
                        <Input id="subject" value={ticketData.subject} onChange={(e) => handleChange('subject', e.target.value)} required />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="ticket_type">Type *</Label>
                            <Select value={ticketData.ticket_type} onValueChange={(val) => handleChange('ticket_type', val)} required>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Repair Request">Repair Request</SelectItem>
                                    <SelectItem value="Parts Request">Parts Request</SelectItem>
                                    <SelectItem value="Information Request">Information Request</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="urgency">Urgency *</Label>
                            <Select value={ticketData.urgency} onValueChange={(val) => handleChange('urgency', val)} required>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="technician">Assign Technician (Optional)</Label>
                        <Select value={ticketData.technician_id} onValueChange={(val) => handleChange('technician_id', val)}>
                            <SelectTrigger><SelectValue placeholder="Assign a technician" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="description">Description (Auto-generated)</Label>
                        <Textarea id="description" value={ticketData.description} readOnly rows={8} className="bg-gray-50" />
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating Ticket...</> : "Create Ticket and Accept Quote"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
