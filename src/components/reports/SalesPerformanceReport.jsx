import React, { useState, useEffect, useMemo } from 'react';
import { Machine, Part, Transaction } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { format } from '@/lib/dateUtils';
import { startOfMonth, startOfQuarter, startOfYear, subDays, startOfWeek, endOfWeek, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval, endOfMonth, endOfQuarter, endOfYear } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const ORDER_TYPE_LABELS = {
    on_site_service: 'Service',
    parts_order: 'Parts Order',
    sales_agreement: 'Sales Agreement',
    service_agreement: 'Service Agreement',
    no_charge: 'No Charge',
    warranty_replacement: 'Warranty Replacement',
    service_expense: 'Service Expense',
    shipping_expense: 'Shipping Expense',
};

export default function SalesPerformanceReport() {
    const [loading, setLoading] = useState(true);
    const [timePeriod, setTimePeriod] = useState('30days');
    const [transactions, setTransactions] = useState([]);
    const [parts, setParts] = useState([]);
    const [machines, setMachines] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                let fromDate;
                const toDate = new Date();
                
                switch (timePeriod) {
                    case '30days':
                        fromDate = subDays(toDate, 30);
                        break;
                    case 'month':
                        fromDate = startOfMonth(toDate);
                        break;
                    case 'quarter':
                        fromDate = startOfQuarter(toDate);
                        break;
                    case 'year':
                        fromDate = startOfYear(toDate);
                        break;
                    default:
                        fromDate = subDays(toDate, 30);
                }

                const dateFilter = {
                    $gte: ((fromDate) ? format(new Date(fromDate), 'yyyy-MM-dd') : '—'),
                    $lt: format(new Date(toDate.getTime() + 86400000), 'yyyy-MM-dd')
                };

                // No transaction_type filter: a part can be sold/used via ANY
                // transaction type (parts order, on-site service, sales/service
                // agreement, warranty replacement, no-charge, etc). What matters
                // is only whether revenue/cost was actually recorded, not what the
                // transaction was called.
                const [transData, partData, machineData] = await Promise.all([
                    Transaction.filter({ date: dateFilter }, '-date', 100000),
                    Part.list(),
                    Machine.list()
                ]);

                setTransactions(transData || []);
                setParts(partData || []);
                setMachines(machineData || []);
            } catch (error) {
                console.error("Failed to load sales data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [timePeriod]);

    const salesMetrics = useMemo(() => {
        const partMap = parts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        const machineMap = machines.reduce((acc, m) => ({ ...acc, [m.id]: m }), {});

        let totalRevenue = 0;
        let totalCost = 0;
        const byOrderType = {};
        const byMachineType = {};
        const dailySales = {};

        transactions.forEach(t => {
            const part = partMap[t.part_id];
            // transactions.quantity is a Postgres `numeric` column, returned as a
            // STRING by Supabase (to avoid float precision loss) -- parse it
            // explicitly rather than relying on `*` to silently coerce it.
            const quantity = Number(t.quantity) || 0;
            const revenue = part ? (part.sales_price || 0) * quantity : 0;
            const cost = part ? (part.cost || 0) * quantity : 0;

            totalRevenue += revenue;
            totalCost += cost;

            // By order type
            const orderType = ORDER_TYPE_LABELS[t.transaction_type] || t.transaction_type || 'Other';
            byOrderType[orderType] = (byOrderType[orderType] || 0) + revenue;

            // By machine type
            if (t.machine_id) {
                const machine = machineMap[t.machine_id];
                const machineType = machine?.machine_type || 'Unknown';
                byMachineType[machineType] = (byMachineType[machineType] || 0) + revenue;
            }

            // Daily sales for trend
            const dateKey = t.date;
            if (!dailySales[dateKey]) {
                dailySales[dateKey] = { date: dateKey, revenue: 0, cost: 0 };
            }
            dailySales[dateKey].revenue += revenue;
            dailySales[dateKey].cost += cost;
        });

        const grossProfit = totalRevenue - totalCost;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        return {
            totalRevenue,
            totalCost,
            grossProfit,
            profitMargin,
            // Count only transactions that actually recorded a part (line items sold/used),
            // not expense-tracking rows like service_expense/shipping_expense that opening
            // up the transaction-type filter now also pulls in.
            orderCount: transactions.filter(t => t.part_id).length,
            byOrderType: Object.entries(byOrderType).map(([name, value]) => ({ name, value })),
            byMachineType: Object.entries(byMachineType).map(([name, value]) => ({ name, value })),
            dailySales: Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date))
        };
    }, [transactions, parts, machines]);

    const periodComparisons = useMemo(() => {
        if (!transactions.length) return { weekly: [], monthly: [], quarterly: [] };

        const partMap = parts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        const today = new Date();

        // Weekly data for 30 days or This Month
        const weeklyData = [];
        if (timePeriod === '30days' || timePeriod === 'month') {
            const startDate = timePeriod === '30days' ? subDays(today, 30) : startOfMonth(today);
            const endDate = timePeriod === 'month' ? endOfMonth(today) : today;
            
            const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 0 });
            
            weeks.forEach(weekStart => {
                const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
                let revenue = 0;
                
                transactions.forEach(t => {
                    const tDate = new Date(t.date);
                    if (tDate >= weekStart && tDate <= weekEnd) {
                        const part = partMap[t.part_id];
                        revenue += part ? (part.sales_price || 0) * (Number(t.quantity) || 0) : 0;
                    }
                });
                
                weeklyData.push({
                    period: `${((weekStart) ? format(new Date(weekStart), 'MMM dd') : '—')} - ${((weekEnd) ? format(new Date(weekEnd), 'MMM dd') : '—')}`,
                    revenue
                });
            });
        }

        // Monthly data for This Quarter or This Year
        const monthlyData = [];
        if (timePeriod === 'quarter' || timePeriod === 'year') {
            const startDate = timePeriod === 'quarter' ? startOfQuarter(today) : startOfYear(today);
            const endDate = timePeriod === 'quarter' ? endOfQuarter(today) : endOfYear(today);
            
            const months = eachMonthOfInterval({ start: startDate, end: endDate });
            
            months.forEach(monthStart => {
                const monthEnd = endOfMonth(monthStart);
                let revenue = 0;
                
                transactions.forEach(t => {
                    const tDate = new Date(t.date);
                    if (tDate >= monthStart && tDate <= monthEnd) {
                        const part = partMap[t.part_id];
                        revenue += part ? (part.sales_price || 0) * (Number(t.quantity) || 0) : 0;
                    }
                });
                
                monthlyData.push({
                    period: ((monthStart) ? format(new Date(monthStart), 'MMM yyyy') : '—'),
                    revenue
                });
            });
        }

        // Quarterly data for This Year
        const quarterlyData = [];
        if (timePeriod === 'year') {
            const startDate = startOfYear(today);
            const endDate = endOfYear(today);
            
            const quarters = eachQuarterOfInterval({ start: startDate, end: endDate });
            
            quarters.forEach(quarterStart => {
                const quarterEnd = endOfQuarter(quarterStart);
                let revenue = 0;
                
                transactions.forEach(t => {
                    const tDate = new Date(t.date);
                    if (tDate >= quarterStart && tDate <= quarterEnd) {
                        const part = partMap[t.part_id];
                        revenue += part ? (part.sales_price || 0) * (Number(t.quantity) || 0) : 0;
                    }
                });
                
                quarterlyData.push({
                    period: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${((quarterStart) ? format(new Date(quarterStart), 'yyyy') : '—')}`,
                    revenue
                });
            });
        }

        return { weekly: weeklyData, monthly: monthlyData, quarterly: quarterlyData };
    }, [transactions, parts, timePeriod]);

    const revenueVsCostData = [
        { name: 'Revenue', value: salesMetrics.totalRevenue },
        { name: 'Cost', value: salesMetrics.totalCost },
        { name: 'Gross Profit', value: salesMetrics.grossProfit }
    ];

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Sales Performance</CardTitle>
                        <CardDescription>Comprehensive sales analytics and revenue insights.</CardDescription>
                    </div>
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="30days">Past 30 Days</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="quarter">This Quarter</SelectItem>
                            <SelectItem value="year">This Year</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="ml-3">Loading sales data...</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-blue-50 border-blue-200">
                                <CardContent className="p-4">
                                    <p className="text-sm text-gray-600">Total Revenue</p>
                                    <p className="text-2xl font-bold text-blue-700">${salesMetrics.totalRevenue.toFixed(2)}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-50 border-green-200">
                                <CardContent className="p-4">
                                    <p className="text-sm text-gray-600">Gross Profit</p>
                                    <p className="text-2xl font-bold text-green-700">${salesMetrics.grossProfit.toFixed(2)}</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-purple-50 border-purple-200">
                                <CardContent className="p-4">
                                    <p className="text-sm text-gray-600">Profit Margin</p>
                                    <p className="text-2xl font-bold text-purple-700">{salesMetrics.profitMargin.toFixed(1)}%</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-orange-50 border-orange-200">
                                <CardContent className="p-4">
                                    <p className="text-sm text-gray-600">Total Orders</p>
                                    <p className="text-2xl font-bold text-orange-700">{salesMetrics.orderCount}</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Revenue vs Cost vs Profit */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Revenue, Cost & Gross Profit</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={revenueVsCostData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                        <Bar dataKey="value" fill="#3b82f6">
                                            {revenueVsCostData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : index === 1 ? '#ef4444' : '#10b981'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Period Comparison Charts */}
                        {(timePeriod === '30days' || timePeriod === 'month') && periodComparisons.weekly.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Weekly Sales Comparison</CardTitle>
                                    <CardDescription>Revenue breakdown by week</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={periodComparisons.weekly}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="period" angle={-45} textAnchor="end" height={80} />
                                            <YAxis />
                                            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                            <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {timePeriod === 'quarter' && periodComparisons.monthly.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Monthly Sales Comparison</CardTitle>
                                    <CardDescription>Revenue breakdown by month</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={periodComparisons.monthly}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="period" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                            <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {timePeriod === 'year' && (
                            <>
                                {periodComparisons.quarterly.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Quarterly Sales Comparison</CardTitle>
                                            <CardDescription>Revenue breakdown by quarter</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={periodComparisons.quarterly}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="period" />
                                                    <YAxis />
                                                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                                    <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}

                                {periodComparisons.monthly.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Monthly Sales Comparison</CardTitle>
                                            <CardDescription>Revenue breakdown by month</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <LineChart data={periodComparisons.monthly}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="period" angle={-45} textAnchor="end" height={80} />
                                                    <YAxis />
                                                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="revenue" stroke="#f59e0b" name="Revenue" strokeWidth={2} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        )}

                        {/* Daily Sales Trend */}
                        {salesMetrics.dailySales.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Daily Sales Trend - Revenue & Cost</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={salesMetrics.dailySales}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} />
                                            <YAxis />
                                            <Tooltip 
                                                labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                                                formatter={(value) => `$${value.toFixed(2)}`}
                                            />
                                            <Legend />
                                            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="Revenue" strokeWidth={2} />
                                            <Line type="monotone" dataKey="cost" stroke="#ef4444" name="Cost" strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Sales by Order Type */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Sales by Order Type</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {salesMetrics.byOrderType.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={salesMetrics.byOrderType}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                    outerRadius={100}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {salesMetrics.byOrderType.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <p className="text-center text-gray-500 py-12">No order data available.</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Sales by Machine Type */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Sales by Machine Type</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {salesMetrics.byMachineType.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={salesMetrics.byMachineType}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                                                <YAxis />
                                                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                                                <Bar dataKey="value" fill="#10b981" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <p className="text-center text-gray-500 py-12">No machine-specific data available.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}