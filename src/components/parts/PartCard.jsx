import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Package, Wrench, ShoppingCart, Star } from "lucide-react";

export default function PartCard({ part, onEdit, onBuild, onAddToCart, isInCart, onToggleFavorite, isFavorite }) {
    const getStockStatus = (part) => {
        // For assemblies, consider buildable quantity in addition to stock
        const effectiveStock = part.is_assembly 
            ? (part.quantity_in_inventory || 0) + (part.can_build || 0)
            : part.quantity_in_inventory;

        if (effectiveStock === 0) {
            if (part.on_order > 0) {
                return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Backordered</Badge>;
            }
            return <Badge variant="destructive">Out of Stock</Badge>;
        }
        if (effectiveStock <= (part.reorder_level || 5)) {
            return <Badge variant="destructive" className="bg-yellow-500 text-white hover:bg-yellow-600">Low Stock</Badge>;
        }
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">In Stock</Badge>;
    };

    return (
        <Card className="flex flex-col h-full overflow-hidden hover:shadow-xl transition-shadow duration-300 ease-in-out border-gray-200 rounded-lg relative">
            <Button
                variant="ghost"
                size="icon"
                className={`absolute top-2 left-2 z-10 ${isFavorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                onClick={() => onToggleFavorite && onToggleFavorite(part)}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                <Star className={`h-5 w-5 ${isFavorite ? 'fill-yellow-500' : ''}`} />
            </Button>
            {!part.is_internal && (
                <Button
                    variant="ghost"
                    size="icon"
                    className={`absolute top-2 right-2 z-10 ${isInCart ? 'bg-blue-100' : ''}`}
                    onClick={() => onAddToCart && onAddToCart(part)}
                    title={isInCart ? 'Remove from cart' : 'Add to cart'}
                >
                    <ShoppingCart className={`h-5 w-5 ${isInCart ? 'text-blue-600' : 'text-gray-400'}`} />
                </Button>
            )}
            <CardHeader className="p-4 pl-12 pr-12">
                <CardTitle className="text-lg leading-tight flex items-start justify-between gap-2" title={part.part_name}>
                    <span className="break-words">{part.part_name}</span>
                    <div className="flex gap-1 flex-shrink-0">
                        {part.is_obsolete && <Badge variant="secondary" className="ml-2 flex-shrink-0 bg-red-100 text-red-800">Obsolete</Badge>}
                        {part.is_assembly && <Badge variant="secondary" className="ml-2 flex-shrink-0">Assembly</Badge>}
                        {part.is_internal && <Badge variant="secondary" className="ml-2 flex-shrink-0 bg-orange-100 text-orange-800">Internal</Badge>}
                    </div>
                </CardTitle>
                <CardDescription className="truncate" title={part.part_number}>{part.part_number}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex-grow space-y-4">
                 <div className="flex justify-between items-center">
                    {part.is_internal ? (
                        <p className="text-sm text-orange-600 font-medium italic">Internal use only</p>
                    ) : (
                        <p className="text-3xl font-bold text-gray-900">${part.sales_price?.toFixed(2) ?? '0.00'}</p>
                    )}
                    <div className="text-right">
                        <p className="text-xl font-semibold">{part.quantity_in_inventory}</p>
                        <p className="text-xs text-gray-500">{part.is_assembly ? 'assembled' : 'in stock'}</p>
                    </div>
                </div>
                {part.is_assembly && part.can_build > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        <Package className="h-4 w-4" />
                        <span>{part.can_build} can be built</span>
                    </div>
                )}
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
            <CardFooter className="p-4 bg-gray-50/50 flex gap-2">
                 <Button variant="outline" className="flex-1" onClick={() => onEdit(part)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Details
                </Button>
                {part.is_assembly && part.can_build > 0 && onBuild && (
                    <Button variant="outline" className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => onBuild(part)}>
                        <Wrench className="h-4 w-4 mr-2" />
                        Build
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}