import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CustomerValueReport from "../components/reports/CustomerValueReport";
import TechnicianPerformanceReport from "../components/reports/TechnicianPerformanceReport";
import TopPartsReport from "../components/reports/TopPartsReport";
import ServiceHistoryReport from "../components/reports/ServiceHistoryReport";
import MachinePartUseReport from "../components/reports/MachinePartUseReport";
import InventoryValueReport from "../components/reports/InventoryValueReport";
import SalesPerformanceReport from "../components/reports/SalesPerformanceReport";
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState('sales_performance');

    const reports = [
        { value: 'sales_performance', label: 'Sales Performance' },
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
                    <TabsContent value="sales_performance" className="mt-4">
                        <SalesPerformanceReport />
                    </TabsContent>
                    <TabsContent value="customer_value" className="mt-4">
                        <CustomerValueReport />
                    </TabsContent>
                    <TabsContent value="technician_performance" className="mt-4">
                        <TechnicianPerformanceReport />
                    </TabsContent>
                    <TabsContent value="top_parts" className="mt-4">
                        <TopPartsReport />
                    </TabsContent>
                    <TabsContent value="service_history" className="mt-4">
                        <ServiceHistoryReport />
                    </TabsContent>
                    <TabsContent value="part_usage" className="mt-4">
                        <MachinePartUseReport />
                    </TabsContent>
                    {/* New TabsContent for InventoryValueReport */}
                    <TabsContent value="inventory_value" className="mt-4">
                        <InventoryValueReport />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}