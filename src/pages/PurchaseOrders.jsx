import React, { useState, useEffect, useCallback } from 'react';
import { Category, Part, PurchaseOrder, PurchaseOrderItem, Setting, Supplier } from '@/api/entities';
import posthog from '@/lib/posthog';
import { sortArray, parseSortValue } from '@/components/utils/sortUtils';

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
    const [cartPreFill, setCartPreFill] = useState(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [poData, supplierData, partData, categoryData, settingsData, sortSettings] = await Promise.all([
                PurchaseOrder.list(),
                Supplier.list(),
                Part.list(),
                Category.list(),
                Setting.filter({ key: "usd_cad_exchange_rate" }),
                Setting.filter({ key: 'default_sort_settings' })
            ]);
            
            // Apply sorting
            let sortedPOs = poData || [];
            if (sortSettings && sortSettings.length > 0) {
                const settings = JSON.parse(sortSettings[0].value);
                const sortValue = settings.purchaseOrders || 'created_date_desc';
                sortedPOs = sortArray(sortedPOs, sortValue);
            } else {
                sortedPOs = sortArray(sortedPOs, 'created_date_desc');
            }
            
            setPurchaseOrders(sortedPOs);
            const sortedSuppliers = (supplierData || []).sort((a, b) => a.name.localeCompare(b.name));
            setSuppliers(sortedSuppliers);
            setParts(partData || []);
            setCategories(categoryData || []);
            if (settingsData && settingsData.length > 0) {
                setExchangeRate(parseFloat(settingsData[0].value) || 1.35);
            }
            setDataLoaded(true);
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

    // Separate useEffect to handle cart data AFTER data is loaded
    useEffect(() => {
        if (!dataLoaded || parts.length === 0 || suppliers.length === 0) return;
        
        const urlParams = new URLSearchParams(window.location.search);
        const fromCart = urlParams.get('fromCart');
        if (fromCart) {
            const cartData = sessionStorage.getItem('partsCartData');
            if (cartData) {
                const parsedCart = JSON.parse(cartData);
                
                // Detect supplier from first part
                let detectedSupplierId = '';
                if (parsedCart.length > 0) {
                    const firstPart = parts.find(p => p.id === parsedCart[0].partId);
                    if (firstPart && firstPart.supplier) {
                        const supplier = suppliers.find(s => s.name === firstPart.supplier);
                        if (supplier) {
                            detectedSupplierId = supplier.id;
                        }
                    }
                }
                
                setCartPreFill({
                    supplier_id: detectedSupplierId,
                    order_date: new Date().toISOString().split('T')[0],
                    payment_type: 'Net 30',
                    shipping_method: 'Ground',
                    approved_by_user_name: '',
                    tax_rate: 0,
                    notes: '',
                    items: parsedCart.map(item => {
                        const part = parts.find(p => p.id === item.partId);
                        const supplier = suppliers.find(s => s.id === detectedSupplierId);
                        const isUsd = supplier?.is_usd;
                        return {
                            part_id: item.partId,
                            quantity_ordered: item.quantity || 1,
                            unit_cost: part?.is_pack && part?.cost_per_pack
                                ? part.cost_per_pack
                                : (part ? (isUsd ? (part.cost_usd || part.cost || 0) : (part.cost || 0)) : 0),
                            category: 'all'
                        };
                    })
                });
                setIsFormOpen(true);
                sessionStorage.removeItem('partsCartData');
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
    }, [dataLoaded, parts, suppliers]);

    const handleSavePO = async (poData, items) => {
        try {
            if (editingPO) {
                // UPDATE
                await PurchaseOrder.update(editingPO.id, poData);

                // Easiest way to handle item changes: delete old, create new
                const oldItemIds = (editingPO.items || []).map(item => item.id);
                await Promise.all(oldItemIds.map(id => PurchaseOrderItem.delete(id)));

                const newPoItems = items.map(item => ({ ...item, purchase_order_id: editingPO.id }));
                await PurchaseOrderItem.bulkCreate(newPoItems);
                posthog.capture('purchase order updated', {
                  po_id: editingPO.id,
                  po_number: editingPO.po_number,
                  supplier_id: poData.supplier_id,
                  item_count: items.length,
                });

                setSuccess('Purchase Order updated successfully!');
                setEditingPO(null);

            } else {
                // CREATE
                const supplier = suppliers.find(s => s.id === poData.supplier_id);
                const currency = supplier?.is_usd ? "USD" : "CAD";

                // Scan recent POs to find the TRUE highest number to avoid duplicates
                const recentPOs = await PurchaseOrder.list('-created_date', 100);
                
                let maxPoNum = 0;
                if (recentPOs && recentPOs.length > 0) {
                    recentPOs.forEach(po => {
                        if (po.po_number && po.po_number.startsWith('CS-')) {
                            const parts = po.po_number.split('-');
                            if (parts.length === 2) {
                                const num = parseInt(parts[1]);
                                if (!isNaN(num) && num > maxPoNum) {
                                    maxPoNum = num;
                                }
                            }
                        }
                    });
                }
                
                const newPoNumber = `CS-${(maxPoNum + 1).toString().padStart(6, '0')}`;
                
                const finalPoData = { 
                    ...poData, 
                    po_number: newPoNumber,
                    currency: currency,
                    exchange_rate: currency === "USD" ? exchangeRate : null,
                };

                const newPO = await PurchaseOrder.create(finalPoData);
                const poItems = items.map(item => ({ ...item, purchase_order_id: newPO.id }));
                await PurchaseOrderItem.bulkCreate(poItems);
                posthog.capture('purchase order created', {
                  po_number: newPoNumber,
                  supplier_id: poData.supplier_id,
                  currency: currency,
                  item_count: items.length,
                });

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
            const items = await PurchaseOrderItem.filter({ purchase_order_id: po.id });
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
            const updatedPO = await PurchaseOrder.get(selectedPO.id);
            const updatedItems = await PurchaseOrderItem.filter({ purchase_order_id: selectedPO.id });
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
    
    // Maintain sort order after filtering
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
        <div className="space-y-6 print:hidden">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <ShoppingCart className="mr-3 h-8 w-8" />
                    Purchase Orders
                </h1>
                <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
                    setIsFormOpen(isOpen);
                    if (!isOpen) {
                        setEditingPO(null);
                        setCartPreFill(null);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" />New Purchase Order</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl w-full">
                        <DialogHeader>
                            <DialogTitle>{editingPO ? 'Edit Purchase Order' : 'Create New Purchase Order'}</DialogTitle>
                        </DialogHeader>
                        {parts.length > 0 && suppliers.length > 0 ? (
                            <PurchaseOrderForm
                                initialData={editingPO || cartPreFill}
                                suppliers={suppliers}
                                parts={parts}
                                categories={categories}
                                onSubmit={handleSavePO}
                                exchangeRate={exchangeRate}
                            />
                        ) : (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <span className="ml-3">Loading form data...</span>
                            </div>
                        )}
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