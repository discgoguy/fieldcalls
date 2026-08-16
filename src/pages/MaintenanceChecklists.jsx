import React, { useState, useEffect } from 'react';
import { Customer, Machine, MaintenanceChecklist, MaintenanceChecklistItem, MaintenanceTemplate, Part, Technician, Setting } from '@/api/entities';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { sortArray } from '@/components/utils/sortUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, AlertTriangle, CheckCircle, ClipboardList, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ChecklistForm from '../components/maintenance/ChecklistForm';
import ChecklistCard from '../components/maintenance/ChecklistCard';
import ChecklistDetail from '../components/maintenance/ChecklistDetail';
import { enrichChecklistItems } from '@/lib/checklistEnrichment';

export default function MaintenanceChecklistsPage() {
    const [checklists, setChecklists] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [parts, setParts] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedChecklist, setSelectedChecklist] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [checklistData, customerData, machineData, techData, partData, templateData, sortSettings] = await Promise.all([
                MaintenanceChecklist.list(),
                Customer.list(),
                Machine.list(),
                Technician.list(),
                Part.list(),
                MaintenanceTemplate.list(),
                Setting.filter({ key: 'default_sort_settings' })
            ]);
            
            // Apply sorting
            let sortedChecklists = checklistData || [];
            if (sortSettings && sortSettings.length > 0) {
                const settings = JSON.parse(sortSettings[0].value);
                const sortValue = settings.maintenanceChecklists || 'created_date_desc';
                sortedChecklists = sortArray(sortedChecklists, sortValue);
            } else {
                sortedChecklists = sortArray(sortedChecklists, 'created_date_desc');
            }
            
            setChecklists(sortedChecklists);
            setCustomers(customerData || []);
            setMachines(machineData || []);
            setTechnicians(techData?.filter(t => t.active !== false) || []);
            setParts(partData || []);
            setTemplates(templateData || []);
        } catch (e) {
            setError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateChecklist = async (checklistData) => {
        try {
            // Generate checklist number
            const lastChecklist = await MaintenanceChecklist.list('-created_date', 1);
            const lastNum = lastChecklist.length > 0 ? parseInt(lastChecklist[0].checklist_number.split('-')[1]) : 0;
            const newChecklistNumber = `MNT-${(lastNum + 1).toString().padStart(5, '0')}`;

            // Create the checklist
            const newChecklist = await MaintenanceChecklist.create({
                ...checklistData,
                checklist_number: newChecklistNumber,
                section_notes: {}
            });

            // Generate tasks from templates
            const selectedMachines = machines.filter(m => (checklistData.machine_ids || []).includes(m.id));
            const itemsToCreate = [];
            let orderIndex = 0;

            for (const machine of selectedMachines) {
                const template = templates.find(t => t.machine_type === machine.machine_type);
                if (template && template.sections) {
                    for (const section of template.sections) {
                        if (!section.tasks || section.tasks.length === 0) continue; // e.g. a leftover empty section after merging its tasks into a group
                        const instances = section.instances || [];
                        for (const task of section.tasks) {
                            if (instances.length > 0) {
                                // Grouped section: one item per instance (e.g. one row per spindle),
                                // all sharing the same task definition via template_id + task_key.
                                for (const instanceLabel of instances) {
                                    itemsToCreate.push({
                                        checklist_id: newChecklist.id,
                                        machine_id: machine.id,
                                        template_id: template.id,
                                        task_key: task.task_key,
                                        instance_label: instanceLabel,
                                        completed: false,
                                        response_value: '',
                                        sort_order: orderIndex++
                                    });
                                }
                            } else {
                                itemsToCreate.push({
                                    checklist_id: newChecklist.id,
                                    machine_id: machine.id,
                                    template_id: template.id,
                                    task_key: task.task_key,
                                    completed: false,
                                    response_value: '',
                                    sort_order: orderIndex++
                                });
                            }
                        }
                    }
                }
            }

            if (itemsToCreate.length > 0) {
                await MaintenanceChecklistItem.bulkCreate(itemsToCreate);
            }

            setSuccess('Checklist created successfully!');
            setIsFormOpen(false);
            await loadData();
            setTimeout(() => setSuccess(''), 4000);
        } catch (e) {
            return e.message || 'Failed to create checklist.';
        }
    };

    const handleChecklistClick = async (checklist) => {
        try {
            const items = await MaintenanceChecklistItem.filter({ checklist_id: checklist.id });
            const enrichedItems = enrichChecklistItems(items || [], templates);
            setSelectedChecklist({ ...checklist, items: enrichedItems });
            setIsDetailOpen(true);
        } catch (e) {
            setError('Failed to load checklist details.');
        }
    };

    const handleUpdate = async () => {
        await loadData();
        setIsDetailOpen(false);
        setSelectedChecklist(null);
        setSuccess('Checklist updated successfully!');
        setTimeout(() => setSuccess(''), 4000);
    };

    const activeChecklists = checklists.filter(c => c.status === 'Scheduled' || c.status === 'In Progress');
    const completedChecklists = checklists.filter(c => c.status === 'Completed');

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold flex items-center">
                    <ClipboardList className="mr-3 h-8 w-8" />
                    Maintenance Checklists
                </h1>
                <div className="flex gap-2">
                    <Link to={createPageUrl('MaintenanceTemplates')}>
                        <Button variant="outline">
                            <Settings className="mr-2 h-4 w-4" />
                            Templates
                        </Button>
                    </Link>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" />New Checklist</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create Maintenance Checklist</DialogTitle>
                            </DialogHeader>
                            <ChecklistForm
                                customers={customers.filter(c => !c.inactive).sort((a, b) => a.company_name.localeCompare(b.company_name))}
                                machines={machines}
                                technicians={technicians.sort((a, b) => a.full_name.localeCompare(b.full_name))}
                                onSubmit={handleCreateChecklist}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

            <Tabs defaultValue="active" className="w-full">
                <TabsList>
                    <TabsTrigger value="active">Active ({activeChecklists.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedChecklists.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeChecklists.map(checklist => (
                            <ChecklistCard
                                key={checklist.id}
                                checklist={checklist}
                                customer={customers.find(c => c.id === checklist.customer_id)}
                                machines={machines.filter(m => (checklist.machine_ids || []).includes(m.id))}
                                technicians={technicians.filter(t => (checklist.technician_ids || []).includes(t.id))}
                                onClick={() => handleChecklistClick(checklist)}
                            />
                        ))}
                        {activeChecklists.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <p>No active checklists. Create one to get started!</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="completed" className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {completedChecklists.map(checklist => (
                            <ChecklistCard
                                key={checklist.id}
                                checklist={checklist}
                                customer={customers.find(c => c.id === checklist.customer_id)}
                                machines={machines.filter(m => (checklist.machine_ids || []).includes(m.id))}
                                technicians={technicians.filter(t => (checklist.technician_ids || []).includes(t.id))}
                                onClick={() => handleChecklistClick(checklist)}
                            />
                        ))}
                        {completedChecklists.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <p>No completed checklists yet.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {selectedChecklist && (
                <ChecklistDetail
                    checklist={selectedChecklist}
                    customer={customers.find(c => c.id === selectedChecklist.customer_id)}
                    machines={machines.filter(m => (selectedChecklist.machine_ids || []).includes(m.id))}
                    technicians={technicians.filter(t => (selectedChecklist.technician_ids || []).includes(t.id))}
                    parts={parts}
                    isOpen={isDetailOpen}
                    onOpenChange={setIsDetailOpen}
                    onUpdate={handleUpdate}
                />
            )}
        </div>
    );
}