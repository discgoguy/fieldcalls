import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DateRangePicker from './DateRangePicker';
import { subDays, format, parseISO, eachDayOfInterval, startOfDay } from 'date-fns';

export default function InventoryValueReport() {
    const [loading, setLoading] = useState(true);
    const [currentInventoryValue, setCurrentInventoryValue] = useState(0);
    const [historicalData, setHistoricalData] = useState([]);
    const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 90), to: new Date() });

    useEffect(() => {
        const generateReport = async () => {
            setLoading(true);
            try {
                const filter = await withTenantFilter();
                const parts = await base44.entities.Part.filter(filter);
                
                const currentValue = parts.reduce((sum, part) => {
                    const cost = part.cost || 0;
                    const quantity = part.quantity_in_inventory || 0;
                    return sum + (cost * quantity);
                }, 0);
                setCurrentInventoryValue(currentValue);

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
                    transaction_type: { $in: ['on_site_service', 'parts_order', 'inventory_addition'] },
                    date: dateFilter
                });

                const transactions = await base44.entities.Transaction.filter(transactionFilter, 'date', 10000);

                const partsMap = parts.reduce((acc, part) => {
                    acc[part.id] = { cost: part.cost || 0, currentQty: part.quantity_in_inventory || 0 };
                    return acc;
                }, {});

                const dates = eachDayOfInterval({
                    start: dateRange.from,
                    end: dateRange.to
                });

                const inventoryHistory = [];
                const currentInventory = { ...partsMap };
                
                const sortedTransactions = [...transactions].sort((a, b) => 
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                for (let i = dates.length - 1; i >= 0; i--) {
                    const date = dates[i];
                    const dateStr = format(date, 'yyyy-MM-dd');
                    
                    const dayTransactions = sortedTransactions.filter(t => 
                        format(parseISO(t.date), 'yyyy-MM-dd') === dateStr
                    );
                    
                    for (const trans of dayTransactions) {
                        if (trans.part_id && currentInventory[trans.part_id]) {
                            const qty = trans.quantity || 0;
                            
                            if (trans.transaction_type === 'inventory_addition') {
                                currentInventory[trans.part_id].currentQty -= qty;
                            } else if (trans.transaction_type === 'on_site_service' || trans.transaction_type === 'parts_order') {
                                currentInventory[trans.part_id].currentQty += qty;
                            }
                        }
                    }
                    
                    const dayValue = Object.values(currentInventory).reduce((sum, part) => {
                        return sum + (part.cost * Math.max(0, part.currentQty));
                    }, 0);
                    
                    inventoryHistory.unshift({
                        date: format(date, 'MMM d'),
                        fullDate: dateStr,
                        value: dayValue
                    });
                }

                setHistoricalData(inventoryHistory);

            } catch (error) {
                console.error("Failed to generate inventory value report:", error);
            } finally {
                setLoading(false);
            }
        };

        if (dateRange.from && dateRange.to) {
            generateReport();
        }
    }, [dateRange]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                    <p className="font-semibold">{payload[0].payload.date}</p>
                    <p className="text-blue-600 font-bold">
                        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <CardTitle>Inventory Value Report</CardTitle>
                        <CardDescription>Total value of all parts in stock based on cost price.</CardDescription>
                    </div>
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-80" />
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="ml-3">Calculating inventory value...</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                            <h3 className="text-lg font-semibold mb-2">Current Total Inventory Value</h3>
                            <p className="text-4xl font-bold">
                                ${currentInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-sm mt-2 text-blue-100">
                                Based on current stock quantities and cost prices
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4">Inventory Value Trend</h3>
                            <div className="h-96">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historicalData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis 
                                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            name="Inventory Value" 
                                            stroke="#3b82f6" 
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}