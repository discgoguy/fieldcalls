import React, { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Cog, Loader2, AlertTriangle, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

export default function MachineTypesPage() {
    const [machineTypes, setMachineTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingMachineType, setEditingMachineType] = useState(null);
    const [newMachineType, setNewMachineType] = useState({ name: "", description: "" });

    const loadMachineTypes = async () => {
        setLoading(true);
        try {
            const filter = await withTenantFilter();
            const data = await base44.entities.MachineType.filter(filter);
            setMachineTypes(data || []);
        } catch (e) {
            setError("Failed to load machine types.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMachineTypes();
    }, []);

    const handleOpenForm = (machineType = null) => {
        setError("");
        if (machineType) {
            setEditingMachineType(machineType);
            setNewMachineType({ name: machineType.name, description: machineType.description || "" });
        } else {
            setEditingMachineType(null);
            setNewMachineType({ name: "", description: "" });
        }
        setIsFormOpen(true);
    };

    const handleSaveMachineType = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");
        try {
            if (!newMachineType.name) {
                throw new Error("Machine type name is required.");
            }
            if (editingMachineType) {
                await base44.entities.MachineType.update(editingMachineType.id, newMachineType);
                setSuccessMessage("Machine type successfully updated!");
            } else {
                const machineTypeWithTenant = await addTenantId(newMachineType);
                await base44.entities.MachineType.create(machineTypeWithTenant);
                setSuccessMessage("Machine type successfully created!");
            }
            setIsFormOpen(false);
            await loadMachineTypes();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save machine type. Name might already exist.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteMachineType = async (machineTypeId) => {
        try {
            await base44.entities.MachineType.delete(machineTypeId);
            setSuccessMessage("Machine type deleted.");
            await loadMachineTypes();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError("Failed to delete machine type. It might be in use by some machines or parts.");
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Cog className="mr-2" />Machine Types</CardTitle>
                        <CardDescription>Add, edit, or remove types of machines in your inventory.</CardDescription>
                    </div>
                     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => handleOpenForm()}><Plus className="mr-2 h-4 w-4" />Add Machine Type</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingMachineType ? 'Edit Machine Type' : 'Add a New Machine Type'}</DialogTitle>
                            </DialogHeader>
                            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                            <form onSubmit={handleSaveMachineType} className="space-y-4 pt-4">
                                <div>
                                    <Label htmlFor="machine_type_name">Machine Type Name *</Label>
                                    <Input id="machine_type_name" value={newMachineType.name} onChange={(e) => setNewMachineType({...newMachineType, name: e.target.value})} required />
                                </div>
                                <div>
                                    <Label htmlFor="machine_type_description">Description</Label>
                                    <Textarea id="machine_type_description" placeholder="Optional description..." value={newMachineType.description} onChange={(e) => setNewMachineType({...newMachineType, description: e.target.value})} />
                                </div>
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Machine Type"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {successMessage && <Alert className="mb-4 bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : error && !isFormOpen ? (
                    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Machine Type Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {machineTypes.length > 0 ? machineTypes.map(mt => (
                                <TableRow key={mt.id}>
                                    <TableCell className="font-medium">{mt.name}</TableCell>
                                    <TableCell>{mt.description || 'N/A'}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(mt)}><Pencil className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the machine type "{mt.name}". This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteMachineType(mt.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan="3" className="text-center">No machine types found. Add one to get started!</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}