import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerValueReport from "../components/reports/CustomerValueReport";
import TechnicianPerformanceReport from "../components/reports/TechnicianPerformanceReport";
import TopPartsReport from "../components/reports/TopPartsReport";
import ServiceHistoryReport from "../components/reports/ServiceHistoryReport";
import MachinePartUseReport from "../components/reports/MachinePartUseReport";
import InventoryValueReport from "../components/reports/InventoryValueReport";
import { BarChart3 } from 'lucide-react';
import { withTenantFilter } from '@/components/utils/tenant';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState('customer_value');
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [parts, setParts] = useState([]);
    const [technicians, setTechnicians] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const filter = await withTenantFilter();
                const [transactionData, customerData, partData, technicianData] = await Promise.all([
                    base44.entities.Transaction.filter(filter, '-date', 1000),
                    base44.entities.Customer.filter(filter),
                    base44.entities.Part.filter(filter),
                    base44.entities.Technician.filter(filter)
                ]);
                
                setTransactions(transactionData || []);
                setCustomers(customerData || []);
                setParts(partData || []);
                setTechnicians(technicianData || []);
            } catch (e) {
                console.error("Failed to load report data:", e);
                setTransactions([]);
                setCustomers([]);
                setParts([]);
                setTechnicians([]);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const reports = [
        { value: 'customer_value', label: 'Customer Value' },
        { value: 'technician_performance', label: 'Technician Performance' },
        { value: 'top_parts', label: 'Top Parts Sold' },
        { value: 'service_history', label: 'Service History' },
        { value: 'part_usage', label: 'Part Usage by Machine' },
        { value: 'inventory_value', label: 'Inventory Value' },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <BarChart3 className="mr-2" />
                    Reports
                </CardTitle>
                <CardDescription>
                    Analyze business performance and generate service logs.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <p>Loading report data...</p>
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        
                        {/* Desktop & Tablet Tabs */}
                        <div className="hidden sm:block border-b">
                            <TabsList className="w-full justify-start overflow-x-auto">
                                {reports.map(report => (
                                    <TabsTrigger key={report.value} value={report.value} className="flex-shrink-0">
                                        {report.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {/* Mobile Select Dropdown */}
                        <div className="sm:hidden mb-4">
                            <Select value={activeTab} onValueChange={setActiveTab}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a report" />
                                </SelectTrigger>
                                <SelectContent>
                                    {reports.map(report => (
                                        <SelectItem key={report.value} value={report.value}>
                                            {report.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Report Content Panes */}
                        <TabsContent value="customer_value" className="mt-4">
                            <CustomerValueReport 
                                transactions={transactions} 
                                customers={customers} 
                                parts={parts} 
                                technicians={technicians} 
                            />
                        </TabsContent>
                        <TabsContent value="technician_performance" className="mt-4">
                            <TechnicianPerformanceReport 
                                transactions={transactions} 
                                customers={customers} 
                                parts={parts} 
                                technicians={technicians} 
                            />
                        </TabsContent>
                        <TabsContent value="top_parts" className="mt-4">
                            <TopPartsReport 
                                transactions={transactions} 
                                customers={customers} 
                                parts={parts} 
                                technicians={technicians} 
                            />
                        </TabsContent>
                        <TabsContent value="service_history" className="mt-4">
                            <ServiceHistoryReport 
                                transactions={transactions} 
                                customers={customers} 
                                parts={parts} 
                                technicians={technicians} 
                            />
                        </TabsContent>
                        <TabsContent value="part_usage" className="mt-4">
                            <MachinePartUseReport 
                                transactions={transactions} 
                                customers={customers} 
                                parts={parts} 
                                technicians={technicians} 
                            />
                        </TabsContent>
                        <TabsContent value="inventory_value" className="mt-4">
                            <InventoryValueReport 
                                transactions={transactions} 
                                customers={customers} 
                                parts={parts} 
                                technicians={technicians} 
                            />
                        </TabsContent>
                    </Tabs>
                )}
            </CardContent>
        </Card>
    );
}