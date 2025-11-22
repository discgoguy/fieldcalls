
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TicketForm({ customers, technicians, onSubmit, initialData = {}, isSubmitting, error }) {
    const [ticketData, setTicketData] = useState({
        customer_id: initialData.customer_id || "",
        subject: initialData.subject || "",
        ticket_type: initialData.ticket_type || "Repair Request",
        urgency: initialData.urgency || "Medium",
        technician_id: initialData.technician_id || "",
        description: initialData.description || ""
    });

    const handleChange = (field, value) => {
        // Convert "none" back to empty string for technician_id
        const actualValue = (field === 'technician_id' && value === 'none') ? '' : value;
        setTicketData(prev => ({ ...prev, [field]: actualValue }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(ticketData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            
            <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select value={ticketData.customer_id} onValueChange={(val) => handleChange('customer_id', val)} required>
                    <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                    <SelectContent>
                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            
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
                            <SelectItem value="Quotation">Quotation</SelectItem>
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
                <Label htmlFor="technician">Assigned Technician (Optional)</Label>
                <Select value={ticketData.technician_id || 'none'} onValueChange={(val) => handleChange('technician_id', val)}>
                    <SelectTrigger><SelectValue placeholder="Assign a technician" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={ticketData.description} onChange={(e) => handleChange('description', e.target.value)} required rows={5} />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Ticket"}
            </Button>
        </form>
    );
}
