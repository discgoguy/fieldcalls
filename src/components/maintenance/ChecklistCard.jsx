import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Wrench } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
    'Scheduled': 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-yellow-100 text-yellow-800',
    'Completed': 'bg-green-100 text-green-800'
};

export default function ChecklistCard({ checklist, customer, machines, technicians, onClick }) {
    return (
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{checklist.checklist_number}</CardTitle>
                    <Badge className={STATUS_COLORS[checklist.status]}>{checklist.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <p className="font-medium text-gray-900">{customer?.company_name || 'Unknown Customer'}</p>
                <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {format(new Date(checklist.visit_date), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                    <Wrench className="h-4 w-4 mr-2" />
                    {machines.length} machine{machines.length !== 1 ? 's' : ''}
                </div>
                {technicians.length > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        {technicians.length} technician{technicians.length !== 1 ? 's' : ''}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}