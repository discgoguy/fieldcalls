
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Package, User, CalendarDays } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

export default function TicketCard({ ticket, customerName, technicianName, onConvert, onCardClick }) {
    const urgencyColors = {
        Low: "bg-blue-100 text-blue-800",
        Medium: "bg-yellow-100 text-yellow-800",
        High: "bg-orange-100 text-orange-800",
        Critical: "bg-red-100 text-red-800",
    };

    const statusColors = {
        Open: "bg-green-100 text-green-800",
        "In Progress": "bg-indigo-100 text-indigo-800",
        Pending: "bg-yellow-100 text-yellow-800",
        Resolved: "bg-gray-500 text-white",
        Closed: "bg-gray-500 text-white"
    };

    // Helper function to ensure time is always shown in past tense
    const getTimeAgo = (date) => {
        const now = new Date();
        const createdDate = new Date(date);
        
        // If the date appears to be in the future (due to clock differences), treat it as "just now"
        if (createdDate > now) {
            return 'just now';
        }
        
        return formatDistanceToNow(createdDate, { addSuffix: true });
    };

    return (
        <div onClick={() => onCardClick(ticket)} className="cursor-pointer h-full">
            <Card className="flex flex-col h-full hover:shadow-lg transition-shadow duration-200">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-base font-bold">{ticket.subject}</CardTitle>
                            <CardDescription>{customerName}</CardDescription>
                        </div>
                        <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Ticket #</span>
                        <span className="font-medium">{ticket.ticket_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Urgency</span>
                        <Badge variant="secondary" className={urgencyColors[ticket.urgency]}>{ticket.urgency}</Badge>
                    </div>
                     <div className="flex items-center text-sm text-gray-500 justify-between">
                        <div className="flex items-center">
                           <CalendarDays className="h-4 w-4 mr-1.5" /> 
                           <span>Created:</span>
                        </div>
                        <span className="font-medium text-gray-800">{getTimeAgo(ticket.created_date)}</span>
                    </div>
                     {technicianName && (
                        <div className="flex items-center text-sm pt-2 border-t mt-2">
                            <User className="h-4 w-4 text-gray-500 mr-2" />
                            <span className="font-medium">{technicianName}</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-gray-50/50 p-2 space-x-2">
                    {ticket.ticket_type !== 'Parts Request' && (
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={(e) => { e.stopPropagation(); onConvert(ticket.id, 'service'); }}
                        >
                            <Wrench className="h-4 w-4 mr-2" /> Convert to Service
                        </Button>
                    )}
                    {ticket.ticket_type !== 'Repair Request' && ticket.ticket_type !== 'Quotation' && (
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={(e) => { e.stopPropagation(); onConvert(ticket.id, 'order'); }}
                        >
                            <Package className="h-4 w-4 mr-2" /> Convert to Order
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
