import React, { useState, useEffect } from 'react';
import { Part } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle, Plus, X, Upload, File as FileIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { applySortSettings, sortArray } from '@/components/utils/sortUtils';

export default function TicketForm({ customers, technicians, parts = [], categories = [], onSubmit, initialData = {}, isSubmitting, error }) {
    const [sortedParts, setSortedParts] = useState(parts);

    useEffect(() => {
        applySortSettings().then(settings => {
            setSortedParts(sortArray(parts.filter(p => !p.is_obsolete), settings.parts));
        });
    }, [parts]);

    const [ticketData, setTicketData] = useState({
        customer_id: initialData.customer_id || "",
        subject: initialData.subject || "",
        ticket_type: initialData.ticket_type || "Repair Request",
        urgency: initialData.urgency || "Medium",
        customer_po_number: initialData.customer_po_number || "",
        technician_id: initialData.technician_id || "",
        description: initialData.description || ""
    });
    const [includeParts, setIncludeParts] = useState(!!(initialData.parts && initialData.parts.length > 0));
    const [ticketParts, setTicketParts] = useState(initialData.parts || [{ part_id: '', category: 'all', quantity: 1 }]);
    const [attachments, setAttachments] = useState(initialData.attachments || []);
    const [uploading, setUploading] = useState(false);

    const handleChange = (field, value) => {
        // Convert "none" back to empty string for technician_id
        const actualValue = (field === 'technician_id' && value === 'none') ? '' : value;
        setTicketData(prev => ({ ...prev, [field]: actualValue }));
    };

    const handlePartChange = (index, field, value) => {
        const newParts = [...ticketParts];
        newParts[index][field] = value;
        if (field === 'category') {
            newParts[index].part_id = '';
        } else if (field === 'part_id') {
            const selectedPart = parts.find(p => p.id === value);
            if (selectedPart) {
                const selectedCustomer = customers.find(c => c.id === ticketData.customer_id);
                const useNonSA = selectedCustomer?.is_nonsa || false;
                newParts[index].price = useNonSA ? (selectedPart.nonsa_price || selectedPart.sales_price || 0) : (selectedPart.sales_price || 0);
            }
        }
        setTicketParts(newParts);
    };

    const addPart = () => {
        setTicketParts([...ticketParts, { part_id: '', category: 'all', quantity: 1 }]);
    };

    const removePart = (index) => {
        if (ticketParts.length > 1) {
            setTicketParts(ticketParts.filter((_, i) => i !== index));
        }
    };

    const getFilteredParts = (categoryFilter) => {
        if (categoryFilter === 'all') return sortedParts;
        return sortedParts.filter(p => p.category === categoryFilter);
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setUploading(true);
        try {
            const uploadedFiles = [];
            for (const file of files) {
                const result = await UploadFile({ file });
                uploadedFiles.push({
                    url: result.file_url,
                    name: file.name
                });
            }
            setAttachments([...attachments, ...uploadedFiles]);
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (index) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToSubmit = {
            ...ticketData,
            parts: includeParts ? ticketParts.filter(p => p.part_id) : [],
            attachments
        };
        onSubmit(dataToSubmit);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            
            <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select value={ticketData.customer_id} onValueChange={(val) => handleChange('customer_id', val)} required>
                    <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                    <SelectContent>
                        {customers.filter(c => !c.inactive).sort((a, b) => a.company_name.localeCompare(b.company_name)).map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            
            <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input id="subject" value={ticketData.subject} onChange={(e) => handleChange('subject', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="customer_po_number">Customer PO Number</Label>
                <Input id="customer_po_number" placeholder="e.g. PO-12345" value={ticketData.customer_po_number} onChange={(e) => handleChange('customer_po_number', e.target.value)} />
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
                        {technicians.filter(t => t.active !== false).sort((a, b) => a.full_name.localeCompare(b.full_name)).map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={ticketData.description} onChange={(e) => handleChange('description', e.target.value)} required rows={5} />
            </div>

            <div className="space-y-2">
                <Label>Attachments (Optional)</Label>
                <div className="flex items-center gap-2">
                    <Input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="flex-1"
                    />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {attachments.length > 0 && (
                    <div className="space-y-2 mt-2">
                        {attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                                <div className="flex items-center gap-2">
                                    <FileIcon className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm">{file.name}</span>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeAttachment(index)}
                                >
                                    <X className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Checkbox
                    id="include_parts"
                    checked={includeParts}
                    onCheckedChange={(checked) => {
                        setIncludeParts(checked);
                        if (!checked) {
                            setTicketParts([{ part_id: '', category: 'all', quantity: 1 }]);
                        }
                    }}
                />
                <Label htmlFor="include_parts" className="cursor-pointer font-medium">
                    Include Parts List (Optional)
                </Label>
            </div>

            {includeParts && (
                <div className="space-y-3 p-3 border rounded-lg bg-slate-50">
                    <Label className="text-sm font-semibold">Parts</Label>
                    {ticketParts.map((item, index) => (
                        <div key={index} className="space-y-3 md:space-y-0 md:grid md:grid-cols-12 gap-3 items-end p-3 bg-white rounded border">
                            <div className="md:col-span-4">
                                <Label className="text-xs">Category</Label>
                                <Select value={item.category} onValueChange={(val) => handlePartChange(index, 'category', val)}>
                                    <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-6">
                                <Label className="text-xs">Part</Label>
                                <Select value={item.part_id} onValueChange={(val) => handlePartChange(index, 'part_id', val)}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select part"/></SelectTrigger>
                                    <SelectContent>
                                        {getFilteredParts(item.category).map(p => 
                                            <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number})</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-1">
                                <Label className="text-xs">Qty</Label>
                                <Input type="number" className="h-9" value={item.quantity} onChange={(e) => handlePartChange(index, 'quantity', e.target.value)} min="1"/>
                            </div>
                            <div className="md:col-span-1 flex items-end justify-center md:justify-end">
                                {ticketParts.length > 1 && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => removePart(index)}>
                                        <X className="h-4 w-4 text-red-500"/>
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addPart}>
                        <Plus className="mr-2 h-4 w-4"/>Add Part
                    </Button>
                </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Ticket"}
            </Button>
        </form>
    );
}