import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Wrench } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isOptionSelected } from '@/lib/multiSelectUtils';

export default function ConvertToServiceModal({ checklist, customer, machines, technicians, items, parts, isOpen, onOpenChange }) {
    const [serviceNotes, setServiceNotes] = useState('');
    const [partsList, setPartsList] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // Auto-populate parts based on responses
            const autoAddedPartsList = [];

            const addPart = (partId, machineId, quantity) => {
                const existingIndex = autoAddedPartsList.findIndex(
                    p => p.part_id === partId && p.machine_id === machineId
                );
                if (existingIndex >= 0) {
                    autoAddedPartsList[existingIndex].quantity += quantity;
                } else {
                    autoAddedPartsList.push({ part_id: partId, machine_id: machineId, quantity });
                }
            };

            items.forEach(item => {
                // part_triggers: an array of { trigger_response, parts: [{ part_id, quantity }] },
                // supporting multiple possible answers (e.g. old vs. new machine style) each of
                // which can add more than one part. Legacy items (created before this existed, or
                // whose template was edited afterward) fall back to their own single
                // linked_part_id/linked_part_quantity/trigger_response fields.
                const rules = (item.part_triggers && item.part_triggers.length > 0)
                    ? item.part_triggers
                    : (item.linked_part_id
                        ? [{ trigger_response: item.trigger_response, parts: [{ part_id: item.linked_part_id, quantity: item.linked_part_quantity || 1 }] }]
                        : []);

                rules.forEach(rule => {
                    if (!rule.trigger_response && rule.trigger_response !== '') return;
                    const matchesTrigger =
                        (item.task_type === 'checkbox' && item.completed && item.response_value === rule.trigger_response) ||
                        (item.task_type === 'multiple_choice' && isOptionSelected(item.response_value, rule.trigger_response)) ||
                        (item.category === 'Replacement' && item.task_type === 'checkbox' && item.completed);

                    if (matchesTrigger) {
                        (rule.parts || []).forEach(p => {
                            if (p.part_id) {
                                addPart(p.part_id, item.machine_id, p.quantity || 1);
                            }
                        });
                    }
                });
            });

            setPartsList(autoAddedPartsList);

            // Set default notes from checklist
            setServiceNotes(checklist.notes || '');
        }
    }, [isOpen, items, checklist]);

    const handleAddPart = () => {
        setPartsList([...partsList, { part_id: '', machine_id: '', quantity: 1 }]);
    };

    const handlePartChange = (index, field, value) => {
        const updated = [...partsList];
        updated[index][field] = value;
        setPartsList(updated);
    };

    const handleRemovePart = (index) => {
        setPartsList(partsList.filter((_, i) => i !== index));
    };

    const handleConvert = () => {
        // Build the URL with all necessary parameters
        const params = new URLSearchParams({
            checklist_id: checklist.id,
            customer_id: customer.id,
            machine_ids: JSON.stringify(checklist.machine_ids),
            technician_ids: JSON.stringify(checklist.technician_ids),
            notes: serviceNotes,
            parts: JSON.stringify(partsList)
        });

        window.location.href = createPageUrl(`OnSiteService?${params.toString()}`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Convert to On-Site Service</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Service Notes</Label>
                        <Textarea
                            value={serviceNotes}
                            onChange={(e) => setServiceNotes(e.target.value)}
                            placeholder="Add notes about the service performed..."
                            className="mt-1"
                            rows={4}
                        />
                    </div>

                    <div>
                        <Label className="mb-2 block">Parts Used</Label>
                        <div className="space-y-2">
                            {partsList.map((part, index) => {
                                const partDetails = parts.find(p => p.id === part.part_id);
                                return (
                                    <Card key={index} className="p-3">
                                        <div className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-4">
                                                <Label className="text-xs">Machine</Label>
                                                <Select
                                                    value={part.machine_id}
                                                    onValueChange={(value) => handlePartChange(index, 'machine_id', value)}
                                                >
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue placeholder="Select machine" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {machines.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>
                                                                {m.model} ({m.serial_number})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-5">
                                                <Label className="text-xs">Part</Label>
                                                <Select
                                                    value={part.part_id}
                                                    onValueChange={(value) => handlePartChange(index, 'part_id', value)}
                                                >
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue placeholder="Select part" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {parts.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>
                                                                {p.part_name} ({p.part_number})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-2">
                                                <Label className="text-xs">Qty</Label>
                                                <Input
                                                    type="number"
                                                    value={part.quantity}
                                                    onChange={(e) => handlePartChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                                    min="1"
                                                    className="mt-1"
                                                />
                                            </div>
                                            <div className="col-span-1 flex items-end justify-center pb-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemovePart(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                            <Button variant="outline" onClick={handleAddPart} className="w-full">
                                <Plus className="mr-2 h-4 w-4" />Add Part
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConvert}>
                        <Wrench className="mr-2 h-4 w-4" />
                        Create Service Call
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}