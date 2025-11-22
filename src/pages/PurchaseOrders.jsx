
import React, { useState, useEffect, useCallback } from 'react';
import { PurchaseOrder } from '@/entities/PurchaseOrder';
import { PurchaseOrderItem } from '@/entities/PurchaseOrderItem';
import { Supplier } from '@/entities/Supplier';
import { Part } from '@/entities/Part';
import { Category } from '@/entities/Category';
import { Setting } from '@/entities/Setting';
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Plus, ShoppingCart, CheckCircle, AlertTriangle } from 'lucide-react';

import PurchaseOrderForm from '../components/purchase_orders/PurchaseOrderForm';
import PurchaseOrderCard from '../components/purchase_orders/PurchaseOrderCard';
import PurchaseOrderOrderDetail from '../components/purchase_orders/PurchaseOrderDetail';

export default function PurchaseOrdersPage() {
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [exchangeRate, setExchangeRate] = useState(1.35);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);
    const [editingPO, setEditingPO] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const tenantFilter = await withTenantFilter(); // Get the tenant filter
            const [poData, supplierData, partData, categoryData, settingsData] = await Promise.all([
                PurchaseOrder.filter(tenantFilter, '-created_date'), // Apply filter
                Supplier.filter(tenantFilter), // Apply filter
                Part.filter(tenantFilter), // Apply filter
                Category.filter(tenantFilter), // Apply filter
                Setting.filter({ ...tenantFilter, key: "usd_cad_exchange_rate" }), // Apply filter for settings
            ]);
            setPurchaseOrders(poData || []);
            const sortedSuppliers = (supplierData || []).sort((a, b) => a.name.localeCompare(b.name));
            setSuppliers(sortedSuppliers);
            setParts(partData || []);
            setCategories(categoryData || []);
            if (settingsData && settingsData.length > 0) {
                setExchangeRate(parseFloat(settingsData[0].value) || 1.35);
            }
        } catch (e) {
            setError('Failed to load data. Please refresh the page.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSavePO = async (poData, items) => {
        try {
            if (editingPO) {
                // UPDATE
                // PoData might not inherently have tenant_id if it's derived from form.
                // Assuming backend update handles tenant_id verification based on editingPO.id
                await PurchaseOrder.update(editingPO.id, poData);
                
                // Easiest way to handle item changes: delete old, create new
                const oldItemIds = editingPO.items.map(item => item.id);
                await Promise.all(oldItemIds.map(id => PurchaseOrderItem.delete(id)));

                // New items need tenant_id
                const newPoItemsWithTenant = await Promise.all(
                    items.map(item => addTenantId({ ...item, purchase_order_id: editingPO.id }))
                );
                await PurchaseOrderItem.bulkCreate(newPoItemsWithTenant);
                
                setSuccess('Purchase Order updated successfully!');
                setEditingPO(null);

            } else {
                // CREATE
                const supplier = suppliers.find(s => s.id === poData.supplier_id);
                const currency = supplier?.is_usd ? "USD" : "CAD";

                const tenantFilter = await withTenantFilter();
                const lastPO = await PurchaseOrder.filter(tenantFilter, '-created_date', 1); // Get last PO for current tenant
                const lastNum = lastPO.length > 0 ? parseInt(lastPO[0].po_number.split('-')[1]) : 0;
                const newPoNumber = `CS-${(lastNum + 1).toString().padStart(6, '0')}`;
                
                const finalPoData = await addTenantId({ // Add tenant_id to new PO
                    ...poData, 
                    po_number: newPoNumber,
                    currency: currency,
                    exchange_rate: currency === "USD" ? exchangeRate : null,
                });

                const newPO = await PurchaseOrder.create(finalPoData);
                // Items for new PO also need tenant_id
                const poItemsWithTenant = await Promise.all(
                    items.map(item => addTenantId({ ...item, purchase_order_id: newPO.id }))
                );
                await PurchaseOrderItem.bulkCreate(poItemsWithTenant);
                
                setSuccess('Purchase Order created successfully!');
            }
            
            setIsFormOpen(false);
            await loadData();
            setTimeout(() => setSuccess(''), 5000);
            return true;
        } catch (e) {
            console.error(e);
            return e.message || 'An unexpected error occurred.';
        }
    };
    
    const handlePOClick = async (po) => {
        try {
            const tenantFilter = await withTenantFilter();
            const items = await PurchaseOrderItem.filter({ ...tenantFilter, purchase_order_id: po.id }); // Apply tenant filter
            setSelectedPO({ ...po, items });
            setIsDetailOpen(true);
        } catch (e) {
            setError('Failed to load purchase order details.');
        }
    };

    const handleUpdate = async () => {
        setSuccess('Update successful!');
        await loadData();
        // Refetch the selected PO to show updated details
        if (selectedPO) {
            const updatedPO = await PurchaseOrder.get(selectedPO.id); // Assuming get by ID handles tenant context
            const tenantFilter = await withTenantFilter();
            const updatedItems = await PurchaseOrderItem.filter({ ...tenantFilter, purchase_order_id: selectedPO.id }); // Apply tenant filter
            setSelectedPO({ ...updatedPO, items: updatedItems });
        }
        setTimeout(() => setSuccess(''), 4000);
    };

    const handleEditRequest = () => {
        if (!selectedPO) return;
        setEditingPO(selectedPO);
        setIsDetailOpen(false); // Close detail view
        setIsFormOpen(true);    // Open form view
    };

    const supplierMap = suppliers.reduce((acc, s) => ({ ...acc, [s.id]: s }), {});
    
    const activePOs = purchaseOrders.filter(po => po.status !== 'Complete');
    const completedPOs = purchaseOrders.filter(po => po.status === 'Complete');

    const renderPOList = (data) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.length > 0 ? data.map(po => (
                <PurchaseOrderCard
                    key={po.id}
                    purchaseOrder={po}
                    supplier={supplierMap[po.supplier_id]}
                    onClick={() => handlePOClick(po)}
                />
            )) : <p className="col-span-full text-center text-gray-500 py-8">No purchase orders in this category.</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <ShoppingCart className="mr-3 h-8 w-8" />
                    Purchase Orders
                </h1>
                <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
                    setIsFormOpen(isOpen);
                    if (!isOpen) {
                        setEditingPO(null);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" />New Purchase Order</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl w-full">
                        <DialogHeader>
                            <DialogTitle>{editingPO ? 'Edit Purchase Order' : 'Create New Purchase Order'}</DialogTitle>
                        </DialogHeader>
                        <PurchaseOrderForm
                            initialData={editingPO}
                            suppliers={suppliers}
                            parts={parts}
                            categories={categories}
                            onSubmit={handleSavePO}
                            exchangeRate={exchangeRate}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {success && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertTitle>Success</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}
            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : (
                <Tabs defaultValue="active">
                    <TabsList>
                        <TabsTrigger value="active">Active ({activePOs.length})</TabsTrigger>
                        <TabsTrigger value="completed">Completed ({completedPOs.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="active" className="pt-4">{renderPOList(activePOs)}</TabsContent>
                    <TabsContent value="completed" className="pt-4">{renderPOList(completedPOs)}</TabsContent>
                </Tabs>
            )}

            {selectedPO && (
                <PurchaseOrderOrderDetail
                    purchaseOrder={selectedPO}
                    supplier={suppliers.find(s => s.id === selectedPO.supplier_id)}
                    parts={parts}
                    isOpen={isDetailOpen}
                    onOpenChange={setIsDetailOpen}
                    onUpdate={handleUpdate}
                    onEdit={handleEditRequest}
                />
            )}
        </div>
    );
}
