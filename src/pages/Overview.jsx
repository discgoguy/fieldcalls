import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabaseClient';
import { Customer, Part, PurchaseOrder, PurchaseOrderItem, Ticket, Transaction } from '@/api/entities';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wrench, Package, Search, Warehouse, Activity, AlertTriangle, ClipboardCheck, FileText, ShoppingCart, ClipboardList, BarChart3 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from '@/lib/dateUtils';
import { subDays } from 'date-fns';

const ActionCard = ({ title, description, icon: Icon, href, pageName, badge }) => (
    <Card className="hover:bg-gray-50 hover:shadow-lg transition-all duration-200 relative">
        <Link to={createPageUrl(pageName)} className="block p-6 h-full">
            <div className="flex flex-col items-center text-center">
                <Icon className="w-10 h-10 mb-3 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-tight">{description}</p>
            </div>
            {badge > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                    {badge}
                </div>
            )}
        </Link>
    </Card>
);

export default function Overview() {
    const [lowStockParts, setLowStockParts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [salesData, setSalesData] = useState([]);
    const [activeTicketCount, setActiveTicketCount] = useState(0);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // Generate sample sales data as fallback
    const generateSampleSalesData = () => {
        const data = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = subDays(today, i);
            data.push({
                name: ((date) ? format(new Date(date), 'MMM d') : '—'),
                sales: 0
            });
        }
        return data;
    };

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const user = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
                if (user?.is_customer) {
                    navigate(createPageUrl('CustomerPortal'));
                    return;
                }
            } catch (e) {
                // Ignore auth errors here, layout handles login check usually
            }

            setSalesData(generateSampleSalesData()); // Set fallback immediately
            setError("");

            // Load active tickets count
            (async () => {
                try {
                    const tickets = await Ticket.filter({ status: { $in: ['Open', 'In Progress'] } });
                    setActiveTicketCount(tickets?.length || 0);
                } catch (e) {
                    console.log("Failed to load tickets for dashboard:", e);
                }
            })();

            // Load low-stock favourite parts (excluding assemblies and parts on order)
            (async () => {
                try {
                    const [parts, activePOs, poItems] = await Promise.all([
                        Part.list(),
                        PurchaseOrder.filter({ status: { $ne: 'Complete' } }),
                        PurchaseOrderItem.list()
                    ]);
                    const activePOIds = new Set((activePOs || []).map(po => po.id));
                    const partsOnOrder = new Set(
                        (poItems || [])
                            .filter(item => activePOIds.has(item.purchase_order_id) && (item.quantity_ordered - (item.quantity_received || 0)) > 0)
                            .map(item => item.part_id)
                    );
                    const lowStock = (parts || []).filter(p =>
                        p.is_favorite &&
                        !p.is_assembly &&
                        !partsOnOrder.has(p.id) &&
                        p.reorder_level &&
                        p.reorder_level > 0 &&
                        p.quantity_in_inventory <= p.reorder_level
                    );
                    setLowStockParts(lowStock.slice(0, 30));
                } catch (e) {
                    console.log("Failed to load parts for dashboard:", e);
                }
            })();

            // Load transaction data for graph and recent list
            try {
                const thirtyDaysAgo = subDays(new Date(), 30);
                const allTransactionsLast30Days = await Transaction.filter(
                    { date: { $gte: ((thirtyDaysAgo) ? format(new Date(thirtyDaysAgo), 'yyyy-MM-dd') : '—') } },
                    "-date",
                    1000 // Use a high limit to get all transactions for the period
                );

                if (allTransactionsLast30Days && allTransactionsLast30Days.length > 0) {
                    // --- Process data for Sales Activity graph ---
                    const salesByDay = generateSampleSalesData().reduce((acc, day) => {
                        acc[day.name] = 0;
                        return acc;
                    }, {});

                    allTransactionsLast30Days.forEach(t => {
                        if (t.date && typeof t.total_cost === 'number') { // Ensure total_cost is a number
                            const transactionDate = parseISO(t.date); // Correctly parse ISO string
                            const dayName = ((transactionDate) ? format(new Date(transactionDate), 'MMM d') : '—');
                            if (salesByDay.hasOwnProperty(dayName)) {
                                salesByDay[dayName] += t.total_cost;
                            }
                        }
                    });

                    const updatedSalesData = Object.entries(salesByDay).map(([name, sales]) => ({
                        name,
                        sales: parseFloat(sales.toFixed(2))
                    }));
                    setSalesData(updatedSalesData);

                    // --- Process data for Recent Transactions table ---
                    // Take the 30 most recent transactions for the table (already sorted by -date)
                    const recentTransactionsForTable = allTransactionsLast30Days.slice(0, 30); 
                    const customerIds = [...new Set(recentTransactionsForTable.map(t => t.customer_id).filter(Boolean))];
                    const partIds = [...new Set(recentTransactionsForTable.map(t => t.part_id).filter(Boolean))];

                    const [customerData, partData] = await Promise.all([
                        customerIds.length > 0 ? Customer.filter({ id: { $in: customerIds } }) : Promise.resolve([]),
                        partIds.length > 0 ? Part.filter({ id: { $in: partIds } }) : Promise.resolve([])
                    ]);
        
                    const customerMap = (customerData || []).reduce((acc, c) => ({ ...acc, [c.id]: c.company_name }), {});
                    const partMap = (partData || []).reduce((acc, p) => ({ ...acc, [p.id]: p.part_name }), {});

                    const enrichedTransactions = recentTransactionsForTable.map(t => ({
                        ...t,
                        customer_name: customerMap[t.customer_id] || 'N/A',
                        part_name: partMap[t.part_id] || 'N/A'
                    }));
                    setTransactions(enrichedTransactions);
                }
            } catch (e) {
                console.error("Dashboard transaction loading error:", e);
                setError("Some dashboard data couldn't be loaded.");
            }
        };

        loadDashboardData();
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            
            {error && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Notice</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActionCard 
                    title="Tickets" 
                    description="Create and manage support tickets" 
                    icon={ClipboardCheck}
                    pageName="Tickets"
                    badge={activeTicketCount}
                />
                <ActionCard 
                    title="On-Site Service" 
                    description="Log parts used during a service call" 
                    icon={Wrench}
                    pageName="OnSiteService"
                />
                <ActionCard 
                    title="Parts Order" 
                    description="Create a new parts order for a customer" 
                    icon={Package}
                    pageName="PartsOrder"
                />
                <ActionCard 
                    title="Parts Lookup" 
                    description="Search and view your parts inventory" 
                    icon={Search}
                    pageName="Parts"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActionCard 
                    title="Quotes" 
                    description="Create and manage customer quotations" 
                    icon={FileText}
                    pageName="Quotes"
                />
                <ActionCard 
                    title="Purchase Orders" 
                    description="Manage supplier purchase orders" 
                    icon={ShoppingCart}
                    pageName="PurchaseOrders"
                />
                <ActionCard 
                    title="Maintenance" 
                    description="Schedule and track maintenance visits" 
                    icon={ClipboardList}
                    pageName="MaintenanceChecklists"
                />
                <ActionCard 
                    title="Reports" 
                    description="View business analytics and reports" 
                    icon={BarChart3}
                    pageName="Reports"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Activity className="mr-2" />Sales Activity (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent className="pl-0">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={salesData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                            <Tooltip
                                cursor={{ fill: 'rgba(67, 56, 202, 0.1)' }}
                                content={({ active, payload, label }) =>
                                    active && payload && payload.length ? (
                                    <div className="bg-white p-2 shadow-lg rounded-lg border">
                                        <p className="font-bold">{label}</p>
                                        <p className="text-sm text-blue-600">{`Sales: $${payload[0].value.toFixed(2)}`}</p>
                                    </div>
                                    ) : null
                                }
                            />
                            <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {transactions.length > 0 ? (
                            <div className="max-h-96 overflow-y-auto pr-2">
                                <Table>
                                    <TableBody>
                                        {transactions.map((t) => (
                                            <TableRow
                                                key={t.id}
                                                className="cursor-pointer hover:bg-gray-50"
                                                onClick={() => {
                                                    sessionStorage.setItem('open_transaction_id', t.id);
                                                    navigate(createPageUrl('Transactions'));
                                                }}
                                            >
                                                <TableCell>
                                                    <Badge variant={t.transaction_type === 'on_site_service' ? 'default' : 'secondary'} className="capitalize w-28 text-center justify-center">
                                                        {t.transaction_type?.replace(/_/g, ' ') || 'Service'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium">{t.customer_name}</p>
                                                    <p className="text-xs text-muted-foreground">{t.part_name}</p>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">${(t.total_cost || 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : <p className="text-sm text-gray-500">No recent transactions in the last 30 days.</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Parts Requiring Attention</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {lowStockParts.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto pr-2">
                            <Table>
                                <TableBody>
                                    {lowStockParts.map((part) => (
                                        <TableRow key={part.id}>
                                            <TableCell>
                                                <p className="font-medium">{part.part_name}</p>
                                                <p className="text-xs text-muted-foreground">{part.part_number}</p>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="destructive">
                                                    Stock: {part.quantity_in_inventory} (Reorder at: {part.reorder_level})
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        ) : <p className="text-sm text-gray-500">No parts currently require attention.</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}