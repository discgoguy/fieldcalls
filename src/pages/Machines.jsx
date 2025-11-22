
import React, { useState, useEffect, useRef } from "react";
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Cog, Loader2, AlertTriangle, Search, CheckCircle, Pencil, Trash2, Upload, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import { addTenantId, withTenantFilter, addTenantIdBulk } from '@/components/utils/tenant';

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
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingMachine, setEditingMachine] = useState(null);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);
    
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
            const filter = await withTenantFilter();
            const [machineData, customerData, machineTypeData] = await Promise.all([
                base44.entities.Machine.filter(filter),
                base44.entities.Customer.filter(filter),
                base44.entities.MachineType.filter(filter)
            ]);
            setMachines(machineData || []);
            setFilteredMachines(machineData || []);
            setCustomers(customerData || []);
            setMachineTypes(machineTypeData || []);
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
            const searchMatch = 
                machine.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                machine.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (machine.machine_type && machine.machine_type.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const customerMatch = customerFilter === 'all' || machine.customer_id === customerFilter;
            
            return searchMatch && customerMatch;
        });
        setFilteredMachines(results);
    }, [searchTerm, customerFilter, machines]);

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

    const handleDownloadTemplate = () => {
        const csvTemplate = 'serial_number,model,machine_type,customer_identifier,installation_date,warranty_expiration,notes\n"SN-12345","Model X","Forklift - Electric","CUST001","2024-01-15","2025-01-15","Sample machine notes"';
        const blob = new Blob([csvTemplate], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'machines_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleImportCSV = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);
        setError("");
        setSuccessMessage("");

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                
                if (lines.length <= 1) {
                    throw new Error('CSV file is empty or only contains headers.');
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const records = [];

                // Build customer identifier map for lookup
                const customerIdMap = {};
                customers.forEach(customer => {
                    if (customer.customer_identifier) { // Assuming customer objects have a customer_identifier
                        customerIdMap[customer.customer_identifier] = customer.id;
                    }
                });

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                    const record = {};
                    
                    headers.forEach((header, index) => {
                        record[header] = values[index] || '';
                    });

                    // Convert customer_identifier to customer_id
                    if (record.customer_identifier) {
                        const customerId = customerIdMap[record.customer_identifier];
                        if (!customerId) {
                            throw new Error(`Row ${i + 1}: Customer identifier "${record.customer_identifier}" not found. Please make sure customers are imported first.`);
                        }
                        record.customer_id = customerId;
                        delete record.customer_identifier;
                    } else {
                        // If customer_identifier is missing, but customer_id is expected, throw error
                        if (headers.includes('customer_identifier') && !record.customer_id) {
                            throw new Error(`Row ${i + 1}: Missing 'customer_identifier'.`);
                        }
                    }

                    // Validate required fields
                    if (!record.serial_number || !record.model || !record.machine_type || !record.customer_id) {
                        throw new Error(`Row ${i + 1}: Missing required fields (serial_number, model, machine_type, customer_identifier).`);
                    }
                    
                    records.push(record);
                }

                if (records.length === 0) {
                    throw new Error('No valid records found in CSV file.');
                }

                // Add tenant_id to all records
                const recordsWithTenant = await addTenantIdBulk(records);
                await base44.entities.Machine.bulkCreate(recordsWithTenant);
                
                setSuccessMessage(`Successfully imported ${records.length} machines!`);
                await loadData();
                setTimeout(() => setSuccessMessage(""), 5000);

            } catch (err) {
                setError(err.message || 'Failed to import CSV file.');
                console.error('Import error:', err);
            } finally {
                setImporting(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        
        reader.onerror = () => {
            setError('Failed to read file.');
            setImporting(false);
        };
        
        reader.readAsText(file);
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
                await base44.entities.Machine.update(editingMachine.id, newMachine);
                setSuccessMessage("Machine successfully updated!");
            } else {
                const machineWithTenant = await addTenantId(newMachine);
                await base44.entities.Machine.create(machineWithTenant);
                setSuccessMessage("Machine successfully created!");
            }
            
            handleDialogClose(false);
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save machine.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteMachine = async (machineId) => {
        try {
            await base44.entities.Machine.delete(machineId);
            setSuccessMessage("Machine deleted.");
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError("Failed to delete machine. It might be referenced in other records.");
        }
    };

    const getCustomerName = (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.company_name : 'Unknown';
    };

    const getWarrantyStatus = (warrantyDate) => {
        if (!warrantyDate) return null;
        const today = new Date();
        const expiration = new Date(warrantyDate);
        const isExpired = today > expiration;
        return isExpired ? 
            <Badge variant="destructive">Expired</Badge> : 
            <Badge className="bg-green-100 text-green-800">Active</Badge>;
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Cog className="mr-2" />Machines</CardTitle>
                        <CardDescription>Manage customer machines and equipment.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleDownloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />CSV Template
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleImportCSV}
                            className="hidden"
                            id="csv-upload-machines"
                        />
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing}
                        >
                            {importing ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</>
                            ) : (
                                <><Upload className="mr-2 h-4 w-4" />Import CSV</>
                            )}
                        </Button>
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
                                            <Input 
                                                id="serial_number" 
                                                value={newMachine.serial_number} 
                                                onChange={(e) => setNewMachine({...newMachine, serial_number: e.target.value})} 
                                                required 
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="model">Model *</Label>
                                            <Input 
                                                id="model" 
                                                value={newMachine.model} 
                                                onChange={(e) => setNewMachine({...newMachine, model: e.target.value})} 
                                                required 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="machine_type">Machine Type *</Label>
                                            <Select 
                                                value={newMachine.machine_type} 
                                                onValueChange={(value) => setNewMachine({...newMachine, machine_type: value})}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select machine type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {machineTypes.map(type => (
                                                        <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                                    ))}
                                                    {machineTypes.length === 0 && (
                                                        <SelectItem value="no-types" disabled>No machine types available</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="customer_id">Customer *</Label>
                                            <Select 
                                                value={newMachine.customer_id} 
                                                onValueChange={(value) => setNewMachine({...newMachine, customer_id: value})}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select customer" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {customers.map(customer => (
                                                        <SelectItem key={customer.id} value={customer.id}>{customer.company_name}</SelectItem>
                                                    ))}
                                                    {customers.length === 0 && (
                                                        <SelectItem value="no-customers" disabled>No customers available</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="installation_date">Installation Date</Label>
                                            <Input 
                                                id="installation_date" 
                                                type="date"
                                                value={newMachine.installation_date} 
                                                onChange={(e) => setNewMachine({...newMachine, installation_date: e.target.value})} 
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="warranty_expiration">Warranty Expiration</Label>
                                            <Input 
                                                id="warranty_expiration" 
                                                type="date"
                                                value={newMachine.warranty_expiration} 
                                                onChange={(e) => setNewMachine({...newMachine, warranty_expiration: e.target.value})} 
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="notes">Notes</Label>
                                        <Textarea 
                                            id="notes" 
                                            value={newMachine.notes} 
                                            onChange={(e) => setNewMachine({...newMachine, notes: e.target.value})} 
                                            rows={3}
                                        />
                                    </div>

                                    <Button type="submit" disabled={isSubmitting} className="w-full">
                                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingMachine ? "Update Machine" : "Save Machine")}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search by serial number, model, or type..." 
                            className="pl-10" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <div>
                        <Select value={customerFilter} onValueChange={setCustomerFilter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filter by customer" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Customers</SelectItem>
                                {customers.map(customer => (
                                    <SelectItem key={customer.id} value={customer.id}>{customer.company_name}</SelectItem>
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Serial Number</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Installation Date</TableHead>
                                <TableHead>Warranty</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMachines.length > 0 ? filteredMachines.map(machine => (
                                <TableRow key={machine.id}>
                                    <TableCell className="font-medium">{machine.serial_number}</TableCell>
                                    <TableCell>{machine.model}</TableCell>
                                    <TableCell><Badge variant="outline">{machine.machine_type}</Badge></TableCell>
                                    <TableCell>{getCustomerName(machine.customer_id)}</TableCell>
                                    <TableCell>{machine.installation_date || 'N/A'}</TableCell>
                                    <TableCell>
                                        {machine.warranty_expiration ? (
                                            <div className="flex items-center gap-2">
                                                {getWarrantyStatus(machine.warranty_expiration)}
                                                <span className="text-xs text-gray-500">{machine.warranty_expiration}</span>
                                            </div>
                                        ) : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditMachine(machine)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will permanently delete the machine "{machine.serial_number}". This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction 
                                                            onClick={() => handleDeleteMachine(machine.id)} 
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan="7" className="text-center">No machines found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
