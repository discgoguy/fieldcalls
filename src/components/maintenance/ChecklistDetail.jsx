
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Printer, Save, Loader2, Wrench, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ChecklistPrintLayout from './ChecklistPrintLayout';
import ConvertToServiceModal from './ConvertToServiceModal';
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

const STATUS_COLORS = {
    'Scheduled': 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-yellow-100 text-yellow-800',
    'Completed': 'bg-green-100 text-green-800'
};

export default function ChecklistDetail({ checklist, customer, machines, technicians, parts, isOpen, onOpenChange, onUpdate }) {
    const [items, setItems] = useState([]);
    const [sectionNotes, setSectionNotes] = useState({});
    const [status, setStatus] = useState(checklist.status);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showConvertModal, setShowConvertModal] = useState(false);

    useEffect(() => {
        if (checklist) {
            setItems(checklist.items || []);
            setSectionNotes(checklist.section_notes || {});
            setStatus(checklist.status);
        }
    }, [checklist]);

    const handleTaskResponse = (itemId, responseValue, completed) => {
        setItems(prevItems => prevItems.map(item =>
            item.id === itemId ? { ...item, response_value: responseValue, completed } : item
        ));
    };

    const handleSectionNoteChange = (machineId, sectionName, note) => {
        setSectionNotes(prev => ({
            ...prev,
            [machineId]: {
                ...(prev[machineId] || {}),
                [sectionName]: note
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        try {
            await base44.entities.MaintenanceChecklist.update(checklist.id, {
                status,
                section_notes: sectionNotes
            });

            for (const item of items) {
                await base44.entities.MaintenanceChecklistItem.update(item.id, {
                    completed: item.completed,
                    response_value: item.response_value
                });
            }

            onUpdate();
        } catch (e) {
            setError('Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            for (const item of items) {
                await base44.entities.MaintenanceChecklistItem.delete(item.id);
            }
            await base44.entities.MaintenanceChecklist.delete(checklist.id);
            onUpdate();
        } catch (e) {
            setError('Failed to delete checklist.');
        }
    };

    const calculateProgress = () => {
        if (items.length === 0) return 0;
        const completedCount = items.filter(item => item.completed).length;
        return Math.round((completedCount / items.length) * 100);
    };

    const groupedItems = machines.reduce((acc, machine) => {
        acc[machine.id] = {
            machine: machine,
            sections: {}
        };

        const machineItems = items.filter(item => item.machine_id === machine.id);
        machineItems.forEach(item => {
            if (!acc[machine.id].sections[item.section_name]) {
                acc[machine.id].sections[item.section_name] = [];
            }
            acc[machine.id].sections[item.section_name].push(item);
        });

        return acc;
    }, {});

    const handlePrint = () => {
        // Open a new window for printing
        const printWindow = window.open('', '_blank');
        const printContent = document.getElementById('print-content-container');
        
        if (printWindow && printContent) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Maintenance Checklist - ${checklist.checklist_number}</title>
                        <style>
                            @page { 
                                margin: 0.5in; 
                                size: letter;
                            }
                            body { 
                                font-family: Arial, Helvetica, sans-serif;
                                font-size: 12px;
                                line-height: 1.4;
                                color: #000;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                            .page-break { 
                                page-break-after: always; 
                                break-after: always;
                            }
                            .avoid-break {
                                page-break-inside: avoid;
                                break-inside: avoid;
                            }
                            * {
                                box-sizing: border-box;
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
            
            // Small delay to ensure content is loaded before printing
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    return (
        <>
            
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="text-2xl">{checklist.checklist_number}</DialogTitle>
                                <p className="text-gray-600">{customer?.company_name}</p>
                            </div>
                            <Badge className={STATUS_COLORS[status]}>{status}</Badge>
                        </div>
                    </DialogHeader>

                    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="Completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label>Progress</Label>
                                <div className="flex items-center gap-2 mt-2">
                                    <Progress value={calculateProgress()} className="flex-1" />
                                    <span className="text-sm font-medium">{calculateProgress()}%</span>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {Object.entries(groupedItems).map(([machineId, data]) => (
                            <div key={machineId} className="space-y-4">
                                <h3 className="text-lg font-semibold">
                                    {data.machine.model} (S/N: {data.machine.serial_number})
                                </h3>

                                {Object.entries(data.sections).map(([sectionName, sectionItems]) => (
                                    <div key={sectionName} className="border rounded-lg p-4 space-y-3">
                                        <h4 className="font-medium text-blue-700">{sectionName}</h4>

                                        <div className="space-y-3">
                                            {sectionItems.map(item => (
                                                <div key={item.id} className="flex items-start gap-3 p-2 bg-gray-50 rounded">
                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <p className="font-medium text-sm">{item.task_description}</p>
                                                                <p className="text-xs text-gray-500">{item.category}</p>
                                                            </div>
                                                        </div>

                                                        {item.task_type === 'checkbox' && (
                                                            <div className="mt-2">
                                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                                    <Checkbox
                                                                        checked={item.completed}
                                                                        onCheckedChange={(checked) => {
                                                                            handleTaskResponse(item.id, checked ? item.category : '', checked);
                                                                        }}
                                                                    />
                                                                    <span className="text-sm">{item.category}</span>
                                                                </label>
                                                            </div>
                                                        )}

                                                        {item.task_type === 'multiple_choice' && (
                                                            <div className="mt-2 flex flex-wrap gap-3">
                                                                {(item.options || []).map(option => (
                                                                    <label key={option} className="flex items-center space-x-2 cursor-pointer">
                                                                        <Checkbox
                                                                            checked={item.response_value === option}
                                                                            onCheckedChange={(checked) => {
                                                                                handleTaskResponse(item.id, checked ? option : '', checked);
                                                                            }}
                                                                        />
                                                                        <span className="text-sm">{option}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {item.task_type === 'text' && (
                                                            <div className="mt-2">
                                                                <Input
                                                                    value={item.response_value || ''}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        handleTaskResponse(item.id, value, value.trim() !== '');
                                                                    }}
                                                                    placeholder="Enter response..."
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div>
                                            <Label className="text-xs">Section Notes</Label>
                                            <Textarea
                                                value={sectionNotes[machineId]?.[sectionName] || ''}
                                                onChange={(e) => handleSectionNoteChange(machineId, sectionName, e.target.value)}
                                                placeholder="Add notes for this section..."
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}

                        <div className="flex justify-between pt-4 border-t">
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4" />Print
                                </Button>
                                {status === 'Completed' && (
                                    <Button variant="outline" onClick={() => setShowConvertModal(true)}>
                                        <Wrench className="mr-2 h-4 w-4" />Convert to Service
                                    </Button>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Checklist?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete this maintenance checklist and all its tasks. This action cannot be undone.
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
                            </div>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Hidden print content */}
            <div id="print-content-container" style={{ display: 'none' }}>
                <ChecklistPrintLayout
                    checklist={checklist}
                    customer={customer}
                    machines={machines}
                    technicians={technicians}
                    groupedItems={groupedItems}
                    items={items}
                    sectionNotes={sectionNotes}
                />
            </div>

            {showConvertModal && (
                <ConvertToServiceModal
                    checklist={checklist}
                    customer={customer}
                    machines={machines}
                    technicians={technicians}
                    items={items}
                    parts={parts}
                    isOpen={showConvertModal}
                    onOpenChange={setShowConvertModal}
                />
            )}
        </>
    );
}
