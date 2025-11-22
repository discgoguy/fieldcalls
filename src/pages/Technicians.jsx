
import React, { useState, useEffect } from "react";
import { Technician } from "@/entities/Technician";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Wrench, Loader2, AlertTriangle, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export default function TechniciansPage() {
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingTechnician, setEditingTechnician] = useState(null);
    const [newTechnician, setNewTechnician] = useState({
        full_name: "",
        technician_code: "",
        specialties: [],
        active: true,
        notes: ""
    });
    const [specialtyInput, setSpecialtyInput] = useState("");

    const loadTechnicians = async () => {
        setLoading(true);
        try {
            const filter = await withTenantFilter();
            const techData = await Technician.filter(filter); // Using imported Technician entity
            setTechnicians(techData || []);
        } catch (e) {
            setError("Failed to load technicians.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTechnicians();
    }, []);

    const handleOpenForm = (technician = null) => {
        setError("");
        if (technician) {
            setEditingTechnician(technician);
            setNewTechnician({
                full_name: technician.full_name,
                technician_code: technician.technician_code,
                specialties: technician.specialties || [],
                active: technician.active !== false,
                notes: technician.notes || ""
            });
        } else {
            setEditingTechnician(null);
            setNewTechnician({
                full_name: "",
                technician_code: "",
                specialties: [],
                active: true,
                notes: ""
            });
        }
        setSpecialtyInput("");
        setIsFormOpen(true);
    };

    const handleAddSpecialty = () => {
        if (specialtyInput.trim() && !newTechnician.specialties.includes(specialtyInput.trim())) {
            setNewTechnician(prev => ({
                ...prev,
                specialties: [...prev.specialties, specialtyInput.trim()]
            }));
            setSpecialtyInput("");
        }
    };

    const handleRemoveSpecialty = (specialty) => {
        setNewTechnician(prev => ({
            ...prev,
            specialties: prev.specialties.filter(s => s !== specialty)
        }));
    };

    const handleSaveTechnician = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");
        
        try {
            if (!newTechnician.full_name || !newTechnician.technician_code) {
                throw new Error("Full name and technician code are required.");
            }

            if (editingTechnician) {
                await Technician.update(editingTechnician.id, newTechnician); // Using imported Technician entity
                setSuccessMessage("Technician successfully updated!");
            } else {
                const technicianWithTenant = await addTenantId(newTechnician);
                await Technician.create(technicianWithTenant); // Using imported Technician entity
                setSuccessMessage("Technician successfully created!");
            }
            
            setIsFormOpen(false);
            await loadTechnicians();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save technician.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTechnician = async (technicianId) => {
        try {
            await Technician.delete(technicianId);
            setSuccessMessage("Technician deleted.");
            await loadTechnicians();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError("Failed to delete technician.");
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Wrench className="mr-2" />Technicians</CardTitle>
                        <CardDescription>Manage your service technicians and their specialties.</CardDescription>
                    </div>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => handleOpenForm()}><Plus className="mr-2 h-4 w-4" />Add Technician</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>{editingTechnician ? 'Edit Technician' : 'Add New Technician'}</DialogTitle>
                            </DialogHeader>
                            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                            <form onSubmit={handleSaveTechnician} className="space-y-4 pt-4">
                                <div>
                                    <Label htmlFor="full_name">Full Name *</Label>
                                    <Input id="full_name" value={newTechnician.full_name} onChange={(e) => setNewTechnician({...newTechnician, full_name: e.target.value})} required />
                                </div>
                                <div>
                                    <Label htmlFor="technician_code">Technician Code *</Label>
                                    <Input id="technician_code" value={newTechnician.technician_code} onChange={(e) => setNewTechnician({...newTechnician, technician_code: e.target.value})} required />
                                </div>
                                <div>
                                    <Label>Specialties</Label>
                                    <div className="flex gap-2 mb-2">
                                        <Input 
                                            placeholder="Add a specialty..." 
                                            value={specialtyInput} 
                                            onChange={(e) => setSpecialtyInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialty())}
                                        />
                                        <Button type="button" onClick={handleAddSpecialty}>Add</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {newTechnician.specialties.map(specialty => (
                                            <Badge key={specialty} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveSpecialty(specialty)}>
                                                {specialty} ×
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch 
                                        id="active" 
                                        checked={newTechnician.active} 
                                        onCheckedChange={(checked) => setNewTechnician({...newTechnician, active: checked})} 
                                    />
                                    <Label htmlFor="active">Active</Label>
                                </div>
                                <div>
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea id="notes" value={newTechnician.notes} onChange={(e) => setNewTechnician({...newTechnician, notes: e.target.value})} />
                                </div>
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingTechnician ? "Update Technician" : "Save Technician")}
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
                                <TableHead>Name</TableHead>
                                <TableHead>Technician Code</TableHead>
                                <TableHead>Specialties</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {technicians.length > 0 ? technicians.map(tech => (
                                <TableRow key={tech.id}>
                                    <TableCell className="font-medium">{tech.full_name}</TableCell>
                                    <TableCell>{tech.technician_code}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(tech.specialties || []).map(specialty => (
                                                <Badge key={specialty} variant="outline">{specialty}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={tech.active !== false ? "secondary" : "destructive"}>
                                            {tech.active !== false ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(tech)}><Pencil className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the technician "{tech.full_name}". This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteTechnician(tech.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan="5" className="text-center">No technicians found. Add one to get started!</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
