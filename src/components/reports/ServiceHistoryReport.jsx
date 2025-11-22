import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Printer } from 'lucide-react';
import { format, subDays } from 'date-fns';
import DateRangePicker from './DateRangePicker';

export default function ServiceHistoryReport() {
    const [customers, setCustomers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [parts, setParts] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState('all');
    const [loading, setLoading] = useState(false);
    const [loadingReport, setLoadingReport] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 90), to: new Date() });

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            const filter = await withTenantFilter();
            const [customerData, partData] = await Promise.all([
                base44.entities.Customer.filter(filter),
                base44.entities.Part.filter(filter)
            ]);
            setCustomers(customerData || []);
            setParts(partData || []);
            setLoading(false);
        };
        loadInitialData();
    }, []);

    const handleCustomerChange = async (customerId) => {
        setSelectedCustomerId(customerId);
        setSelectedMachineId('all');
        setReportData(null);
        if (customerId) {
            const filter = await withTenantFilter({ customer_id: customerId });
            const customerMachines = await base44.entities.Machine.filter(filter);
            setMachines(customerMachines || []);
        } else {
            setMachines([]);
        }
    };

    const generateReport = async () => {
        if (!selectedCustomerId) return;
        setLoadingReport(true);
        
        let machineIds = [];
        if (selectedMachineId === 'all') {
            machineIds = machines.map(m => m.id);
        } else {
            machineIds.push(selectedMachineId);
        }

        const filter = await withTenantFilter({ 
            customer_id: selectedCustomerId,
            transaction_type: { $in: ['on_site_service', 'service_expense', 'parts_order', 'shipping_expense'] },
            date: {}
        });

        if (dateRange.from) {
            filter.date.$gte = format(dateRange.from, 'yyyy-MM-dd');
        }
        if (dateRange.to) {
            const toDate = new Date(dateRange.to);
            toDate.setDate(toDate.getDate() + 1);
            filter.date.$lt = format(toDate, 'yyyy-MM-dd');
        }

        const transactions = await base44.entities.Transaction.filter(filter, '-date');

        const partMap = parts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

        const relevantTransactions = transactions.filter(t => 
            !t.machine_id || machineIds.includes(t.machine_id)
        );

        const machineMap = machines.reduce((acc, m) => ({ ...acc, [m.id]: m }), {});

        const data = {
            customer: customers.find(c => c.id === selectedCustomerId),
            machines: machines,
            transactions: relevantTransactions,
            partMap: partMap,
            machineMap: machineMap,
            generatedAt: new Date(),
        };

        setReportData(data);
        setLoadingReport(false);
    };

    const ServiceLog = ({ data }) => {
        if (!data) return null;
        
        const { customer, transactions, partMap, machineMap, generatedAt } = data;

        return (
            <div className="print-area mt-6 border p-4 sm:p-8 rounded-lg bg-white">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-2xl font-bold">Service History Report</h2>
                        <p className="text-gray-500">For: {customer.company_name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm">Generated on: {format(generatedAt, 'PPP')}</p>
                        <Button variant="outline" size="sm" className="mt-2 print-hide" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print Report</Button>
                    </div>
                </div>

                {transactions.length > 0 ? transactions.map(t => (
                    <Card key={t.id} className="mb-4">
                        <CardHeader>
                            <CardTitle className="text-lg flex justify-between">
                                <span>{t.transaction_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                <span className="text-base font-normal text-gray-600">{format(new Date(t.date), 'PPP')}</span>
                            </CardTitle>
                            {t.machine_id && machineMap[t.machine_id] && (
                                <CardDescription>Machine: {machineMap[t.machine_id].model} (S/N: {machineMap[t.machine_id].serial_number})</CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {t.part_id && partMap[t.part_id] && <p><strong>Part:</strong> {partMap[t.part_id].part_name} ({partMap[t.part_id].part_number})</p>}
                                {t.quantity && <p><strong>Quantity:</strong> {t.quantity}</p>}
                                {t.technician_name && <p><strong>Technician:</strong> {t.technician_name}</p>}
                                {(t.travel_hours || t.onsite_hours) && <p><strong>Hours:</strong> {t.travel_hours || 0} (travel), {t.onsite_hours || 0} (on-site)</p>}
                                {t.total_cost && <p><strong>Cost:</strong> ${t.total_cost.toFixed(2)}</p>}
                                {t.notes && <p className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded"><strong>Notes:</strong> {t.notes}</p>}
                            </div>
                        </CardContent>
                    </Card>
                )) : <p className="text-center text-gray-500 py-8">No service history found for the selected criteria.</p>}
                <style>{`
                    @media print {
                        .print-hide { display: none; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .print-area { border: none !important; box-shadow: none !important; }
                    }
                `}</style>
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Service History Report</CardTitle>
                <CardDescription>Generate a detailed log of service and parts for a customer or specific machine.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-end p-4 border rounded-lg bg-gray-50">
                    <div className="flex-1 w-full">
                        <Label>Customer</Label>
                        <Select onValueChange={handleCustomerChange} value={selectedCustomerId} disabled={loading}>
                            <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                            <SelectContent>
                                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 w-full">
                        <Label>Machine</Label>
                        <Select onValueChange={setSelectedMachineId} value={selectedMachineId} disabled={!selectedCustomerId}>
                            <SelectTrigger><SelectValue placeholder="Select a machine" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Machines for Customer</SelectItem>
                                {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.model} (S/N: {m.serial_number})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 w-full">
                        <Label>Date Range</Label>
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                    </div>
                    <Button onClick={generateReport} disabled={!selectedCustomerId || loadingReport} className="w-full sm:w-auto">
                        {loadingReport ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Generating...</> : 'Generate Report'}
                    </Button>
                </div>
                {reportData && <ServiceLog data={reportData} />}
            </CardContent>
        </Card>
    );
}