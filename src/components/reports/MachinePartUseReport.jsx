import React, { useState, useEffect } from 'react';
import { Machine, Part, Transaction, AssemblyComponent } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { format } from '@/lib/dateUtils';
import { subDays } from 'date-fns';
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
                    dateFilter.$gte = ((dateRange.from) ? format(new Date(dateRange.from), 'yyyy-MM-dd') : '—');
                }
                if (dateRange.to) {
                    const toDate = new Date(dateRange.to);
                    toDate.setDate(toDate.getDate() + 1);
                    dateFilter.$lt = ((toDate) ? format(new Date(toDate), 'yyyy-MM-dd') : '—');
                }

                // No transaction_type filter here either -- any transaction type
                // that recorded a part counts, including no-charge/warranty ones.
                const [transactions, parts, machines, assemblyComponents] = await Promise.all([
                    Transaction.filter({ date: dateFilter }, '-date', 100000),
                    Part.list(),
                    Machine.list(),
                    AssemblyComponent.list()
                ]);

                const partMap = parts.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
                const machineMap = machines.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});
                const componentsByAssembly = {};
                assemblyComponents.forEach(c => {
                    if (!componentsByAssembly[c.assembly_part_id]) componentsByAssembly[c.assembly_part_id] = [];
                    componentsByAssembly[c.assembly_part_id].push(c);
                });

                const usageByMachineType = {};

                const addUsage = (machineType, partId, qty, value) => {
                    const part = partMap[partId];
                    if (!part) return;
                    if (!usageByMachineType[machineType]) {
                        usageByMachineType[machineType] = {};
                    }
                    if (!usageByMachineType[machineType][partId]) {
                        usageByMachineType[machineType][partId] = {
                            partName: part.part_name,
                            partNumber: part.part_number,
                            totalQuantity: 0,
                            totalValue: 0
                        };
                    }
                    usageByMachineType[machineType][partId].totalQuantity += qty;
                    usageByMachineType[machineType][partId].totalValue += value;
                };

                transactions.forEach(t => {
                    // transactions.quantity is a Postgres `numeric` column, returned
                    // as a STRING by Supabase (to avoid float precision loss).
                    // `+=` on a string silently concatenates instead of adding --
                    // always parse to a real number before doing arithmetic on it.
                    const qty = Number(t.quantity);
                    if (!t.part_id || !qty) return;

                    const part = partMap[t.part_id];
                    if (!part) return;

                    // Determine machine type: from the assigned machine, or fall back to the part's
                    // compatible_machine_types if it has exactly one entry.
                    let machineType = null;
                    if (t.machine_id) {
                        const machine = machineMap[t.machine_id];
                        if (machine?.machine_type) {
                            machineType = machine.machine_type;
                        }
                    }
                    if (!machineType && part.compatible_machine_types?.length === 1) {
                        machineType = part.compatible_machine_types[0];
                    }
                    if (!machineType) return;

                    addUsage(machineType, t.part_id, qty, qty * (part.sales_price || 0));

                    // Spare Parts Kits (and any other assembly) sold as one line
                    // item don't otherwise credit their component parts -- explode
                    // into components so a part's usage total reflects units
                    // consumed via a kit too. Quantity only, not value, since the
                    // kit's own price already accounts for that revenue.
                    if (part.is_assembly) {
                        const components = componentsByAssembly[t.part_id] || [];
                        components.forEach(comp => {
                            addUsage(machineType, comp.component_part_id, qty * (Number(comp.quantity_required) || 1), 0);
                        });
                    }
                });

                // Convert to sorted array
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
                        <CardDescription>Total parts used per machine type in the selected period, across every transaction type. Parts consumed via a Spare Parts Kit sale are included.</CardDescription>
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
