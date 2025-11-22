
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Copy, Trash2, Save, Loader2, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

const TASK_CATEGORIES = ['Inspection', 'Lubrication', 'Cleaning', 'Adjustment', 'Testing', 'Replacement', 'Other'];
const TASK_TYPES = ['checkbox', 'multiple_choice', 'text'];
const DEFAULT_OPTIONS = ['Good', 'Replaced', 'Needs Attention', 'N/A'];

export default function MaintenanceTemplatesPage() {
    const [machineTypes, setMachineTypes] = useState([]);
    const [parts, setParts] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedMachineType, setSelectedMachineType] = useState('');
    const [currentTemplate, setCurrentTemplate] = useState(null);
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const filter = await withTenantFilter();
            const [mtData, partData, templateData] = await Promise.all([
                base44.entities.MachineType.filter(filter),
                base44.entities.Part.filter(filter),
                base44.entities.MaintenanceTemplate.filter(filter)
            ]);
            setMachineTypes(mtData || []);
            setParts(partData || []);
            setTemplates(templateData || []);
        } catch (e) {
            setError('Failed to load templates.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleMachineTypeChange = (machineType) => {
        setSelectedMachineType(machineType);
        const existingTemplate = templates.find(t => t.machine_type === machineType);
        if (existingTemplate) {
            setCurrentTemplate(existingTemplate);
            setSections(existingTemplate.sections || []);
        } else {
            setCurrentTemplate(null);
            setSections([]);
        }
    };

    const addSection = () => {
        setSections([...sections, {
            section_name: '',
            tasks: []
        }]);
    };

    const updateSectionName = (sectionIndex, name) => {
        const newSections = [...sections];
        newSections[sectionIndex].section_name = name;
        setSections(newSections);
    };

    const duplicateSection = (sectionIndex) => {
        const sectionToCopy = sections[sectionIndex];
        const duplicated = JSON.parse(JSON.stringify(sectionToCopy));
        duplicated.section_name = `${duplicated.section_name} (Copy)`;
        setSections([...sections, duplicated]);
    };

    const deleteSection = (sectionIndex) => {
        setSections(sections.filter((_, i) => i !== sectionIndex));
    };

    const addTask = (sectionIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks.push({
            description: '',
            category: 'Inspection',
            task_type: 'checkbox',
            options: [],
            linked_part_id: '',
            linked_part_quantity: 1,
            trigger_response: ''
        });
        setSections(newSections);
    };

    const updateTask = (sectionIndex, taskIndex, field, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex][field] = value;
        
        // If task type changes to multiple_choice and no options, set defaults
        if (field === 'task_type' && value === 'multiple_choice' && newSections[sectionIndex].tasks[taskIndex].options.length === 0) {
            newSections[sectionIndex].tasks[taskIndex].options = [...DEFAULT_OPTIONS];
        }
        
        setSections(newSections);
    };

    const addOption = (sectionIndex, taskIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].options.push('');
        setSections(newSections);
    };

    const updateOption = (sectionIndex, taskIndex, optionIndex, value) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].options[optionIndex] = value;
        setSections(newSections);
    };

    const removeOption = (sectionIndex, taskIndex, optionIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks[taskIndex].options.splice(optionIndex, 1);
        setSections(newSections);
    };

    const deleteTask = (sectionIndex, taskIndex) => {
        const newSections = [...sections];
        newSections[sectionIndex].tasks.splice(taskIndex, 1);
        setSections(newSections);
    };

    const handleSave = async () => {
        if (!selectedMachineType) {
            setError('Please select a machine type.');
            return;
        }
        
        if (sections.length === 0) {
            setError('Please add at least one section.');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');
        
        try {
            let templateData = {
                machine_type: selectedMachineType,
                sections: sections
            };

            if (currentTemplate) {
                await base44.entities.MaintenanceTemplate.update(currentTemplate.id, templateData);
                setSuccess('Template updated successfully!');
            } else {
                templateData = await addTenantId(templateData);
                await base44.entities.MaintenanceTemplate.create(templateData);
                setSuccess('Template created successfully!');
            }
            
            await loadData();
            setTimeout(() => setSuccess(''), 4000);
        } catch (e) {
            setError('Failed to save template: ' + (e.message || 'An unknown error occurred.'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!currentTemplate) return;
        
        try {
            await base44.entities.MaintenanceTemplate.delete(currentTemplate.id);
            setSuccess('Template deleted successfully!');
            setSelectedMachineType('');
            setCurrentTemplate(null);
            setSections([]);
            await loadData();
            setTimeout(() => setSuccess(''), 4000);
        } catch (e) {
            setError('Failed to delete template.');
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Settings className="mr-2" />
                    Maintenance Templates
                </CardTitle>
                <CardDescription>Create and manage maintenance checklist templates for different machine types.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                {success && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <Label>Machine Type</Label>
                        <Select value={selectedMachineType} onValueChange={handleMachineTypeChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select machine type" />
                            </SelectTrigger>
                            <SelectContent>
                                {machineTypes.map(mt => (
                                    <SelectItem key={mt.id} value={mt.name}>{mt.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={addSection} disabled={!selectedMachineType}>
                        <Plus className="mr-2 h-4 w-4" />Add Section
                    </Button>
                </div>

                {selectedMachineType && sections.length > 0 && (
                    <Accordion type="multiple" className="w-full">
                        {sections.map((section, sectionIndex) => (
                            <AccordionItem key={sectionIndex} value={`section-${sectionIndex}`}>
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <span className="font-medium">{section.section_name || `Section ${sectionIndex + 1}`}</span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    duplicateSection(sectionIndex);
                                                }}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete this section and all its tasks.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteSection(sectionIndex)} className="bg-red-600 hover:bg-red-700">
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4 pt-4">
                                        <div>
                                            <Label>Section Name</Label>
                                            <Input
                                                value={section.section_name}
                                                onChange={(e) => updateSectionName(sectionIndex, e.target.value)}
                                                placeholder="e.g., Electrical System"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-base font-semibold">Tasks</Label>
                                            {section.tasks.map((task, taskIndex) => (
                                                <Card key={taskIndex} className="p-4">
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex-1">
                                                                <Label>Task Description</Label>
                                                                <Input
                                                                    value={task.description}
                                                                    onChange={(e) => updateTask(sectionIndex, taskIndex, 'description', e.target.value)}
                                                                    placeholder="e.g., Check motor connections"
                                                                />
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => deleteTask(sectionIndex, taskIndex)}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <Label>Category</Label>
                                                                <Select
                                                                    value={task.category}
                                                                    onValueChange={(value) => updateTask(sectionIndex, taskIndex, 'category', value)}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {TASK_CATEGORIES.map(cat => (
                                                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div>
                                                                <Label>Response Type</Label>
                                                                <Select
                                                                    value={task.task_type}
                                                                    onValueChange={(value) => updateTask(sectionIndex, taskIndex, 'task_type', value)}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="checkbox">Simple Checkbox</SelectItem>
                                                                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                                                        <SelectItem value="text">Text Input</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>

                                                        {task.task_type === 'multiple_choice' && (
                                                            <div>
                                                                <Label>Options</Label>
                                                                <div className="space-y-2 mt-2">
                                                                    {task.options.map((option, optionIndex) => (
                                                                        <div key={optionIndex} className="flex gap-2">
                                                                            <Input
                                                                                value={option}
                                                                                onChange={(e) => updateOption(sectionIndex, taskIndex, optionIndex, e.target.value)}
                                                                                placeholder="Option text"
                                                                            />
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => removeOption(sectionIndex, taskIndex, optionIndex)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => addOption(sectionIndex, taskIndex)}
                                                                    >
                                                                        <Plus className="h-4 w-4 mr-2" />Add Option
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="border-t pt-3">
                                                            <Label className="text-sm font-semibold">Auto-Add Part (Optional)</Label>
                                                            <div className="grid grid-cols-3 gap-3 mt-2">
                                                                <div>
                                                                    <Label className="text-xs">Linked Part</Label>
                                                                    <Select
                                                                        value={task.linked_part_id || ''}
                                                                        onValueChange={(value) => updateTask(sectionIndex, taskIndex, 'linked_part_id', value)}
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select part" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value={null}>None</SelectItem>
                                                                            {parts.map(p => (
                                                                                <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number})</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs">Quantity</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={task.linked_part_quantity}
                                                                        onChange={(e) => updateTask(sectionIndex, taskIndex, 'linked_part_quantity', parseInt(e.target.value) || 1)}
                                                                        min="1"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs">Trigger Response</Label>
                                                                    <Input
                                                                        value={task.trigger_response}
                                                                        onChange={(e) => updateTask(sectionIndex, taskIndex, 'trigger_response', e.target.value)}
                                                                        placeholder="e.g., Replaced"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                            <Button
                                                variant="outline"
                                                onClick={() => addTask(sectionIndex)}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />Add Task
                                            </Button>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}

                {selectedMachineType && sections.length > 0 && (
                    <div className="flex gap-2 justify-end pt-4 border-t">
                        {currentTemplate && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Delete Template</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete this template. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Template</>}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
