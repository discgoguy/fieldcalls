
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from 'date-fns';

export default function PurchaseOrderCard({ purchaseOrder, supplier, onClick }) {
    const statusColors = {
        Draft: "bg-gray-100 text-gray-800",
        Ordered: "bg-blue-100 text-blue-800",
        Complete: "bg-green-100 text-green-800",
    };

    const currencySymbol = purchaseOrder.currency === 'USD' ? '$' : '$'; // Assuming '$' for both USD and CAD based on the outline, often CAD is 'CA$' or 'C$'
    const currencyCode = purchaseOrder.currency || 'CAD';

    return (
        <Card onClick={onClick} className="cursor-pointer hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base font-bold">{purchaseOrder.po_number}</CardTitle>
                        <CardDescription>{supplier?.name || 'Unknown Supplier'}</CardDescription>
                    </div>
                    <Badge className={statusColors[purchaseOrder.status]}>{purchaseOrder.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-base">{currencySymbol}{(purchaseOrder.total_amount || 0).toFixed(2)} {currencyCode}</span>
                </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Payment</span>
                    <span className="font-medium">{purchaseOrder.payment_type}</span>
                </div>
            </CardContent>
            <CardFooter className="text-xs text-gray-500 bg-gray-50/50 p-3">
                Ordered: {format(new Date(purchaseOrder.order_date), 'MMM d, yyyy')}
            </CardFooter>
        </Card>
    );
}
