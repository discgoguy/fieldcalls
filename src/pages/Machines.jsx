import React, { useState, useEffect } from "react";
import { Customer, Machine, MachineType } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Monitor, Loader2, AlertTriangle, Search, CheckCircle, Pencil, Filter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { applySortSettings, sortArray } from '@/components/utils/sortUtils';

export default function MachinesPage() {
    const [machines, setMachines] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [machineTypes, setMachineTypes] = useState([]);
    const [filteredMachines, setFilteredMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [customerFilter, setCustomerFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingMachine, setEditingMachine] = useState(null);
    const [newMachine, setNewMachine] = useState({
        serial_number: "",
        model: "",
        machine_type: "",
        customer_id: "",
        installation_date: "",
        warranty_expiration: "",
        notes: ""
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [machineData, customerData, typeData, sortSettings] = await Promise.all([
                Machine.list(),
                Customer.list(),
                MachineType.list(),
                applySortSettings()
            ]);
            setCustomers(customerData || []);
            setMachineTypes(typeData || []);
            
            // Enrich machines with customer_name for sorting
            const enrichedMachines = (machineData || []).map(m => ({
                ...m,
                customer_name: customerData?.find(c => c.id === m.customer_id)?.company_name || ''
            }));
            
            const sortedData = sortArray(enrichedMachines, sortSettings.machines);
            setMachines(sortedData);
            setFilteredMachines(sortedData);
        } catch (e) {
            setError("Failed to load data.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const results = machines.filter(machine => {
            const searchLower = searchTerm.toLowerCase();
            const searchMatch = !searchTerm ||
                machine.serial_number.toLowerCase().includes(searchLower) ||
                machine.model.toLowerCase().includes(searchLower) ||
                (machine.machine_type && machine.machine_type.toLowerCase().includes(searchLower)) ||
                (getCustomerName(machine.customer_id) && getCustomerName(machine.customer_id).toLowerCase().includes(searchLower));
            const customerMatch = customerFilter === 'all' || machine.customer_id === customerFilter;
            const typeMatch = typeFilter === 'all' || machine.machine_type === typeFilter;
            return searchMatch && customerMatch && typeMatch;
        });
        setFilteredMachines(results);
    }, [searchTerm, customerFilter, typeFilter, machines]);

    const getCustomerName = (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.company_name : "Unknown";
    };

    const handleEditMachine = (machine) => {
        setEditingMachine(machine);
        setNewMachine({
            serial_number: machine.serial_number || "",
            model: machine.model || "",
            machine_type: machine.machine_type || "",
            customer_id: machine.customer_id || "",
            installation_date: machine.installation_date || "",
            warranty_expiration: machine.warranty_expiration || "",
            notes: machine.notes || ""
        });
        setIsDialogOpen(true);
        setError("");
    };

    const handleDialogClose = (open) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingMachine(null);
            setNewMachine({
                serial_number: "",
                model: "",
                machine_type: "",
                customer_id: "",
                installation_date: "",
                warranty_expiration: "",
                notes: ""
            });
            setError("");
        }
    };

    const handleExportMachines = () => {
        const headers = [
            "serial_number", "model", "machine_type", "customer_name", "customer_identifier",
            "installation_date", "warranty_expiration", "notes"
        ];
        
        const escapeCsv = (value) => {
            if (value === null || value === undefined) return '';
            let stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        const csvRows = [headers.map(h => escapeCsv(h)).join(",")];
        
        filteredMachines.forEach(machine => {
            const customer = customers.find(c => c.id === machine.customer_id);
            const row = [
                escapeCsv(machine.serial_number),
                escapeCsv(machine.model),
                escapeCsv(machine.machine_type),
                escapeCsv(customer?.company_name || ''),
                escapeCsv(customer?.customer_identifier || ''),
                escapeCsv(machine.installation_date),
                escapeCsv(machine.warranty_expiration),
                escapeCsv(machine.notes)
            ];
            csvRows.push(row.join(","));
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'machines_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleSaveMachine = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");
        try {
            if (!newMachine.serial_number || !newMachine.model || !newMachine.machine_type || !newMachine.customer_id) {
                throw new Error("Serial Number, Model, Machine Type, and Customer are required.");
            }
            if (editingMachine) {
                await Machine.update(editingMachine.id, newMachine);
                setSuccessMessage("Machine successfully updated!");
            } else {
                await Machine.create(newMachine);
                setSuccessMessage("Machine successfully created!");
            }
            
            handleDialogClose(false);
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save machine. Serial number might already exist.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isWarrantyExpired = (expirationDate) => {
        if (!expirationDate) return false;
        return new Date(expirationDate) < new Date();
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Monitor className="mr-2" />Machines</CardTitle>
                        <CardDescription>Manage machines and equipment for your customers.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                            <DialogTrigger asChild>
                                <Button><Plus className="mr-2 h-4 w-4" />Add Machine</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>{editingMachine ? "Edit Machine" : "Add a New Machine"}</DialogTitle>
                                </DialogHeader>
                                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                                <form onSubmit={handleSaveMachine} className="space-y-4 pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="serial_number">Serial Number *</Label>
                                            <Input id="serial_number" value={newMachine.serial_number} onChange={(e) => setNewMachine({...newMachine, serial_number: e.target.value})} required />
                                        </div>
                                        <div>
                                            <Label htmlFor="model">Model *</Label>
                                            <Input id="model" value={newMachine.model} onChange={(e) => setNewMachine({...newMachine, model: e.target.value})} required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="machine_type">Machine Type *</Label>
                                            <Select value={newMachine.machine_type} onValueChange={(value) => setNewMachine({...newMachine, machine_type: value})}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map(type => (
                                                        <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="customer_id">Customer *</Label>
                                            <Select value={newMachine.customer_id} onValueChange={(value) => setNewMachine({...newMachine, customer_id: value})}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select customer" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {customers.filter(c => !c.inactive).sort((a, b) => a.company_name.localeCompare(b.company_name)).map(customer => (
                                                        <SelectItem key={customer.id} value={customer.id}>{customer.company_name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="installation_date">Installation Date</Label>
                                            <Input id="installation_date" type="date" value={newMachine.installation_date} onChange={(e) => setNewMachine({...newMachine, installation_date: e.target.value})} />
                                        </div>
                                        <div>
                                            <Label htmlFor="warranty_expiration">Warranty Expiration</Label>
                                            <Input id="warranty_expiration" type="date" value={newMachine.warranty_expiration} onChange={(e) => setNewMachine({...newMachine, warranty_expiration: e.target.value})} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="notes">Notes</Label>
                                        <Textarea id="notes" value={newMachine.notes} onChange={(e) => setNewMachine({...newMachine, notes: e.target.value})} />
                                    </div>
                                    <Button type="submit" disabled={isSubmitting} className="w-full">
                                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingMachine ? "Update Machine" : "Save Machine")}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by serial number, model, type, or customer..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={customerFilter} onValueChange={setCustomerFilter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="All Customers" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Customers</SelectItem>
                                {customers.filter(c => !c.inactive).sort((a, b) => a.company_name.localeCompare(b.company_name)).map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {successMessage && <Alert className="mb-4 bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : error && !isDialogOpen ? (
                    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Serial Number</TableHead>
                                    <TableHead>Model</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Installation Date</TableHead>
                                    <TableHead>Warranty Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMachines.length > 0 ? filteredMachines.map(m => (
                                    <TableRow key={m.id}>
                                        <TableCell className="font-medium">{m.serial_number}</TableCell>
                                        <TableCell>{m.model}</TableCell>
                                        <TableCell>{m.machine_type}</TableCell>
                                        <TableCell>{getCustomerName(m.customer_id)}</TableCell>
                                        <TableCell>{m.installation_date ? format(new Date(m.installation_date), 'MMM d, yyyy') : 'N/A'}</TableCell>
                                        <TableCell>
                                            {m.warranty_expiration ? (
                                                <Badge variant={isWarrantyExpired(m.warranty_expiration) ? "destructive" : "default"}>
                                                    {isWarrantyExpired(m.warranty_expiration) ? 'Expired' : 'Active'}
                                                </Badge>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => handleEditMachine(m)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan="7" className="text-center">No machines found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}