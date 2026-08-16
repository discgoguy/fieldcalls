import React, { useState, useMemo } from 'react';
import { AssemblyComponent, Category, Part } from '@/api/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, FileText, ClipboardCheck, Package, Wrench, ClipboardList, AlertTriangle, ArrowLeftRight, Layers, CheckCircle, Star } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PartsCartModal({ isOpen, onOpenChange, cartItems, onRemoveItem, onClearCart, onUpdateQuantity, parts }) {
    const [error, setError] = useState('');
    const [showAssemblyDialog, setShowAssemblyDialog] = useState(false);
    const [assemblyData, setAssemblyData] = useState({ name: '', partNumber: '', category: '', laborCost: 0 });
    const [categories, setCategories] = useState([]);
    const [isCreatingAssembly, setIsCreatingAssembly] = useState(false);
    const [assemblySuccess, setAssemblySuccess] = useState(false);

    const cartItemsWithDetails = useMemo(() => {
        return cartItems.map(cartItem => {
            const part = parts.find(p => p.id === cartItem.partId);
            return { ...cartItem, ...part };
        }).filter(item => item.id); // Filter out any items where part wasn't found
    }, [cartItems, parts]);

    const supplierGroups = useMemo(() => {
        const groups = {};
        cartItemsWithDetails.forEach(item => {
            const supplier = item.supplier || 'No Supplier';
            if (!groups[supplier]) {
                groups[supplier] = [];
            }
            groups[supplier].push(item);
        });
        return groups;
    }, [cartItemsWithDetails]);

    const handleCreateOrder = (action) => {
        setError('');
        
        if (cartItemsWithDetails.length === 0) {
            setError('No parts selected. Please add items first.');
            return;
        }

        if (action === 'purchase_order') {
            const suppliers = Object.keys(supplierGroups);
            if (suppliers.length > 1) {
                setError('Purchase orders can only contain parts from one supplier. Please remove parts to have only one supplier selected.');
                return;
            }
            if (suppliers[0] === 'No Supplier') {
                setError('Selected parts must have a supplier to create a purchase order.');
                return;
            }
        }

        // Store cart items in sessionStorage for the target page to use
        const cartData = cartItemsWithDetails.map(item => ({
            partId: item.id,
            quantity: item.quantity || 1
        }));
        sessionStorage.setItem('partsCartData', JSON.stringify(cartData));

        // Navigate to the appropriate page
        const pageMap = {
            quote: 'Quotes',
            ticket: 'Tickets',
            parts_order: 'PartsOrder',
            service: 'OnSiteService',
            purchase_order: 'PurchaseOrders',
            borrowed_parts: 'InternalPartMovements'
        };

        window.location.href = createPageUrl(pageMap[action]) + '?fromCart=true';
    };

    const handleOpenAssemblyDialog = async () => {
        if (cartItemsWithDetails.length === 0) {
            setError('No parts selected. Please add items first.');
            return;
        }
        
        try {
            const categoriesData = await Category.list();
            setCategories(categoriesData || []);
            setShowAssemblyDialog(true);
            setError('');
        } catch (e) {
            setError('Failed to load categories.');
        }
    };

    const handleMakeFavorite = async () => {
        setError('');
        try {
            // Mark all items in cart as favorites
            for (const item of cartItemsWithDetails) {
                if (!item.is_favorite) {
                    await Part.update(item.id, { is_favorite: true });
                }
            }
            onClearCart();
            window.location.reload();
        } catch (e) {
            setError('Failed to mark parts as favorites: ' + (e.message || 'Unknown error'));
        }
    };

    const handleCreateAssembly = async () => {
        setError('');
        setIsCreatingAssembly(true);

        try {
            if (!assemblyData.name || !assemblyData.partNumber || !assemblyData.category) {
                setError('Please fill in all required fields.');
                setIsCreatingAssembly(false);
                return;
            }

            // Calculate total cost from components
            let totalComponentCost = 0;
            for (const item of cartItemsWithDetails) {
                totalComponentCost += (item.cost || 0) * (item.quantity || 1);
            }

            const laborCost = parseFloat(assemblyData.laborCost) || 0;
            const totalCost = totalComponentCost + laborCost;

            // Create the assembly part
            const newAssembly = await Part.create({
                part_name: assemblyData.name,
                part_number: assemblyData.partNumber,
                supplier: 'In-House Assembly',
                cost: totalCost,
                cost_usd: 0,
                markup_percentage: 0,
                sales_price: totalCost,
                nonsa_price: totalCost,
                quantity_in_inventory: 0,
                reorder_level: 0,
                category: assemblyData.category,
                description: `Assembly created from ${cartItemsWithDetails.length} components`,
                is_assembly: true,
                assembly_labor_cost: laborCost,
                is_obsolete: false
            });

            // Create assembly component records
            for (const item of cartItemsWithDetails) {
                await AssemblyComponent.create({
                    assembly_part_id: newAssembly.id,
                    component_part_id: item.id,
                    quantity_required: item.quantity || 1
                });
            }

            setAssemblySuccess(true);
            setTimeout(() => {
                setShowAssemblyDialog(false);
                setAssemblySuccess(false);
                setAssemblyData({ name: '', partNumber: '', category: '', laborCost: 0 });
                onClearCart();
                window.location.reload(); // Refresh to show new assembly
            }, 2000);

        } catch (e) {
            setError('Failed to create assembly: ' + (e.message || 'Unknown error'));
        } finally {
            setIsCreatingAssembly(false);
        }
    };



    const totalItems = cartItemsWithDetails.reduce((sum, item) => sum + (item.quantity || 1), 0);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5" />
                        Parts Selection ({totalItems} item{totalItems !== 1 ? 's' : ''})
                    </DialogTitle>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                        {cartItemsWithDetails.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <ClipboardList className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                                <p className="text-lg font-semibold">No parts selected</p>
                                <p className="text-sm">Add parts to get started</p>
                            </div>
                        ) : (
                            <>
                                {cartItemsWithDetails.map(item => (
                                            <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                                                <div className="flex-1">
                                                    <p className="font-semibold">{item.part_name}</p>
                                                    <p className="text-sm text-gray-500">{item.part_number}</p>
                                                    <div className="flex gap-2 mt-2 items-center">
                                                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                                                        {item.supplier && <Badge variant="outline" className="text-xs">{item.supplier}</Badge>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col items-center">
                                                        <label className="text-xs text-gray-500 mb-1">Qty</label>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity || 1}
                                                            onChange={(e) => onUpdateQuantity && onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                            className="w-16 h-8 text-center"
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onRemoveItem(item.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                ))}
                            </>
                        )}
                    </div>
                </ScrollArea>

                {cartItemsWithDetails.length > 0 && (
                    <div className="border-t pt-4 space-y-3">
                        <p className="text-sm font-semibold text-gray-700">Create from selected parts:</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => handleCreateOrder('quote')}
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Quote
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => handleCreateOrder('ticket')}
                            >
                                <ClipboardCheck className="h-4 w-4 mr-2" />
                                Ticket
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => handleCreateOrder('parts_order')}
                            >
                                <Package className="h-4 w-4 mr-2" />
                                Parts Order
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => handleCreateOrder('service')}
                            >
                                <Wrench className="h-4 w-4 mr-2" />
                                Service Order
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => handleCreateOrder('purchase_order')}
                            >
                                <ClipboardList className="h-4 w-4 mr-2" />
                                Purchase Order
                            </Button>
                            <Button
                                variant="outline"
                                className="border-blue-300 justify-start"
                                onClick={() => handleCreateOrder('borrowed_parts')}
                            >
                                <ArrowLeftRight className="h-4 w-4 mr-2" />
                                Borrowed Parts
                            </Button>
                            <Button
                                variant="outline"
                                className="border-purple-300 justify-start"
                                onClick={handleOpenAssemblyDialog}
                            >
                                <Layers className="h-4 w-4 mr-2" />
                                Create Assembly
                            </Button>
                            <Button
                                variant="outline"
                                className="border-yellow-300 justify-start"
                                onClick={handleMakeFavorite}
                            >
                                <Star className="h-4 w-4 mr-2 fill-yellow-500 text-yellow-500" />
                                Make Favorite
                            </Button>
                            </div>
                        <Button
                            variant="outline"
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={onClearCart}
                        >
                            Clear All
                        </Button>
                    </div>
                )}
            </DialogContent>

            {/* Assembly Creation Dialog */}
            <Dialog open={showAssemblyDialog} onOpenChange={setShowAssemblyDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Layers className="h-5 w-5" />
                            Create Part Assembly
                        </DialogTitle>
                    </DialogHeader>

                    {assemblySuccess ? (
                        <div className="py-8 text-center">
                            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                            <p className="text-lg font-semibold text-green-700">Assembly Created Successfully!</p>
                            <p className="text-sm text-gray-600 mt-2">Redirecting...</p>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="assembly-name">Assembly Name *</Label>
                                    <Input
                                        id="assembly-name"
                                        placeholder="e.g., Control Panel Kit"
                                        value={assemblyData.name}
                                        onChange={(e) => setAssemblyData({...assemblyData, name: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="assembly-part-number">Part Number *</Label>
                                    <Input
                                        id="assembly-part-number"
                                        placeholder="e.g., ASM-001"
                                        value={assemblyData.partNumber}
                                        onChange={(e) => setAssemblyData({...assemblyData, partNumber: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="assembly-category">Category *</Label>
                                    <Select 
                                        value={assemblyData.category} 
                                        onValueChange={(value) => setAssemblyData({...assemblyData, category: value})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="assembly-labor">Labor Cost ($)</Label>
                                    <Input
                                        id="assembly-labor"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={assemblyData.laborCost}
                                        onChange={(e) => setAssemblyData({...assemblyData, laborCost: e.target.value})}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Cost to assemble components</p>
                                </div>

                                <div className="border-t pt-3">
                                    <p className="text-sm font-semibold mb-2">Components ({cartItemsWithDetails.length}):</p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {cartItemsWithDetails.map(item => (
                                            <div key={item.id} className="text-xs bg-gray-50 p-2 rounded">
                                                {item.part_name} - Qty: {item.quantity || 1}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setShowAssemblyDialog(false)}
                                        disabled={isCreatingAssembly}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        onClick={handleCreateAssembly}
                                        disabled={isCreatingAssembly}
                                    >
                                        {isCreatingAssembly ? 'Creating...' : 'Create Assembly'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}