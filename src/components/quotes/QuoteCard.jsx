import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from 'date-fns';

export default function QuoteCard({ quote, customerName, onClick }) {
    const statusColors = {
        Draft: "bg-gray-100 text-gray-800",
        Sent: "bg-blue-100 text-blue-800",
        Accepted: "bg-green-100 text-green-800",
        Declined: "bg-red-100 text-red-800",
        Expired: "bg-yellow-100 text-yellow-800",
    };

    return (
        <Card onClick={onClick} className="cursor-pointer hover:shadow-lg transition-shadow duration-200 flex flex-col h-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base font-bold">{quote.subject}</CardTitle>
                        <CardDescription>{customerName}</CardDescription>
                    </div>
                    <Badge className={statusColors[quote.status]}>{quote.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Quote #</span>
                    <span className="font-medium">{quote.quote_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold text-base">${(quote.total_amount || 0).toFixed(2)}</span>
                </div>
            </CardContent>
            <CardFooter className="text-xs text-gray-500 bg-gray-50/50 p-2">
                <span>Created: {formatDistanceToNow(new Date(quote.created_date), { addSuffix: true })}</span>
                {quote.valid_until && <span> | Valid until: {format(new Date(quote.valid_until), 'MMM d, yyyy')}</span>}
            </CardFooter>
        </Card>
    );
}