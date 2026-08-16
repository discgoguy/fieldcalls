import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabaseClient';
import { CustomerInventory, Machine, Part, Transaction } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package, Wrench, Plus, Trash2, AlertTriangle, CheckCircle, Pencil, Save, X } from "lucide-react";
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
} from "@/components/ui/alert-dialog";

export default function PortalInventory() {
    const [inventory, setInventory] = useState([]);
    const [parts, setParts] = useState([]);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    
    // Service Log State
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMachine, setSelectedMachine] = useState("");
    const [serviceNotes, setServiceNotes] = useState("");
    const [usedParts, setUsedParts] = useState([]); // [{ inventory_id, part_id, quantity }]
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Inventory Management State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newPartId, setNewPartId] = useState("");
    const [newPartQty, setNewPartQty] = useState(1);
    const [editingItem, setEditingItem] = useState(null);
    const [editQty, setEditQty] = useState(0);
    const [itemToDelete, setItemToDelete] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const currentUser = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
            setUser(currentUser);
            if (currentUser?.customer_id) {
                const [invData, partData, machineData] = await Promise.all([
                    CustomerInventory.filter({ customer_id: currentUser.customer_id }),
                    Part.list(),
                    Machine.filter({ customer_id: currentUser.customer_id })
                ]);
                setInventory(invData || []);
                setParts(partData || []);
                setMachines(machineData || []);
            }
        } catch (e) {
            console.error("Failed to load inventory", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Check for 'action=log' in URL to auto-open the Log Service dialog
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'log') {
            setIsLogOpen(true);
            // Clean URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    const getPartName = (partId) => {
        const part = parts.find(p => p.id === partId);
        return part ? `${part.part_name} (${part.part_number})` : "Unknown Part";
    };

    const handleAddInventoryItem = async (e) => {
        e.preventDefault();
        if (!newPartId || newPartQty < 1) return;
        setIsSubmitting(true);
        try {
            // Check if already exists
            const existing = inventory.find(i => i.part_id === newPartId);
            if (existing) {
                await CustomerInventory.update(existing.id, {
                    quantity: existing.quantity + parseInt(newPartQty)
                });
            } else {
                await CustomerInventory.create({
                    customer_id: user.customer_id,
                    part_id: newPartId,
                    quantity: parseInt(newPartQty)
                });
            }
            setSuccess("Part added to inventory.");
            setIsAddOpen(false);
            setNewPartId("");
            setNewPartQty(1);
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e) {
            setError("Failed to add part.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const startEditing = (item) => {
        setEditingItem(item.id);
        setEditQty(item.quantity);
    };

    const cancelEditing = () => {
        setEditingItem(null);
        setEditQty(0);
    };

    const saveEditing = async (item) => {
        try {
            await CustomerInventory.update(item.id, { quantity: parseInt(editQty) });
            setSuccess("Inventory updated.");
            setEditingItem(null);
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e) {
            setError("Failed to update quantity.");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        try {
            await CustomerInventory.delete(itemToDelete.id);
            setSuccess("Item removed from inventory.");
            setItemToDelete(null);
            await loadData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e) {
            setError("Failed to remove item.");
        }
    };

    const handleAddPartRow = () => {
        setUsedParts([...usedParts, { inventory_id: "", quantity: 1 }]);
    };

    const handleRemovePartRow = (index) => {
        const newRows = [...usedParts];
        newRows.splice(index, 1);
        setUsedParts(newRows);
    };

    const handlePartRowChange = (index, field, value) => {
        const newRows = [...usedParts];
        newRows[index][field] = value;
        if (field === 'inventory_id') {
            const item = inventory.find(i => i.id === value);
            newRows[index].part_id = item?.part_id;
            newRows[index].max_qty = item?.quantity;
        }
        setUsedParts(newRows);
    };

    const handleSubmitService = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        
        try {
            if (!selectedMachine) throw new Error("Please select a machine.");
            if (!serviceNotes) throw new Error("Please provide a description of the service.");

            const transactionId = `SVC-${Date.now()}`;
            
            // Create service transaction (main record)
            await Transaction.create({
                transaction_id: transactionId,
                transaction_type: "in_house_service",
                date: serviceDate,
                customer_id: user.customer_id,
                machine_id: selectedMachine,
                technician_name: user.full_name || "Customer User",
                notes: serviceNotes,
                quantity: 0,
                total_cost: 0
            });

            // Create transactions for parts and update inventory
            for (const item of usedParts) {
                if (!item.inventory_id || !item.quantity) continue;

                const invItem = inventory.find(i => i.id === item.inventory_id);
                if (!invItem) continue;

                if (item.quantity > invItem.quantity) {
                    throw new Error(`Insufficient quantity for ${getPartName(invItem.part_id)}`);
                }

                // Create part usage transaction
                await Transaction.create({
                    transaction_id: `SVC-PART-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    transaction_type: "in_house_service",
                    date: serviceDate,
                    customer_id: user.customer_id,
                    machine_id: selectedMachine,
                    part_id: invItem.part_id,
                    quantity: parseInt(item.quantity),
                    technician_name: user.full_name || "Customer User",
                    notes: `Part used in In-House Service: ${serviceNotes}`,
                    total_cost: 0 // Assuming in-house parts use doesn't track cost in the same way, or could use part cost if needed
                });

                // Decrement inventory
                await CustomerInventory.update(invItem.id, {
                    quantity: invItem.quantity - parseInt(item.quantity)
                });
            }

            setSuccess("Service logged successfully!");
            setIsLogOpen(false);
            setUsedParts([]);
            setServiceNotes("");
            setSelectedMachine("");
            loadData(); // Reload inventory
            setTimeout(() => setSuccess(""), 4000);

        } catch (err) {
            setError(err.message || "Failed to log service.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">My Inventory</h1>
                    <p className="text-gray-500">Manage your spare parts inventory and log service.</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Plus className="mr-2 h-4 w-4" /> Add Part
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Part to Inventory</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddInventoryItem} className="space-y-4 mt-4">
                                <div>
                                    <Label>Part</Label>
                                    <Select value={newPartId} onValueChange={setNewPartId}>
                                        <SelectTrigger><SelectValue placeholder="Select Part" /></SelectTrigger>
                                        <SelectContent>
                                            {parts.filter(p => !p.is_obsolete).map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Quantity</Label>
                                    <Input type="number" min="1" value={newPartQty} onChange={e => setNewPartQty(e.target.value)} />
                                </div>
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to Inventory"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-700">
                                <Wrench className="mr-2 h-4 w-4" /> Log Service
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Log In-House Service</DialogTitle>
                            </DialogHeader>
                            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}
                            <form onSubmit={handleSubmitService} className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Date</Label>
                                        <Input type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} required />
                                    </div>
                                    <div>
                                        <Label>Machine</Label>
                                        <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                                            <SelectTrigger><SelectValue placeholder="Select Machine" /></SelectTrigger>
                                            <SelectContent>
                                                {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.model} (S/N: {m.serial_number})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <Label>Notes / Description of Service</Label>
                                    <Textarea value={serviceNotes} onChange={e => setServiceNotes(e.target.value)} placeholder="Describe what work was performed..." required />
                                </div>
                                
                                <div className="border p-4 rounded-md bg-slate-50 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label>Parts Used from Inventory (Optional)</Label>
                                        <Button type="button" size="sm" variant="outline" onClick={handleAddPartRow}><Plus className="h-3 w-3 mr-1"/> Add Part</Button>
                                    </div>
                                    {usedParts.map((row, idx) => (
                                        <div key={idx} className="flex gap-3 items-end">
                                            <div className="flex-1">
                                                <Label className="text-xs">Part</Label>
                                                <Select value={row.inventory_id} onValueChange={v => handlePartRowChange(idx, 'inventory_id', v)}>
                                                    <SelectTrigger><SelectValue placeholder="Select Part from Inventory" /></SelectTrigger>
                                                    <SelectContent>
                                                        {inventory.filter(i => i.quantity > 0).map(i => (
                                                            <SelectItem key={i.id} value={i.id}>
                                                                {getPartName(i.part_id)} (Avail: {i.quantity})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="w-24">
                                                <Label className="text-xs">Qty</Label>
                                                <Input type="number" min="1" max={row.max_qty} value={row.quantity} onChange={e => handlePartRowChange(idx, 'quantity', e.target.value)} />
                                            </div>
                                            <Button type="button" size="icon" variant="ghost" className="text-red-500" onClick={() => handleRemovePartRow(idx)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                    {usedParts.length === 0 && <p className="text-sm text-gray-500 italic text-center">No parts used.</p>}
                                </div>

                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Log Service & Update Inventory"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {success && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4"/><AlertDescription>{success}</AlertDescription></Alert>}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Package className="mr-2"/> Inventory Items</CardTitle>
                    <CardDescription>Parts you currently have in stock.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part Name</TableHead>
                                    <TableHead>Part Number</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-center">Quantity</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inventory.length > 0 ? inventory.map(item => {
                                    const part = parts.find(p => p.id === item.part_id);
                                    const isEditing = editingItem === item.id;
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{part?.part_name || "Unknown"}</TableCell>
                                            <TableCell>{part?.part_number || "N/A"}</TableCell>
                                            <TableCell>{part?.category || "N/A"}</TableCell>
                                            <TableCell className="text-center font-bold">
                                                {isEditing ? (
                                                    <Input 
                                                        type="number" 
                                                        className="w-20 mx-auto h-8" 
                                                        value={editQty} 
                                                        onChange={e => setEditQty(e.target.value)} 
                                                    />
                                                ) : item.quantity}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <Button size="sm" variant="ghost" className="text-green-600" onClick={() => saveEditing(item)}><Save className="h-4 w-4"/></Button>
                                                            <Button size="sm" variant="ghost" className="text-gray-500" onClick={cancelEditing}><X className="h-4 w-4"/></Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button size="sm" variant="ghost" onClick={() => startEditing(item)}><Pencil className="h-4 w-4 text-gray-500"/></Button>
                                                            <Button size="sm" variant="ghost" onClick={() => setItemToDelete(item)}><Trash2 className="h-4 w-4 text-red-500"/></Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-500 py-8">Your inventory is empty.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Item from Inventory?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this item from your inventory list? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600">Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}