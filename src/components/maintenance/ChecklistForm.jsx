import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

export default function ChecklistForm({ customers, machines, technicians, onSubmit }) {
    const [formData, setFormData] = useState({
        customer_id: '',
        visit_date: new Date().toISOString().split('T')[0],
        status: 'Scheduled',
        machine_ids: [],
        technician_ids: [],
        notes: ''
    });
    const [customerMachines, setCustomerMachines] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (formData.customer_id) {
            const filtered = machines.filter(m => m.customer_id === formData.customer_id);
            setCustomerMachines(filtered);
            setFormData(prev => ({ ...prev, machine_ids: [] }));
        } else {
            setCustomerMachines([]);
        }
    }, [formData.customer_id, machines]);

    const handleMachineToggle = (machineId) => {
        setFormData(prev => ({
            ...prev,
            machine_ids: prev.machine_ids.includes(machineId)
                ? prev.machine_ids.filter(id => id !== machineId)
                : [...prev.machine_ids, machineId]
        }));
    };

    const handleTechnicianToggle = (technicianId) => {
        setFormData(prev => ({
            ...prev,
            technician_ids: prev.technician_ids.includes(technicianId)
                ? prev.technician_ids.filter(id => id !== technicianId)
                : [...prev.technician_ids, technicianId]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.customer_id) {
            setError('Please select a customer.');
            return;
        }
        if (formData.machine_ids.length === 0) {
            setError('Please select at least one machine.');
            return;
        }

        setIsSubmitting(true);
        const result = await onSubmit(formData);
        setIsSubmitting(false);

        if (result) {
            setError(result);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}

            <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select value={formData.customer_id} onValueChange={(value) => setFormData({...formData, customer_id: value})}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                        {customers.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label htmlFor="visit_date">Visit Date *</Label>
                <Input
                    id="visit_date"
                    type="date"
                    value={formData.visit_date}
                    onChange={(e) => setFormData({...formData, visit_date: e.target.value})}
                    required
                />
            </div>

            {customerMachines.length > 0 && (
                <div>
                    <Label>Machines *</Label>
                    <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                        {customerMachines.map(machine => (
                            <label key={machine.id} className="flex items-center space-x-2 cursor-pointer">
                                <Checkbox
                                    checked={formData.machine_ids.includes(machine.id)}
                                    onCheckedChange={() => handleMachineToggle(machine.id)}
                                />
                                <span className="text-sm">{machine.model} (S/N: {machine.serial_number})</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <Label>Technicians (Optional)</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                    {technicians.map(tech => (
                        <label key={tech.id} className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                                checked={formData.technician_ids.includes(tech.id)}
                                onCheckedChange={() => handleTechnicianToggle(tech.id)}
                            />
                            <span className="text-sm">{tech.full_name}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="General notes about this maintenance visit..."
                />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Checklist'}
            </Button>
        </form>
    );
}