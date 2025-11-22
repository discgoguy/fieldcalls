import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { subDays, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function MachinePartUseReport() {
    const [reportData, setReportData] = useState({});
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 365), to: new Date() });
    const [sortBy, setSortBy] = useState('totalQuantity');

    useEffect(() => {
        const generateReport = async () => {
            setLoading(true);
            try {
                const dateFilter = {};
                if (dateRange.from) {
                    dateFilter.$gte = format(dateRange.from, 'yyyy-MM-dd');
                }
                if (dateRange.to) {
                    const toDate = new Date(dateRange.to);
                    toDate.setDate(toDate.getDate() + 1);
                    dateFilter.$lt = format(toDate, 'yyyy-MM-dd');
                }

                const transactionFilter = await withTenantFilter({
                    transaction_type: { $in: ['on_site_service', 'parts_order'] },
                    date: dateFilter
                });
                const partFilter = await withTenantFilter();
                const machineFilter = await withTenantFilter();

                const [transactions, parts, machines] = await Promise.all([
                    base44.entities.Transaction.filter(transactionFilter),
                    base44.entities.Part.filter(partFilter),
                    base44.entities.Machine.filter(machineFilter)
                ]);

                const partMap = parts.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
                const machineMap = machines.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
                
                const usageByMachineType = {};

                transactions.forEach(t => {
                    if (t.part_id && t.machine_id && t.quantity > 0) {
                        const machine = machineMap[t.machine_id];
                        const part = partMap[t.part_id];

                        if (machine && part && machine.machine_type) {
                            const machineType = machine.machine_type;

                            if (!usageByMachineType[machineType]) {
                                usageByMachineType[machineType] = {};
                            }

                            if (!usageByMachineType[machineType][t.part_id]) {
                                usageByMachineType[machineType][t.part_id] = {
                                    partName: part.part_name,
                                    partNumber: part.part_number,
                                    totalQuantity: 0,
                                    totalValue: 0
                                };
                            }
                            usageByMachineType[machineType][t.part_id].totalQuantity += t.quantity;
                            const partValue = (part.sales_price || 0) * t.quantity;
                            usageByMachineType[machineType][t.part_id].totalValue += partValue;
                        }
                    }
                });

                const sortedData = {};
                for (const machineType in usageByMachineType) {
                    sortedData[machineType] = Object.values(usageByMachineType[machineType])
                        .sort((a, b) => {
                            if (sortBy === 'totalValue') {
                                return b.totalValue - a.totalValue;
                            }
                            return b.totalQuantity - a.totalQuantity;
                        });
                }

                setReportData(sortedData);
            } catch (error) {
                console.error("Failed to generate part usage report:", error);
            } finally {
                setLoading(false);
            }
        };

        if (dateRange.from && dateRange.to) {
            generateReport();
        }
    }, [dateRange, sortBy]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Part Consumption by Machine Type</CardTitle>
                        <CardDescription>Total parts used per machine type in the selected period.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Label htmlFor="sort-by" className="shrink-0">Sort by</Label>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger id="sort-by" className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Sort by..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="totalQuantity">Total Quantity</SelectItem>
                                    <SelectItem value="totalValue">Total Value</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-80" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /><span className="ml-3">Generating report...</span></div>
                ) : (
                    <div className="space-y-8">
                        {Object.keys(reportData).length > 0 ? (
                            Object.entries(reportData).map(([machineType, parts]) => (
                                <div key={machineType}>
                                    <h3 className="text-xl font-semibold mb-2 capitalize">{machineType}</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Part Name</TableHead>
                                                <TableHead>Part Number</TableHead>
                                                <TableHead className="text-right">Total Quantity Used</TableHead>
                                                <TableHead className="text-right">Total Value ($)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parts.map(part => (
                                                <TableRow key={part.partNumber}>
                                                    <TableCell>{part.partName}</TableCell>
                                                    <TableCell>{part.partNumber}</TableCell>
                                                    <TableCell className="text-right font-bold">{part.totalQuantity}</TableCell>
                                                    <TableCell className="text-right font-medium">${part.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-8">No part usage data found for the selected period.</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}