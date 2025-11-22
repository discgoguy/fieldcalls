import React, { useState, useEffect } from "react";
import { Transaction } from "@/entities/Transaction";
import { Customer } from "@/entities/Customer";
import { Part } from "@/entities/Part";
import { Machine } from "@/entities/Machine";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, History, Printer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PackingList from "../components/PackingList";
import { format } from 'date-fns';

export default function PastOrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [orderToPrint, setOrderToPrint] = useState(null);

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const transactions = await Transaction.filter({ 
                    transaction_type: { $in: ["parts_order", "shipping_expense"] } 
                }, "-date");

                if (!transactions || transactions.length === 0) {
                    setOrders([]);
                    setLoading(false);
                    return;
                }

                const groupedByOrderId = transactions.reduce((acc, t) => {
                    if (!t.order_id) return acc;
                    if (!acc[t.order_id]) {
                        acc[t.order_id] = [];
                    }
                    acc[t.order_id].push(t);
                    return acc;
                }, {});
                
                const customerIds = [...new Set(transactions.map(t => t.customer_id).filter(Boolean))];
                const customersData = customerIds.length > 0 ? await Customer.filter({ id: { $in: customerIds }}) : [];
                const customerMap = customersData.reduce((acc, c) => ({...acc, [c.id]: c}), {});

                const processedOrders = Object.values(groupedByOrderId).map(group => {
                    const mainRecord = group.find(t => t.transaction_type === 'shipping_expense') || group[0];
                    return {
                        order_id: mainRecord.order_id,
                        customer_id: mainRecord.customer_id,
                        customer_name: customerMap[mainRecord.customer_id]?.company_name || "N/A",
                        date: mainRecord.date,
                        purchase_order_number: mainRecord.purchase_order_number,
                        total_cost: group.reduce((sum, t) => sum + (t.total_cost || 0), 0),
                        transactions: group,
                    };
                });
                
                setOrders(processedOrders);

            } catch (err) {
                setError("Failed to load past orders. Please try again.");
                console.error(err);
            }
            setLoading(false);
        };

        fetchOrders();
    }, []);
    
    useEffect(() => {
        if (orderToPrint) {
            // Delay printing slightly to ensure state update and re-render
            setTimeout(() => {
                window.print();
                setOrderToPrint(null); // Reset after printing
            }, 100);
        }
    }, [orderToPrint]);

    const handleReprint = async (order) => {
        try {
            const customer = await Customer.get(order.customer_id);
            const shippingTransaction = order.transactions.find(t => t.transaction_type === 'shipping_expense') || {};
            
            const partTransactions = order.transactions.filter(t => t.transaction_type === 'parts_order');
            const partIds = partTransactions.map(t => t.part_id);
            const machineIds = partTransactions.map(t => t.machine_id).filter(Boolean);

            const [partsData, machinesData] = await Promise.all([
                partIds.length > 0 ? Part.filter({ id: { $in: partIds } }) : Promise.resolve([]),
                machineIds.length > 0 ? Machine.filter({ id: { $in: machineIds } }) : Promise.resolve([]),
            ]);

            const partMap = partsData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            const machineMap = machinesData.reduce((acc, m) => ({ ...acc, [m.id]: m }), {});
            
            const partsForPackingList = partTransactions.map(t => {
                const partDetails = partMap[t.part_id];
                const machineDetails = machineMap[t.machine_id];
                return {
                    part_name: partDetails?.part_name || "N/A",
                    part_number: partDetails?.part_number || "N/A",
                    machine_model: machineDetails?.model || "N/A",
                    quantity: t.quantity
                };
            });

            setOrderToPrint({
                customer: customer,
                orderData: {
                    date: order.date,
                    purchase_order_number: order.purchase_order_number,
                    shipment_method: shippingTransaction.shipment_method,
                    tracking_number: shippingTransaction.tracking_number,
                    notes: shippingTransaction.notes || partTransactions[0]?.notes
                },
                parts: partsForPackingList
            });

        } catch (err) {
            setError("Failed to prepare packing list data.");
            console.error(err);
        }
    };

    return (
        <>
            <div className="print:hidden">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><History className="mr-2" />Past Orders</CardTitle>
                        <CardDescription>View and reprint packing lists for previous parts orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
                        ) : error ? (
                            <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Order ID</TableHead>
                                        <TableHead className="text-right">Total Cost</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.length > 0 ? orders.map(order => (
                                        <TableRow key={order.order_id}>
                                            <TableCell>{format(new Date(order.date), 'MM/dd/yyyy')}</TableCell>
                                            <TableCell>{order.customer_name}</TableCell>
                                            <TableCell>{order.purchase_order_number || "N/A"}</TableCell>
                                            <TableCell className="font-mono text-xs">{order.order_id}</TableCell>
                                            <TableCell className="text-right">${order.total_cost.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => handleReprint(order)}>
                                                    <Printer className="h-4 w-4 mr-2" />
                                                    Reprint
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan="6" className="text-center h-24">No past orders found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <div className="hidden print:block">
                {orderToPrint && <PackingList order={orderToPrint} />}
            </div>

            <style>{`
                @media print {
                  body * { visibility: hidden; }
                  .print-container, .print-container * { visibility: visible; }
                  .print-container { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </>
    );
}