import React, { useState, useEffect, useMemo } from 'react';
import { Part, Transaction, AssemblyComponent } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { format } from '@/lib/dateUtils';
import { subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TopPartsReport() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 90), to: new Date() });
    const [metricType, setMetricType] = useState('quantity');

    useEffect(() => {
        const generateReport = async () => {
            setLoading(true);
            try {
                const dateFilter = {};
                if (dateRange.from) {
                    // Get the 'from' date formatted as 'YYYY-MM-DD' string.
                    dateFilter.$gte = ((dateRange.from) ? format(new Date(dateRange.from), 'yyyy-MM-dd') : '—');
                }
                if (dateRange.to) {
                    // To correctly include the entire 'to' day, we find the start of the next day.
                    // The filter will then be 'less than' this next day's start, formatted as 'YYYY-MM-DD'.
                    const toDate = new Date(dateRange.to);
                    toDate.setDate(toDate.getDate() + 1); // Increment by one day
                    dateFilter.$lt = ((toDate) ? format(new Date(toDate), 'yyyy-MM-dd') : '—'); // Get the ISO date string for the start of the next day
                }

                // No transaction_type filter: a part can be sold/used via ANY
                // transaction type (parts order, on-site service, sales/service
                // agreement, warranty replacement, no-charge, etc). What matters
                // is only whether a part was actually recorded on the line, not
                // what the transaction was called or whether anything was charged.
                const transactions = await Transaction.filter({ date: dateFilter }, '-date', 100000);
                const parts = await Part.list();
                const assemblyComponents = await AssemblyComponent.list();
                const partMap = parts.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});

                const componentsByAssembly = {};
                assemblyComponents.forEach(c => {
                    if (!componentsByAssembly[c.assembly_part_id]) componentsByAssembly[c.assembly_part_id] = [];
                    componentsByAssembly[c.assembly_part_id].push(c);
                });

                const partMetrics = {};
                const addQuantity = (partId, qty) => {
                    if (!partMetrics[partId]) partMetrics[partId] = { quantity: 0, value: 0 };
                    partMetrics[partId].quantity += qty;
                };

                transactions.forEach(t => {
                    // transactions.quantity is a Postgres `numeric` column, which
                    // Supabase returns as a STRING (to avoid float precision loss).
                    // `+=` on a string silently concatenates instead of adding --
                    // always parse to a real number before doing arithmetic on it.
                    const qty = Number(t.quantity);
                    if (!t.part_id || !qty) return;

                    addQuantity(t.part_id, qty);

                    const part = partMap[t.part_id];
                    const unitPrice = part?.sales_price || 0;
                    partMetrics[t.part_id].value += qty * unitPrice;

                    // Spare Parts Kits (and any other assembly) sold as a single
                    // line item don't otherwise credit their component parts at
                    // all -- explode the sale into each component so a part's
                    // true usage total includes units consumed via a kit, not
                    // just units sold on their own. Only quantity is attributed
                    // this way, not value, since the kit's own price already
                    // accounts for the revenue -- crediting value again here
                    // would double-count it.
                    if (part?.is_assembly) {
                        const components = componentsByAssembly[t.part_id] || [];
                        components.forEach(comp => {
                            addQuantity(comp.component_part_id, qty * (Number(comp.quantity_required) || 1));
                        });
                    }
                });

                const data = Object.entries(partMetrics)
                    .map(([partId, metrics]) => ({
                        name: partMap[partId]?.part_name || `ID: ${partId.substring(0,5)}`,
                        part_number: partMap[partId]?.part_number || 'N/A',
                        quantity: metrics.quantity,
                        value: metrics.value,
                    }))
                    .sort((a, b) => metricType === 'quantity' ? b.quantity - a.quantity : b.value - a.value);
                
                setReportData(data);
            } catch (error) {
                console.error("Failed to generate top parts report:", error);
            } finally {
                setLoading(false);
            }
        };

        if (dateRange.from && dateRange.to) {
            generateReport();
        }
    }, [dateRange, metricType]);

    const chartData = useMemo(() => reportData.slice(0, 10).reverse(), [reportData]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Top Parts Sold/Used</CardTitle>
                        <CardDescription>
                            Ranking parts by {metricType === 'quantity' ? 'total quantity' : 'total value'}, across every transaction type. Parts consumed via a Spare Parts Kit sale are included in that part's total.
                        </CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Select value={metricType} onValueChange={setMetricType}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="quantity">By Quantity</SelectItem>
                                <SelectItem value="value">By Value</SelectItem>
                            </SelectContent>
                        </Select>
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-80" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /><span className="ml-3">Generating report...</span></div>
                ) : (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="h-96">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }}/>
                                    <Tooltip />
                                    <Legend />
                                    {metricType === 'quantity' ? (
                                        <Bar dataKey="quantity" name="Total Quantity" fill="#3b82f6" />
                                    ) : (
                                        <Bar dataKey="value" name="Total Value ($)" fill="#10b981" />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Part Name</TableHead>
                                        <TableHead>Part Number</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                        <TableHead className="text-right">Total Value</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell>{row.part_number}</TableCell>
                                            <TableCell className="text-right">{row.quantity}</TableCell>
                                            <TableCell className="text-right">${row.value.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {reportData.length === 0 && <TableRow><TableCell colSpan="4" className="text-center">No data for this period.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
