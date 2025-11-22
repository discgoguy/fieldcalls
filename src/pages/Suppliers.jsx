
import React, { useState, useEffect } from "react";
import { Supplier } from "@/entities/Supplier";
import { Part } from "@/entities/Part"; // Added Part entity import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox import
import { Plus, Building, Loader2, AlertTriangle, Search, CheckCircle, Pencil, RefreshCw, Link as LinkIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { addTenantId, withTenantFilter } from '@/components/utils/tenant'; // Added import for tenant utilities

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [filteredSuppliers, setFilteredSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false); // Added isSyncing state
    const [newSupplier, setNewSupplier] = useState({
        name: "",
        address: "",
        phone: "",
        email: "",
        sales_person: "",
        website: "",
        is_usd: false // Added is_usd field
    });

    const loadSuppliers = async () => {
        setLoading(true);
        try {
            const filter = await withTenantFilter(); // Get tenant filter
            const data = await Supplier.filter(filter); // Use filter method to apply tenant context
            const sortedData = (data || []).sort((a, b) => a.name.localeCompare(b.name));
            setSuppliers(sortedData);
            setFilteredSuppliers(sortedData);
        } catch (e) {
            setError("Failed to load suppliers.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSuppliers();
    }, []);

    useEffect(() => {
        const results = suppliers.filter(supplier =>
            supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (supplier.sales_person && supplier.sales_person.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredSuppliers(results);
    }, [searchTerm, suppliers]);

    const handleSyncSuppliers = async () => {
        setIsSyncing(true);
        setError("");
        setSuccessMessage("");
        try {
            setSuccessMessage("Starting sync... Fetching all parts and current suppliers.");

            const tenantFilter = await withTenantFilter(); // Get tenant filter once for all operations

            const [allParts, currentSuppliers] = await Promise.all([
                Part.filter(tenantFilter, null, 10000), // Apply tenant filter to Parts
                Supplier.filter(tenantFilter) // Apply tenant filter to Suppliers
            ]);

            setSuccessMessage("Processing data...");

            const partSupplierNames = new Set(
                allParts
                    .map(p => {
                        const supplierName = p.supplier?.trim();
                        if (supplierName === "P & E" || supplierName === "P and E") {
                            return "P&E";
                        }
                        return supplierName;
                    })
                    .filter(s => s && s.trim() !== '') // Filter out empty names
            );

            const existingSupplierNames = new Set(currentSuppliers.map(s => s.name));

            const suppliersToAdd = [...partSupplierNames].filter(name => !existingSupplierNames.has(name));
            const suppliersToDelete = currentSuppliers.filter(s => !partSupplierNames.has(s.name));

            let summary = "";

            if (suppliersToAdd.length > 0) {
                setSuccessMessage(`Adding ${suppliersToAdd.length} new suppliers...`);
                // For bulkCreate, each new record also needs the tenant ID.
                const newSupplierRecords = await Promise.all(
                    suppliersToAdd.map(async (name) => await addTenantId({ name }))
                );
                await Supplier.bulkCreate(newSupplierRecords);
                summary += `Added ${suppliersToAdd.length} new suppliers. `;
            }

            if (suppliersToDelete.length > 0) {
                setSuccessMessage(`Removing ${suppliersToDelete.length} unused suppliers...`);
                // Assuming Supplier.delete takes an ID and deletes one by one
                for (const supplier of suppliersToDelete) {
                    await Supplier.delete(supplier.id);
                }
                summary += `Removed ${suppliersToDelete.length} unused suppliers.`;
            }

            if (summary === "") {
                summary = "Supplier list is already up to date.";
            }

            setSuccessMessage("Sync complete! Reloading list.");
            await loadSuppliers();

            setTimeout(() => {
                setSuccessMessage(summary);
            }, 1500); // Display summary message after a short delay

        } catch (e) {
            setError(`An error occurred during sync: ${e.message}`);
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSuccessMessage(""), 7000); // Clear success message after 7 seconds
        }
    };

    const handleEditSupplier = (supplier) => {
        setEditingSupplier(supplier);
        setNewSupplier({
            name: supplier.name || "",
            address: supplier.address || "",
            phone: supplier.phone || "",
            email: supplier.email || "",
            sales_person: supplier.sales_person || "",
            website: supplier.website || "",
            is_usd: supplier.is_usd || false // Populate is_usd for editing
        });
        setIsDialogOpen(true);
        setError("");
    };

    const handleDialogClose = (open) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingSupplier(null);
            setNewSupplier({ name: "", address: "", phone: "", email: "", sales_person: "", website: "", is_usd: false }); // Reset is_usd
            setError("");
        }
    };

    const handleSaveSupplier = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");
        try {
            if (!newSupplier.name) {
                throw new Error("Supplier Name is required.");
            }
            if (editingSupplier) {
                await Supplier.update(editingSupplier.id, newSupplier); // Update existing supplier
                setSuccessMessage("Supplier successfully updated!");
            } else {
                const supplierWithTenant = await addTenantId(newSupplier); // Add tenant ID before creating new
                await Supplier.create(supplierWithTenant);
                setSuccessMessage("Supplier successfully created!");
            }
            
            handleDialogClose(false); // Close dialog
            await loadSuppliers();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save supplier. The name might already exist.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Building className="mr-2" />Suppliers</CardTitle>
                        <CardDescription>Manage your list of parts suppliers.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" onClick={handleSyncSuppliers} disabled={isSyncing}>
                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Sync with Parts
                        </Button>
                        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                            <DialogTrigger asChild>
                                <Button><Plus className="mr-2 h-4 w-4" />Add Supplier</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader>
                                    <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add a New Supplier"}</DialogTitle>
                                </DialogHeader>
                                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                                <form onSubmit={handleSaveSupplier} className="space-y-4 pt-4">
                                    <div>
                                        <Label htmlFor="name">Supplier Name *</Label>
                                        <Input id="name" value={newSupplier.name} onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})} required />
                                    </div>
                                    <div>
                                        <Label htmlFor="sales_person">Sales Person</Label>
                                        <Input id="sales_person" value={newSupplier.sales_person} onChange={(e) => setNewSupplier({...newSupplier, sales_person: e.target.value})} />
                                    </div>
                                    <div>
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" type="tel" value={newSupplier.phone} onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})} />
                                    </div>
                                    <div>
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" value={newSupplier.email} onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})} />
                                     </div>
                                     <div>
                                        <Label htmlFor="address">Address</Label>
                                        <Textarea id="address" rows={3} value={newSupplier.address} onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})} />
                                    </div>
                                    <div>
                                        <Label htmlFor="website">Website</Label>
                                        <Input id="website" type="url" placeholder="https://example.com" value={newSupplier.website} onChange={(e) => setNewSupplier({...newSupplier, website: e.target.value})} />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="is_usd"
                                            checked={newSupplier.is_usd}
                                            onCheckedChange={(checked) => setNewSupplier({ ...newSupplier, is_usd: checked })}
                                        />
                                        <Label htmlFor="is_usd" className="cursor-pointer">
                                            This supplier sells in US Dollars (USD)
                                        </Label>
                                    </div>
                                    <Button type="submit" disabled={isSubmitting} className="w-full">
                                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingSupplier ? "Update Supplier" : "Save Supplier")}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <div className="mt-4 relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or sales person..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                                <TableHead>Name</TableHead>
                                <TableHead>Sales Person</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Website</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSuppliers.length > 0 ? filteredSuppliers.map(s => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium">{s.name} {s.is_usd && <span className="text-xs text-muted-foreground">(USD)</span>}</TableCell>
                                    <TableCell>{s.sales_person}</TableCell>
                                    <TableCell>{s.phone}</TableCell>
                                    <TableCell>{s.email}</TableCell>
                                    <TableCell>
                                        {s.website && (
                                            <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center">
                                                <LinkIcon className="h-4 w-4 mr-1" />
                                                Visit
                                            </a>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditSupplier(s)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan="6" className="text-center">No suppliers found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
