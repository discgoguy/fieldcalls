import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { subDays, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TopPartsReport() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 90), to: new Date() });

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
                
                const [transactions, parts] = await Promise.all([
                    base44.entities.Transaction.filter(transactionFilter),
                    base44.entities.Part.filter(partFilter)
                ]);
                
                const partMap = parts.reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});

                const quantityByPart = transactions.reduce((acc, t) => {
                    if (t.part_id && t.quantity) {
                        acc[t.part_id] = (acc[t.part_id] || 0) + t.quantity;
                    }
                    return acc;
                }, {});

                const data = Object.entries(quantityByPart)
                    .map(([partId, totalQuantity]) => ({
                        name: partMap[partId]?.part_name || `ID: ${partId.substring(0,5)}`,
                        part_number: partMap[partId]?.part_number || 'N/A',
                        quantity: totalQuantity,
                    }))
                    .sort((a, b) => b.quantity - a.quantity);
                
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
    }, [dateRange]);

    const chartData = useMemo(() => reportData.slice(0, 10).reverse(), [reportData]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Top Parts Sold/Used</CardTitle>
                        <CardDescription>Ranking parts by total quantity used in service and orders.</CardDescription>
                    </div>
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-80" />
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
                                    <Bar dataKey="quantity" name="Total Quantity" fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Part Name</TableHead>
                                        <TableHead>Part Number</TableHead>
                                        <TableHead className="text-right">Total Quantity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell>{row.part_number}</TableCell>
                                            <TableCell className="text-right">{row.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                    {reportData.length === 0 && <TableRow><TableCell colSpan="3" className="text-center">No data for this period.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}