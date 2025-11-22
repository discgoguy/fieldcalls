import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DateRangePicker from './DateRangePicker';
import { subDays, format } from 'date-fns';

export default function CustomerValueReport() {
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

                const filter = await withTenantFilter({ date: dateFilter });
                const customerFilter = await withTenantFilter();
                
                const [transactions, customers] = await Promise.all([
                    base44.entities.Transaction.filter(filter),
                    base44.entities.Customer.filter(customerFilter)
                ]);
                
                const customerMap = customers.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.company_name }), {});

                const valueByCustomer = transactions.reduce((acc, t) => {
                    if (t.customer_id && t.total_cost) {
                        acc[t.customer_id] = (acc[t.customer_id] || 0) + t.total_cost;
                    }
                    return acc;
                }, {});

                const data = Object.entries(valueByCustomer)
                    .map(([customerId, totalValue]) => ({
                        name: customerMap[customerId] || `ID: ${customerId.substring(0, 5)}...`,
                        value: totalValue,
                    }))
                    .sort((a, b) => b.value - a.value);
                
                setReportData(data);
            } catch (error) {
                console.error("Failed to generate customer value report:", error);
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
                        <CardTitle>Top Customers by Revenue</CardTitle>
                        <CardDescription>Ranking customers by total transaction value in the selected period.</CardDescription>
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
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                    <Legend />
                                    <Bar dataKey="value" name="Total Revenue" fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead className="text-right">Total Revenue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map((row, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell className="text-right">${row.value.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {reportData.length === 0 && <TableRow><TableCell colSpan="2" className="text-center">No data for this period.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}