import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Package } from "lucide-react";

export default function PartCard({ part, onEdit }) {
    const getStockStatus = (part) => {
        if (part.quantity_in_inventory === 0) {
            if (part.on_order > 0) {
                return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Backordered</Badge>;
            }
            return <Badge variant="destructive">Out of Stock</Badge>;
        }
        if (part.quantity_in_inventory <= (part.reorder_level || 5)) {
            return <Badge variant="destructive" className="bg-yellow-500 text-white hover:bg-yellow-600">Low Stock</Badge>;
        }
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">In Stock</Badge>;
    };

    return (
        <Card className="flex flex-col h-full overflow-hidden hover:shadow-xl transition-shadow duration-300 ease-in-out border-gray-200 rounded-lg">
            <CardHeader className="p-4">
                <CardTitle className="text-lg leading-tight flex items-center justify-between" title={part.part_name}>
                    <span className="truncate">{part.part_name}</span>
                    {part.is_assembly && <Badge variant="secondary" className="ml-2 flex-shrink-0">Assembly</Badge>}
                </CardTitle>
                <CardDescription className="truncate" title={part.part_number}>{part.part_number}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-grow space-y-4">
                 <div className="flex justify-between items-center">
                    <p className="text-3xl font-bold text-gray-900">${part.sales_price?.toFixed(2) ?? '0.00'}</p>
                    <div className="text-right">
                        <p className="text-xl font-semibold">{part.quantity_in_inventory}</p>
                        <p className="text-xs text-gray-500">{part.is_assembly ? 'available' : 'in stock'}</p>
                    </div>
                </div>
                {part.on_order > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        <Package className="h-4 w-4" />
                        <span>{part.on_order} on order</span>
                    </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    {getStockStatus(part)}
                    <Badge variant="outline">{part.category}</Badge>
                </div>
            </CardContent>
            <CardFooter className="p-4 bg-gray-50/50">
                 <Button variant="outline" className="w-full" onClick={() => onEdit(part)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Details
                </Button>
            </CardFooter>
        </Card>
    );
}