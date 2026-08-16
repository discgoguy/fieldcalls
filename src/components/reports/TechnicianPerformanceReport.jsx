import React, { useState, useEffect, useCallback } from 'react';
import { Setting, Technician, Transaction } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { format } from '@/lib/dateUtils';
import { subDays } from 'date-fns';

export default function TechnicianPerformanceReport() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });

    const generateReport = useCallback(async () => {
        setLoading(true);
        try {
            const dateFilter = {};
            if (dateRange.from) {
                dateFilter.$gte = ((dateRange.from) ? format(new Date(dateRange.from), 'yyyy-MM-dd') : '—');
            }
            if (dateRange.to) {
                const toDate = new Date(dateRange.to);
                toDate.setDate(toDate.getDate() + 1); // Move to start of next day
                dateFilter.$lt = ((toDate) ? format(new Date(toDate), 'yyyy-MM-dd') : '—'); // Use less than
            }

            const [transactions, technicians, techDisplaySetting] = await Promise.all([
                Transaction.filter({
                    transaction_type: { $in: ['on_site_service', 'service_expense'] },
                    date: dateFilter,
                }, '-created_date', 5000),
                Technician.list(),
                Setting.filter({ key: 'technician_display_defaults' })
            ]);

            const hideInactiveFromLists = techDisplaySetting && techDisplaySetting.length > 0
                ? JSON.parse(techDisplaySetting[0].value).hideInactiveFromLists !== false
                : true;
            const activeTechnicians = hideInactiveFromLists ? technicians.filter(t => t.active !== false) : technicians;

            const performance = activeTechnicians.reduce((acc, tech) => {
                acc[tech.id] = {
                    name: tech.full_name || `ID: ${tech.id.substring(0,5)}`,
                    service_calls: 0,
                    travel_hours: 0,
                    onsite_hours: 0,
                    total_hours: 0,
                    service_call_ids: new Set(),
                };
                return acc;
            }, {});

            (transactions || []).forEach(t => {
                const techIds = t.technician_ids || [];
                if (techIds.length === 0) return;

                // Add hours from 'service_expense' transactions
                // travel_hours/onsite_hours are Postgres `numeric` columns, returned
                // as STRINGS by Supabase -- must parse to a real number before
                // summing, or `+=` silently concatenates instead of adding.
                if (t.transaction_type === 'service_expense') {
                    techIds.forEach(techId => {
                        if (performance[techId]) {
                            performance[techId].travel_hours += Number(t.travel_hours) || 0;
                            performance[techId].onsite_hours += Number(t.onsite_hours) || 0;
                        }
                    });
                }
                
                // Count unique service calls from 'on_site_service' (parts) transactions
                if (t.transaction_type === 'on_site_service' && t.service_call_id) {
                    techIds.forEach(techId => {
                        if (performance[techId]) {
                            performance[techId].service_call_ids.add(t.service_call_id);
                        }
                    });
                }
            });
            
            const data = Object.values(performance).map(p => ({
                ...p,
                service_calls: p.service_call_ids.size,
                total_hours: p.travel_hours + p.onsite_hours,
            }))
            // **THE FIX:** Filter by total_hours OR service_calls. This ensures technicians with only hours logged (no parts) are included.
            .filter(p => p.total_hours > 0 || p.service_calls > 0)
             .sort((a,b) => b.total_hours - a.total_hours);

            setReportData(data);
        } catch (error) {
            console.error("Failed to generate technician report:", error);
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        if (dateRange.from && dateRange.to) {
            generateReport();
        }
    }, [generateReport, dateRange]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Technician Performance</CardTitle>
                        <CardDescription>Hours and service calls logged by each technician.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-80" />
                        <Button variant="outline" size="icon" onClick={generateReport} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /><span className="ml-3">Generating report...</span></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Technician</TableHead>
                                <TableHead className="text-center">Unique Service Calls</TableHead>
                                <TableHead className="text-center">Travel Hours</TableHead>
                                <TableHead className="text-center">On-Site Hours</TableHead>
                                <TableHead className="text-center">Total Hours</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell className="text-center">{row.service_calls}</TableCell>
                                    <TableCell className="text-center">{row.travel_hours.toFixed(1)}</TableCell>
                                    <TableCell className="text-center">{row.onsite_hours.toFixed(1)}</TableCell>
                                    <TableCell className="text-center font-bold">{row.total_hours.toFixed(1)}</TableCell>
                                </TableRow>
                            ))}
                             {reportData.length === 0 && <TableRow><TableCell colSpan="5" className="text-center">No data for this period.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}