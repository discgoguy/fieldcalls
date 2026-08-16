import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabaseClient';
import { Machine, Part, Transaction } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, History, Monitor, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function PortalHistory() {
    const [transactions, setTransactions] = useState([]);
    const [machines, setMachines] = useState([]);
    const [parts, setParts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMachine, setSelectedMachine] = useState("all");
    const [error, setError] = useState("");

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
                if (currentUser?.customer_id) {
                    const [transData, machData, partData] = await Promise.all([
                        Transaction.filter({ customer_id: currentUser.customer_id }),
                        Machine.filter({ customer_id: currentUser.customer_id }),
                        Part.list()
                    ]);

                    setParts(partData || []);

                    // Filter only service-related transactions if needed, or show all
                    // The prompt asked for "service history report", which usually implies service calls
                    // Transaction types: 'on_site_service', 'service_expense', 'parts_order', etc.
                    
                    const serviceTrans = (transData || []).sort((a, b) => new Date(b.date) - new Date(a.date));
                    setTransactions(serviceTrans);
                    setMachines(machData || []);
                }
            } catch (e) {
                console.error("Failed to load history", e);
                setError("Failed to load service history.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const filteredTransactions = transactions.filter(t => {
        if (selectedMachine === "all") return true;
        return t.machine_id && t.machine_id === selectedMachine;
    });

    const getTransactionLabel = (type) => {
        const labels = {
            on_site_service: "On-Site Service",
            in_house_service: "In-House Service",
            parts_order: "Parts Order",
            service_expense: "Service Expense",
            shipping_expense: "Shipping",
            warranty_replacement: "Warranty",
            no_charge: "No Charge",
            service_agreement: "Service Agreement",
            sales_agreement: "Sales Agreement"
        };
        return labels[type] || type;
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center print:hidden">
                <h1 className="text-2xl font-bold text-gray-900">Service History</h1>
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print Report
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center"><History className="mr-2" /> Activity Log</CardTitle>
                            <CardDescription>History of services and orders for your machines.</CardDescription>
                        </div>
                        <div className="w-full md:w-64 print:hidden">
                            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by Machine" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Machines</SelectItem>
                                    {machines.sort((a, b) => a.model.localeCompare(b.model)).map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.model} (S/N: {m.serial_number})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Machine</TableHead>
                                <TableHead>Description / Part</TableHead>
                                <TableHead>Technician</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length > 0 ? filteredTransactions.map(t => {
                                const machine = machines.find(m => m.id === t.machine_id);
                                return (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{getTransactionLabel(t.transaction_type)}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {machine ? (
                                                <div className="text-sm">
                                                    <div className="font-medium">{machine.model}</div>
                                                    <div className="text-xs text-gray-500">{machine.serial_number}</div>
                                                </div>
                                            ) : <span className="text-gray-400">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            {(t.part_id && (t.transaction_type === 'on_site_service' || t.transaction_type === 'parts_order' || t.transaction_type === 'in_house_service' || t.transaction_type === 'no_charge' || t.transaction_type === 'warranty_replacement' || t.transaction_type === 'service_agreement' || t.transaction_type === 'sales_agreement')) ? (
                                                <div>
                                                    <span className="font-medium">
                                                        {parts.find(p => p.id === t.part_id)?.part_name || "Unknown Part"}
                                                    </span>
                                                    {t.quantity && <span className="text-gray-500 ml-2">(Qty: {t.quantity})</span>}
                                                </div>
                                            ) : (
                                                <span className="font-medium">{(t.transaction_type === 'on_site_service' || t.transaction_type === 'in_house_service') ? "Service" : (t.notes || "—")}</span>
                                            )}
                                            {t.notes && t.transaction_type !== 'service_expense' && (
                                                <p className="text-xs text-gray-500 mt-1 truncate max-w-[300px]">{t.notes}</p>
                                            )}
                                        </TableCell>
                                        <TableCell>{t.technician_name || "—"}</TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow><TableCell colSpan="5" className="text-center py-8">No history found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <style>{`
                @media print {
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}