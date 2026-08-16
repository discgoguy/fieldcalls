import React, { useState, useEffect, useMemo } from "react";
import { supabase } from '@/api/supabaseClient';
import { Category, Customer, CustomerInventory, MachineType, Part } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ShoppingCart, Search, Plus, Minus, Trash2, CheckCircle, LayoutGrid, List } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PortalParts() {
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [machineTypes, setMachineTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedMachineType, setSelectedMachineType] = useState("all");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
                if (currentUser?.customer_id) {
                    const [customerData, partsData, categoriesData, machineTypesData] = await Promise.all([
                        Customer.get(currentUser.customer_id),
                        Part.list(),
                        Category.list(),
                        MachineType.list()
                    ]);
                    setCustomer(customerData);
                    setParts(partsData || []);
                    setCategories(categoriesData || []);
                    setMachineTypes(machineTypesData || []);
                }
            } catch (e) {
                console.error("Failed to load parts catalog", e);
                setError("Failed to load catalog.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredParts = useMemo(() => {
        return parts.filter(part => {
            const matchesSearch = 
                part.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                part.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === "all" || part.category === selectedCategory;
            const matchesMachineType = selectedMachineType === "all" || (part.compatible_machine_types && part.compatible_machine_types.includes(selectedMachineType));
            return matchesSearch && matchesCategory && matchesMachineType && !part.is_obsolete && !part.is_internal;
        });
    }, [parts, searchTerm, selectedCategory, selectedMachineType]);

    const getPrice = (part) => {
        if (!customer) return 0;
        return customer.is_nonsa ? (part.nonsa_price || part.sales_price) : part.sales_price;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    };

    const addToCart = (part) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === part.id);
            if (existing) {
                return prev.map(item => item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...part, quantity: 1 }];
        });
    };

    const removeFromCart = (partId) => {
        setCart(prev => prev.filter(item => item.id !== partId));
    };

    const updateQuantity = (partId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === partId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (getPrice(item) * item.quantity), 0);
    }, [cart, customer]);

    const handleSubmitOrder = () => {
        if (!cart.length) return;
        
        // Save cart to session storage and redirect to tickets page
        sessionStorage.setItem('portalPartsCart', JSON.stringify(cart));
        window.location.href = '/PortalTickets?fromCart=true';
    };

    const handleAddToInventory = async () => {
        if (!cart.length || !customer) return;
        setIsSubmitting(true);
        try {
            for (const item of cart) {
                const existingItems = await CustomerInventory.filter({ 
                    customer_id: customer.id, 
                    part_id: item.id 
                });

                if (existingItems && existingItems.length > 0) {
                    await CustomerInventory.update(existingItems[0].id, {
                        quantity: existingItems[0].quantity + item.quantity
                    });
                } else {
                    await CustomerInventory.create({
                        customer_id: customer.id,
                        part_id: item.id,
                        quantity: item.quantity
                    });
                }
            }
            setSuccessMessage("Items added to your inventory successfully!");
            setCart([]);
            setIsCartOpen(false);
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            console.error("Failed to add to inventory", e);
            setError("Failed to add items to inventory.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle>Parts Catalog</CardTitle>
                            <CardDescription>Browse parts and submit order requests.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search parts..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="relative">
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        Cart
                                        {cart.length > 0 && (
                                            <Badge className="ml-2 bg-blue-600 hover:bg-blue-700">{cart.length}</Badge>
                                        )}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>Your Cart</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
                                        {cart.length === 0 ? (
                                            <p className="text-center text-gray-500 py-8">Your cart is empty.</p>
                                        ) : (
                                            cart.map(item => (
                                                <div key={item.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium">{item.part_name}</h4>
                                                        <p className="text-sm text-gray-500">{item.part_number}</p>
                                                        <p className="text-sm font-semibold mt-1">{formatCurrency(getPrice(item))}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center border rounded-md">
                                                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-gray-100"><Minus className="h-3 w-3" /></button>
                                                            <span className="px-2 text-sm">{item.quantity}</span>
                                                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-gray-100"><Plus className="h-3 w-3" /></button>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {cart.length > 0 && (
                                        <div className="border-t pt-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="font-semibold">Estimated Total</span>
                                                <span className="text-lg font-bold">{formatCurrency(cartTotal)}</span>
                                            </div>
                                            <Button className="w-full mb-3" onClick={handleSubmitOrder} disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Order Request"}
                                            </Button>
                                            <Button variant="outline" className="w-full" onClick={handleAddToInventory} disabled={isSubmitting}>
                                                Add to My Inventory
                                            </Button>
                                        </div>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
                        <div className="w-full md:w-48">
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-48">
                            <Select value={selectedMachineType} onValueChange={setSelectedMachineType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Machine Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Machine Types</SelectItem>
                                    {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map(mt => <SelectItem key={mt.id} value={mt.name}>{mt.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex border rounded-md ml-auto">
                            <Button 
                                variant={viewMode === "grid" ? "secondary" : "ghost"} 
                                size="icon" 
                                onClick={() => setViewMode("grid")}
                                title="Grid View"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button 
                                variant={viewMode === "list" ? "secondary" : "ghost"} 
                                size="icon" 
                                onClick={() => setViewMode("list")}
                                title="List View"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {successMessage && <Alert className="mb-6 bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
                    
                    {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredParts.map(part => (
                                <Card key={part.id} className="flex flex-col">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-base">{part.part_name}</CardTitle>
                                                <CardDescription>{part.part_number}</CardDescription>
                                            </div>
                                            <Badge variant="outline">{part.category}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 pb-2">
                                        <p className="text-sm text-gray-500 line-clamp-2 h-10">{part.description || "No description available."}</p>
                                        <div className="mt-4 flex items-end justify-between">
                                            <div>
                                                <p className="text-lg font-bold text-blue-600">{formatCurrency(getPrice(part))}</p>
                                                <p className="text-xs text-gray-400">
                                                    {part.quantity_in_inventory > 0 ? (
                                                        <span className="text-green-600 font-medium">In Stock</span>
                                                    ) : (
                                                        <span className="text-red-500">Out of Stock</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <div className="p-4 pt-0 mt-auto">
                                        <Button className="w-full" variant={cart.find(i => i.id === part.id) ? "secondary" : "default"} onClick={() => addToCart(part)}>
                                            {cart.find(i => i.id === part.id) ? (
                                                <>Added ({cart.find(i => i.id === part.id).quantity})</>
                                            ) : (
                                                <>
                                                    <Plus className="h-4 w-4 mr-2" /> Add to Order
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Part Name</TableHead>
                                        <TableHead>Number</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Stock</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredParts.map(part => (
                                        <TableRow key={part.id}>
                                            <TableCell className="font-medium">{part.part_name}</TableCell>
                                            <TableCell>{part.part_number}</TableCell>
                                            <TableCell><Badge variant="outline">{part.category}</Badge></TableCell>
                                            <TableCell>{formatCurrency(getPrice(part))}</TableCell>
                                            <TableCell>
                                                {part.quantity_in_inventory > 0 ? (
                                                    <span className="text-green-600 font-medium">In Stock</span>
                                                ) : (
                                                    <span className="text-red-500">Out of Stock</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant={cart.find(i => i.id === part.id) ? "secondary" : "default"} onClick={() => addToCart(part)}>
                                                    {cart.find(i => i.id === part.id) ? (
                                                        <>Added ({cart.find(i => i.id === part.id).quantity})</>
                                                    ) : (
                                                        <>
                                                            <Plus className="h-4 w-4 mr-2" /> Add
                                                        </>
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {filteredParts.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No parts found matching your criteria.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}