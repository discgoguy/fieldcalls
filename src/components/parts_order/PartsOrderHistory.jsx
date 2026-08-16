import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { History, Package, Printer, FileText } from 'lucide-react';
import { format } from '@/lib/dateUtils';

export default function PartsOrderHistory({ pastOrders, highlightOrderId, customers, parts, machines, technicians, onPrint }) {
    const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    if (highlightOrderId && pastOrders.length > 0) {
      const found = pastOrders.find(o => o.order_id === highlightOrderId);
      if (found) setSelectedOrder(found);
    }
  }, [highlightOrderId, pastOrders]);

    const getCustomer = (id) => customers.find(c => c.id === id);
    const getPart = (id) => parts.find(p => p.id === id);
    const getMachine = (id) => machines.find(m => m.id === id);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><History className="mr-2" />Parts Orders</CardTitle>
                    <CardDescription>Click an order to view details</CardDescription>
                </CardHeader>
                <CardContent>
                    {pastOrders.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                            <p>No parts orders found.</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {pastOrders.map(order => {
                                const customer = getCustomer(order.customer_id);
                                const isSelected = selectedOrder?.order_id === order.order_id;
                                return (
                                    <Card
                                        key={order.order_id}
                                        className={`cursor-pointer transition-colors hover:bg-blue-50 ${isSelected ? 'bg-blue-100 border-blue-400' : ''}`}
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono text-sm font-semibold text-blue-600">{order.order_id}</span>
                                                <span className="text-xs text-gray-500">{format(new Date(order.date), 'MMM dd, yyyy')}</span>
                                            </div>
                                            <p className="font-medium text-gray-900 text-sm">{customer?.company_name || 'Unknown'}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-gray-500">{order.parts.length} part{order.parts.length !== 1 ? 's' : ''}</span>
                                                {order.purchase_order_number && (
                                                    <Badge variant="outline" className="text-xs">PO: {order.purchase_order_number}</Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Order Details */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Order Details</CardTitle>
                    {selectedOrder && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => onPrint(selectedOrder, 'summary')}>
                                <FileText className="h-4 w-4 mr-1" />Summary
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onPrint(selectedOrder, 'packing')}>
                                <Printer className="h-4 w-4 mr-1" />Packing List
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {!selectedOrder ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>Select an order to view details</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                                <div>
                                    <Label className="text-xs text-gray-500">Order ID</Label>
                                    <p className="font-mono text-sm font-semibold">{selectedOrder.order_id}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Date</Label>
                                    <p className="font-medium">{format(new Date(selectedOrder.date), 'MMM dd, yyyy')}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Customer</Label>
                                    <p className="font-medium">{getCustomer(selectedOrder.customer_id)?.company_name || 'Unknown'}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-gray-500">Technician</Label>
                                    <p className="text-sm">{selectedOrder.technician_name || 'N/A'}</p>
                                </div>
                                {selectedOrder.purchase_order_number && (
                                    <div>
                                        <Label className="text-xs text-gray-500">Purchase Order #</Label>
                                        <p className="text-sm">{selectedOrder.purchase_order_number}</p>
                                    </div>
                                )}
                                {selectedOrder.shipment_method && (
                                    <div>
                                        <Label className="text-xs text-gray-500">Shipment Method</Label>
                                        <p className="text-sm">{selectedOrder.shipment_method}</p>
                                    </div>
                                )}
                                {selectedOrder.tracking_number && (
                                    <div className="col-span-2">
                                        <Label className="text-xs text-gray-500">Tracking #</Label>
                                        <p className="text-sm font-mono">{selectedOrder.tracking_number}</p>
                                    </div>
                                )}
                                {selectedOrder.shipping_cost > 0 && (
                                    <div>
                                        <Label className="text-xs text-gray-500">Shipping Cost</Label>
                                        <p className="text-sm">${selectedOrder.shipping_cost.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>

                            {selectedOrder.parts.length > 0 && (
                                <div>
                                    <Label className="text-sm font-semibold mb-2 block">Parts Ordered</Label>
                                    <div className="space-y-2">
                                        {selectedOrder.parts.map((part, idx) => {
                                            const partDetails = getPart(part.part_id);
                                            const machineDetails = getMachine(part.machine_id);
                                            return (
                                                <div key={idx} className="p-3 border rounded bg-white text-sm">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-medium">{partDetails?.part_name || 'Unknown Part'}</span>
                                                        <Badge variant="secondary">Qty: {part.quantity}</Badge>
                                                    </div>
                                                    <p className="text-xs text-gray-500">Part #: {partDetails?.part_number || 'N/A'}</p>
                                                    {machineDetails && (
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Machine: {machineDetails.model} (S/N: {machineDetails.serial_number})
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {selectedOrder.notes && (
                                <div>
                                    <Label className="text-sm font-semibold mb-2 block">Notes</Label>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-3 border rounded">{selectedOrder.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}