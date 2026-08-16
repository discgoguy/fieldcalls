import React, { useState, useEffect, useMemo } from "react";
import { invokeApi } from '@/api/supabaseClient';
import { BorrowedPart, Category, Part } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Loader2, CheckCircle, AlertTriangle, ArrowLeftRight, Filter, Package } from "lucide-react";
import { format } from "date-fns";

export default function InternalPartMovementsPage() {
    const [borrowedParts, setBorrowedParts] = useState([]);
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [statusFilter, setStatusFilter] = useState("Active");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [returningItem, setReturningItem] = useState(null);
    const [returnQuantity, setReturnQuantity] = useState("");

    const [newMovement, setNewMovement] = useState({
        part_id: "",
        quantity: "",
        movement_type: "Borrowed",
        department: "Manufacturing",
        job_project_number: "",
        movement_date: format(new Date(), 'yyyy-MM-dd'),
        notes: ""
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        // Check if coming from cart
        const urlParams = new URLSearchParams(window.location.search);
        const fromCart = urlParams.get('fromCart');
        
        if (fromCart === 'true') {
            const cartData = sessionStorage.getItem('partsCartData');
            if (cartData) {
                try {
                    const parsedData = JSON.parse(cartData);
                    if (parsedData && parsedData.length > 0) {
                        // Pre-fill the first part from the cart
                        setNewMovement(prev => ({
                            ...prev,
                            part_id: parsedData[0].partId,
                            quantity: parsedData[0].quantity.toString()
                        }));
                        setIsDialogOpen(true);
                        
                        // Store remaining parts for later (if user wants to add multiple)
                        if (parsedData.length > 1) {
                            sessionStorage.setItem('remainingCartParts', JSON.stringify(parsedData.slice(1)));
                        }
                    }
                    sessionStorage.removeItem('partsCartData');
                } catch (e) {
                    console.error('Failed to parse cart data:', e);
                }
            }
        }
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [borrowedData, partsData, categoriesData] = await Promise.all([
                BorrowedPart.list(),
                Part.list(),
                Category.list()
            ]);
            setBorrowedParts(borrowedData || []);
            setParts(partsData || []);
            setCategories(categoriesData || []);
        } catch (e) {
            setError("Failed to load data.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredBorrowedParts = useMemo(() => {
        return borrowedParts.filter(bp => {
            const statusMatch = bp.status === statusFilter;
            const departmentMatch = departmentFilter === "all" || bp.department === departmentFilter;
            return statusMatch && departmentMatch;
        });
    }, [borrowedParts, statusFilter, departmentFilter]);

    const handleSaveMovement = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");

        try {
            const part = parts.find(p => p.id === newMovement.part_id);
            if (!part) {
                throw new Error("Please select a valid part.");
            }

            const qty = parseInt(newMovement.quantity);
            if (!qty || qty <= 0) {
                throw new Error("Quantity must be greater than 0.");
            }

            if (part.quantity_in_inventory < qty) {
                throw new Error(`Insufficient inventory. Only ${part.quantity_in_inventory} available.`);
            }

            if ((newMovement.movement_type === "Used in Manufacturing" || newMovement.movement_type === "Used in Product Development") && !newMovement.job_project_number) {
                throw new Error("Job/Project number is required for manufacturing and development use.");
            }

            // Create borrowed part record
            await BorrowedPart.create({
                part_id: newMovement.part_id,
                quantity: qty,
                movement_type: newMovement.movement_type,
                department: newMovement.department,
                job_project_number: newMovement.job_project_number || null,
                movement_date: newMovement.movement_date,
                status: "Active",
                notes: newMovement.notes || null
            });

            // Deduct from inventory
            const stockBefore = part.quantity_in_inventory;
            await Part.update(part.id, {
                quantity_in_inventory: stockBefore - qty
            });
            invokeApi('inventoryAudit', {
                part_id: part.id,
                change_type: 'deduction',
                quantity_before: stockBefore,
                quantity_change: -qty,
                quantity_after: stockBefore - qty,
                reference_type: 'internal_movement',
                reference_number: newMovement.movement_type + (newMovement.job_project_number ? ' — ' + newMovement.job_project_number : ''),
                notes: newMovement.notes || null,
            }).catch(e => console.error('Audit log failed:', e));

            setSuccessMessage(`Successfully recorded ${newMovement.movement_type.toLowerCase()} movement.`);
            setIsDialogOpen(false);
            setSelectedCategory("all");
            setNewMovement({
                part_id: "",
                quantity: "",
                movement_type: "Borrowed",
                department: "Manufacturing",
                job_project_number: "",
                movement_date: format(new Date(), 'yyyy-MM-dd'),
                notes: ""
            });
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to record movement.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenReturnDialog = (borrowedPart) => {
        setReturningItem(borrowedPart);
        setReturnQuantity(borrowedPart.quantity.toString());
        setIsReturnDialogOpen(true);
        setError("");
    };

    const handleReturnParts = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            const qty = parseInt(returnQuantity);
            if (!qty || qty <= 0) {
                throw new Error("Return quantity must be greater than 0.");
            }

            if (qty > returningItem.quantity) {
                throw new Error(`Cannot return more than borrowed quantity (${returningItem.quantity}).`);
            }

            const part = parts.find(p => p.id === returningItem.part_id);
            if (!part) {
                throw new Error("Part not found.");
            }

            // Add back to inventory
            const stockBeforeReturn = part.quantity_in_inventory;
            await Part.update(part.id, {
                quantity_in_inventory: stockBeforeReturn + qty
            });
            invokeApi('inventoryAudit', {
                part_id: part.id,
                change_type: 'return',
                quantity_before: stockBeforeReturn,
                quantity_change: qty,
                quantity_after: stockBeforeReturn + qty,
                reference_type: 'internal_movement',
                reference_number: 'Return — ' + (returningItem.movement_type || 'Internal'),
                notes: null,
            }).catch(e => console.error('Audit log failed:', e));

            // If returning all, mark as Returned, otherwise create a new record for the partial return
            if (qty === returningItem.quantity) {
                await BorrowedPart.update(returningItem.id, {
                    status: "Returned",
                    closure_date: format(new Date(), 'yyyy-MM-dd')
                });
            } else {
                // Reduce the original borrowed quantity
                await BorrowedPart.update(returningItem.id, {
                    quantity: returningItem.quantity - qty
                });
            }

            setSuccessMessage(`Successfully returned ${qty} unit(s) to inventory.`);
            setIsReturnDialogOpen(false);
            setReturningItem(null);
            setReturnQuantity("");
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to return parts.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMarkCompleted = async (borrowedPart) => {
        try {
            await BorrowedPart.update(borrowedPart.id, {
                status: "Completed",
                closure_date: format(new Date(), 'yyyy-MM-dd')
            });
            setSuccessMessage("Movement marked as completed.");
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError("Failed to mark as completed.");
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            Active: "bg-blue-100 text-blue-800",
            Returned: "bg-green-100 text-green-800",
            Completed: "bg-gray-100 text-gray-800"
        };
        return <Badge className={colors[status]}>{status}</Badge>;
    };

    const getPartDetails = (partId) => {
        const part = parts.find(p => p.id === partId);
        return part ? `${part.part_name} (${part.part_number})` : "Unknown Part";
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                    <div>
                        <CardTitle className="flex items-center">
                            <ArrowLeftRight className="mr-2" />
                            Internal Part Movements
                        </CardTitle>
                        <CardDescription>
                            Track parts borrowed or used by other departments.
                        </CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Record Movement
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Record Internal Part Movement</DialogTitle>
                            </DialogHeader>
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <form onSubmit={handleSaveMovement} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="movement_type">Movement Type *</Label>
                                        <Select
                                            value={newMovement.movement_type}
                                            onValueChange={(value) => setNewMovement({...newMovement, movement_type: value})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Borrowed">Borrowed (to be returned)</SelectItem>
                                                <SelectItem value="Used in Manufacturing">Used in Manufacturing</SelectItem>
                                                <SelectItem value="Used in Product Development">Used in Product Development</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="department">Department *</Label>
                                        <Select
                                            value={newMovement.department}
                                            onValueChange={(value) => setNewMovement({...newMovement, department: value})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                                <SelectItem value="R&D">R&D</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="category">Category</Label>
                                        <Select
                                            value={selectedCategory}
                                            onValueChange={setSelectedCategory}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All Categories" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Categories</SelectItem>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="part_id">Part *</Label>
                                        <Select
                                            value={newMovement.part_id}
                                            onValueChange={(value) => setNewMovement({...newMovement, part_id: value})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a part" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {parts
                                                    .filter(p => p.quantity_in_inventory > 0 && (selectedCategory === "all" || p.category === selectedCategory))
                                                    .map(part => (
                                                        <SelectItem key={part.id} value={part.id}>
                                                            {part.part_name} ({part.part_number}) - Stock: {part.quantity_in_inventory}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="quantity">Quantity *</Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min="1"
                                            value={newMovement.quantity}
                                            onChange={(e) => setNewMovement({...newMovement, quantity: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="movement_date">Movement Date *</Label>
                                        <Input
                                            id="movement_date"
                                            type="date"
                                            value={newMovement.movement_date}
                                            onChange={(e) => setNewMovement({...newMovement, movement_date: e.target.value})}
                                            required
                                        />
                                    </div>
                                </div>

                                {(newMovement.movement_type === "Used in Manufacturing" || newMovement.movement_type === "Used in Product Development") && (
                                    <div>
                                        <Label htmlFor="job_project_number">
                                            {newMovement.movement_type === "Used in Manufacturing" ? "Job Number *" : "Project Number *"}
                                        </Label>
                                        <Input
                                            id="job_project_number"
                                            value={newMovement.job_project_number}
                                            onChange={(e) => setNewMovement({...newMovement, job_project_number: e.target.value})}
                                            placeholder="Enter job or project number"
                                            required
                                        />
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea
                                        id="notes"
                                        value={newMovement.notes}
                                        onChange={(e) => setNewMovement({...newMovement, notes: e.target.value})}
                                        placeholder="Additional notes..."
                                    />
                                </div>

                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Recording...
                                        </>
                                    ) : (
                                        "Record Movement"
                                    )}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex flex-wrap gap-4 mt-4">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-muted-foreground" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Returned">Returned</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-muted-foreground" />
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                <SelectItem value="R&D">R&D</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {successMessage && (
                    <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>{successMessage}</AlertDescription>
                    </Alert>
                )}

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Part</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="text-center">Quantity</TableHead>
                                    <TableHead>Job/Project #</TableHead>
                                    <TableHead>Movement Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBorrowedParts.length > 0 ? (
                                    filteredBorrowedParts.map((bp) => (
                                        <TableRow key={bp.id}>
                                            <TableCell className="font-medium">{getPartDetails(bp.part_id)}</TableCell>
                                            <TableCell>{bp.movement_type}</TableCell>
                                            <TableCell>{bp.department}</TableCell>
                                            <TableCell className="text-center font-semibold">{bp.quantity}</TableCell>
                                            <TableCell>{bp.job_project_number || "—"}</TableCell>
                                            <TableCell>{format(new Date(bp.movement_date), 'MMM dd, yyyy')}</TableCell>
                                            <TableCell>{getStatusBadge(bp.status)}</TableCell>
                                            <TableCell>
                                                {bp.status === "Active" && bp.movement_type === "Borrowed" && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenReturnDialog(bp)}
                                                    >
                                                        Return
                                                    </Button>
                                                )}
                                                {bp.status === "Active" && bp.movement_type !== "Borrowed" && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleMarkCompleted(bp)}
                                                    >
                                                        Mark Complete
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan="8" className="text-center py-12 text-gray-500">
                                            <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                            <p className="text-lg font-semibold">No movements found</p>
                                            <p>Record a new movement to get started.</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Return Borrowed Parts</DialogTitle>
                    </DialogHeader>
                    {error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {returningItem && (
                        <form onSubmit={handleReturnParts} className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-600">Part: <span className="font-semibold">{getPartDetails(returningItem.part_id)}</span></p>
                                <p className="text-sm text-gray-600">Borrowed Quantity: <span className="font-semibold">{returningItem.quantity}</span></p>
                            </div>
                            <div>
                                <Label htmlFor="return_quantity">Return Quantity *</Label>
                                <Input
                                    id="return_quantity"
                                    type="number"
                                    min="1"
                                    max={returningItem.quantity}
                                    value={returnQuantity}
                                    onChange={(e) => setReturnQuantity(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Enter full or partial quantity to return</p>
                            </div>
                            <Button type="submit" disabled={isSubmitting} className="w-full">
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Processing...
                                    </>
                                ) : (
                                    "Return to Inventory"
                                )}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}