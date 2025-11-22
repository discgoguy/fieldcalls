import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AssemblyComponentsManager({ components, onChange, availableParts, currentAssemblyId }) {
    const [localComponents, setLocalComponents] = useState(components || []);

    useEffect(() => {
        setLocalComponents(components || []);
    }, [components]);

    const handleAddComponent = () => {
        const newComponents = [...localComponents, { component_part_id: '', quantity_required: 1 }];
        setLocalComponents(newComponents);
        onChange(newComponents);
    };

    const handleRemoveComponent = (index) => {
        const newComponents = localComponents.filter((_, i) => i !== index);
        setLocalComponents(newComponents);
        onChange(newComponents);
    };

    const handleComponentChange = (index, field, value) => {
        const newComponents = [...localComponents];
        newComponents[index][field] = value;
        setLocalComponents(newComponents);
        onChange(newComponents);
    };

    // Filter out the current assembly from available parts to prevent self-reference
    const selectableParts = availableParts.filter(p => p.id !== currentAssemblyId);

    const calculateTotalCost = () => {
        return localComponents.reduce((sum, comp) => {
            const part = availableParts.find(p => p.id === comp.component_part_id);
            if (part) {
                return sum + (part.cost || 0) * (comp.quantity_required || 0);
            }
            return sum;
        }, 0);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center">
                    <Package className="mr-2 h-5 w-5" />
                    Assembly Components
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {localComponents.length === 0 ? (
                    <p className="text-sm text-gray-500">No components added yet. Click "Add Component" to start building this assembly.</p>
                ) : (
                    <>
                        {localComponents.map((component, index) => {
                            const selectedPart = availableParts.find(p => p.id === component.component_part_id);
                            return (
                                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg bg-slate-50">
                                    <div className="col-span-7">
                                        <Label>Component Part</Label>
                                        <Select
                                            value={component.component_part_id}
                                            onValueChange={(val) => handleComponentChange(index, 'component_part_id', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a part" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectableParts.map(part => (
                                                    <SelectItem key={part.id} value={part.id}>
                                                        {part.part_name} ({part.part_number})
                                                        {part.is_assembly && <Badge className="ml-2" variant="outline">Assembly</Badge>}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2">
                                        <Label>Quantity</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={component.quantity_required}
                                            onChange={(e) => handleComponentChange(index, 'quantity_required', parseInt(e.target.value) || 1)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Label>Unit Cost</Label>
                                        <Input
                                            value={selectedPart ? `$${(selectedPart.cost || 0).toFixed(2)}` : '$0.00'}
                                            disabled
                                            className="bg-gray-100"
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-center justify-center">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveComponent(index)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-semibold">Total Components Cost:</span>
                            <span className="text-lg font-bold">${calculateTotalCost().toFixed(2)}</span>
                        </div>
                    </>
                )}
                <Button type="button" variant="outline" onClick={handleAddComponent} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Component
                </Button>
            </CardContent>
        </Card>
    );
}