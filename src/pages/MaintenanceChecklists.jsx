
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, AlertTriangle, CheckCircle, ClipboardList, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ChecklistForm from '../components/maintenance/ChecklistForm';
import ChecklistCard from '../components/maintenance/ChecklistCard';
import ChecklistDetail from '../components/maintenance/ChecklistDetail';
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

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
            const filter = await withTenantFilter();
            const [checklistData, customerData, machineData, techData, partData, templateData] = await Promise.all([
                base44.entities.MaintenanceChecklist.filter(filter, '-created_date'),
                base44.entities.Customer.filter(filter),
                base44.entities.Machine.filter(filter),
                base44.entities.Technician.filter(filter),
                base44.entities.Part.filter(filter),
                base44.entities.MaintenanceTemplate.filter(filter)
            ]);
            setChecklists(checklistData || []);
            setCustomers(customerData || []);
            setMachines(machineData || []);
            setTechnicians(techData?.filter(t => t.active !== false) || []);
            setParts(partData || []);
            setTemplates(templateData || []);
        } catch (e) {
            setError('Failed to load data.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateChecklist = async (checklistData) => {
        try {
            // Generate checklist number
            const tenantFilter = await withTenantFilter();
            const lastChecklist = await base44.entities.MaintenanceChecklist.filter(tenantFilter, '-created_date', 1);
            const lastNum = lastChecklist.length > 0 ? parseInt(lastChecklist[0].checklist_number.split('-')[1]) : 0;
            const newChecklistNumber = `MNT-${(lastNum + 1).toString().padStart(5, '0')}`;

            // Create the checklist
            const newChecklist = await base44.entities.MaintenanceChecklist.create(
                await addTenantId({
                    ...checklistData,
                    checklist_number: newChecklistNumber,
                    section_notes: {}
                })
            );

            // Generate tasks from templates
            const selectedMachines = machines.filter(m => checklistData.machine_ids.includes(m.id));
            const itemsToCreate = [];
            const tenantId = tenantFilter.tenant_id;

            for (const machine of selectedMachines) {
                const template = templates.find(t => t.machine_type === machine.machine_type);
                if (template && template.sections) {
                    for (const section of template.sections) {
                        for (const task of section.tasks) {
                            itemsToCreate.push(
                                await addTenantId({
                                    checklist_id: newChecklist.id,
                                    machine_id: machine.id,
                                    section_name: section.section_name,
                                    task_description: task.description,
                                    category: task.category,
                                    task_type: task.task_type,
                                    options: task.options || [],
                                    completed: false,
                                    response_value: '',
                                    linked_part_id: task.linked_part_id || '',
                                    linked_part_quantity: task.linked_part_quantity || 1,
                                    trigger_response: task.trigger_response || ''
                                })
                            );
                        }
                    }
                }
            }

            if (itemsToCreate.length > 0) {
                await base44.entities.MaintenanceChecklistItem.bulkCreate(itemsToCreate);
            }

            setSuccess('Checklist created successfully!');
            setIsFormOpen(false);
            await loadData();
            setTimeout(() => setSuccess(''), 4000);
        } catch (e) {
            console.error("Failed to create checklist:", e);
            return e.message || 'Failed to create checklist.';
        }
    };

    const handleChecklistClick = async (checklist) => {
        try {
            const filter = await withTenantFilter();
            const items = await base44.entities.MaintenanceChecklistItem.filter({ ...filter, checklist_id: checklist.id });
            setSelectedChecklist({ ...checklist, items: items || [] });
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
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Create Maintenance Checklist</DialogTitle>
                            </DialogHeader>
                            <ChecklistForm
                                customers={customers}
                                machines={machines}
                                technicians={technicians}
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
                                machines={machines.filter(m => checklist.machine_ids.includes(m.id))}
                                technicians={technicians.filter(t => checklist.technician_ids.includes(t.id))}
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
                                machines={machines.filter(m => checklist.machine_ids.includes(m.id))}
                                technicians={technicians.filter(t => checklist.technician_ids.includes(t.id))}
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
                    machines={machines.filter(m => selectedChecklist.machine_ids.includes(m.id))}
                    technicians={technicians.filter(t => selectedChecklist.technician_ids.includes(t.id))}
                    parts={parts}
                    isOpen={isDetailOpen}
                    onOpenChange={setIsDetailOpen}
                    onUpdate={handleUpdate}
                />
            )}
        </div>
    );
}
