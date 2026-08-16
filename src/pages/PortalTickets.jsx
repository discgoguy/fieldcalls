import React, { useState, useEffect } from "react";
import { Category, Machine, Part, Ticket, User } from '@/api/entities';
import { invokeApi , supabase } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import PortalTicketDetail from "@/components/tickets/PortalTicketDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, AlertTriangle, CheckCircle, Search, X, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PortalTickets() {
    const [tickets, setTickets] = useState([]);
    const [filteredTickets, setFilteredTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    
    // Lists for dropdowns
    const [machines, setMachines] = useState([]);
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);

    const [newTicket, setNewTicket] = useState({
        subject: "",
        ticket_type: "Repair Request",
        urgency: "Medium",
        description: "",
        purchase_order_number: "",
        machine_id: ""
    });

    const [selectedParts, setSelectedParts] = useState([]); // [{ category: '', part_id: '', quantity: 1 }]

    const loadData = async () => {
        setLoading(true);
        try {
            const currentUser = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
            setUser(currentUser);
            if (currentUser?.customer_id) {
                const [ticketData, machineData, partData, categoryData] = await Promise.all([
                    Ticket.filter({ customer_id: currentUser.customer_id }),
                    Machine.filter({ customer_id: currentUser.customer_id }),
                    Part.list(),
                    Category.list()
                ]);
                
                // Sort tickets by ticket number
                const sorted = (ticketData || []).sort((a, b) => {
                    const aNum = parseInt(a.ticket_number?.split('-')[1] || 0);
                    const bNum = parseInt(b.ticket_number?.split('-')[1] || 0);
                    return bNum - aNum; // Descending order (newest first)
                });
                setTickets(sorted);
                setFilteredTickets(sorted);
                
                setMachines(machineData || []);
                setParts(partData || []);
                setCategories(categoryData || []);

                // Check for cart redirection or direct actions
                const urlParams = new URLSearchParams(window.location.search);
                const action = urlParams.get('action');
                const typeParam = urlParams.get('type');

                if (action === 'new') {
                    setNewTicket(prev => ({
                        ...prev,
                        ticket_type: typeParam || "Repair Request",
                        subject: typeParam === "Repair Request" ? "Service Request" : "", 
                    }));
                    setIsDialogOpen(true);
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else if (urlParams.get('fromCart')) {
                    const cartData = sessionStorage.getItem('portalPartsCart');
                    if (cartData) {
                        try {
                            const parsedCart = JSON.parse(cartData);
                            if (parsedCart.length > 0) {
                                setNewTicket(prev => ({
                                    ...prev,
                                    ticket_type: "Parts Request",
                                    subject: `Parts Request - ${new Date().toLocaleDateString()}`,
                                    description: "Requesting parts from catalog."
                                }));

                                setSelectedParts(parsedCart.map(item => ({
                                    category: item.category || 'all',
                                    part_id: item.id,
                                    quantity: item.quantity
                                })));

                                setIsDialogOpen(true);
                                sessionStorage.removeItem('portalPartsCart');
                                // Clean URL
                                window.history.replaceState({}, document.title, window.location.pathname);
                            }
                        } catch (e) {
                            console.error("Failed to parse cart", e);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load portal data", e);
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const results = tickets.filter(t => 
            t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredTickets(results);
    }, [searchTerm, tickets]);

    // Part Selection Logic
    const handleAddPartRow = () => {
        setSelectedParts([...selectedParts, { category: 'all', part_id: '', quantity: 1 }]);
    };

    const handleRemovePartRow = (index) => {
        const newParts = [...selectedParts];
        newParts.splice(index, 1);
        setSelectedParts(newParts);
    };

    const handlePartRowChange = (index, field, value) => {
        const newParts = [...selectedParts];
        newParts[index][field] = value;
        
        // Reset part_id when category changes
        if (field === 'category') {
            newParts[index].part_id = '';
        }
        
        setSelectedParts(newParts);
    };

    const getFilteredParts = (category) => {
        let filtered = parts.filter(p => !p.is_obsolete);
        if (!category || category === 'all') return filtered;
        return filtered.filter(p => p.category === category);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");

        try {
            if (!newTicket.subject || !newTicket.description) {
                throw new Error("Subject and Description are required.");
            }

            if (newTicket.ticket_type === "Parts Request" && selectedParts.length === 0) {
                 throw new Error("Please select at least one part for a parts request.");
            }

            // Generate ticket number consistent with technician portal
            // Scan recent tickets to find the TRUE highest number to avoid duplicates
            const recentTickets = await Ticket.list("-created_date", 100);
            
            let maxTicketNum = 0;
            if (recentTickets && recentTickets.length > 0) {
                recentTickets.forEach(t => {
                    if (t.ticket_number && t.ticket_number.startsWith("TICKET-")) {
                        const parts = t.ticket_number.split('-');
                        if (parts.length === 2) {
                            const num = parseInt(parts[1]);
                            if (!isNaN(num) && num > maxTicketNum) {
                                maxTicketNum = num;
                            }
                        }
                    }
                });
            }
            
            const ticketNumber = `TICKET-${(maxTicketNum + 1).toString().padStart(5, '0')}`;

            // Clean up parts data for submission
            const partsList = newTicket.ticket_type === "Parts Request" 
                ? selectedParts.filter(p => p.part_id).map(p => ({
                    part_id: p.part_id,
                    quantity: parseInt(p.quantity) || 1
                }))
                : [];

            const createdTicket = await Ticket.create({
                ticket_number: ticketNumber,
                customer_id: user.customer_id,
                subject: newTicket.subject,
                ticket_type: newTicket.ticket_type,
                urgency: newTicket.urgency,
                status: "Open",
                description: newTicket.description,
                notes: `Created by customer portal user: ${user.full_name} (${user.email})`,
                purchase_order_number: newTicket.purchase_order_number || null,
                machine_id: (newTicket.ticket_type === "Repair Request" && newTicket.machine_id) ? newTicket.machine_id : null,
                parts: partsList
            });

            // Send notification
            try {
                await invokeApi('sendTicketNotification', {
                    ticketData: createdTicket,
                    customerName: user.full_name || user.email
                });
            } catch (notifyError) {
                console.error("Failed to send notification:", notifyError);
                // Don't block the UI success state if notification fails
            }

            setSuccessMessage("Ticket created successfully!");
            setIsDialogOpen(false);
            setNewTicket({ 
                subject: "", 
                ticket_type: "Repair Request", 
                urgency: "Medium", 
                description: "",
                purchase_order_number: "",
                machine_id: ""
            });
            setSelectedParts([]);
            await loadData(); // Reload to show new ticket
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to create ticket.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        const colors = {
            Open: "bg-blue-100 text-blue-800",
            "In Progress": "bg-yellow-100 text-yellow-800",
            Pending: "bg-orange-100 text-orange-800",
            Resolved: "bg-green-100 text-green-800",
            Closed: "bg-gray-100 text-gray-800"
        };
        return <Badge className={colors[status] || "bg-gray-100 text-gray-800"}>{status}</Badge>;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>My Tickets</CardTitle>
                        <CardDescription>View and manage your support tickets.</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> New Ticket</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create New Support Ticket</DialogTitle>
                            </DialogHeader>
                            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Label htmlFor="subject">Subject *</Label>
                                        <Input id="subject" value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})} required />
                                    </div>
                                    <div>
                                        <Label htmlFor="type">Type</Label>
                                        <Select value={newTicket.ticket_type} onValueChange={v => setNewTicket({...newTicket, ticket_type: v})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Repair Request">Repair Request</SelectItem>
                                                <SelectItem value="Parts Request">Parts Request</SelectItem>
                                                <SelectItem value="Information Request">Information Request</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="urgency">Urgency</Label>
                                        <Select value={newTicket.urgency} onValueChange={v => setNewTicket({...newTicket, urgency: v})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Low">Low</SelectItem>
                                                <SelectItem value="Medium">Medium</SelectItem>
                                                <SelectItem value="High">High</SelectItem>
                                                <SelectItem value="Critical">Critical</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="col-span-2">
                                        <Label htmlFor="po">Purchase Order Number</Label>
                                        <Input 
                                            id="po" 
                                            placeholder="Optional" 
                                            value={newTicket.purchase_order_number} 
                                            onChange={e => setNewTicket({...newTicket, purchase_order_number: e.target.value})} 
                                        />
                                    </div>

                                    {/* Machine Selection for Repair Requests */}
                                    {newTicket.ticket_type === "Repair Request" && (
                                        <div className="col-span-2">
                                            <Label htmlFor="machine">Select Machine *</Label>
                                            <Select value={newTicket.machine_id} onValueChange={v => setNewTicket({...newTicket, machine_id: v})}>
                                                <SelectTrigger><SelectValue placeholder="Select the machine needing repair..." /></SelectTrigger>
                                                <SelectContent>
                                                    {machines.length > 0 ? machines.sort((a, b) => a.model.localeCompare(b.model)).map(m => (
                                                        <SelectItem key={m.id} value={m.id}>{m.model} (S/N: {m.serial_number})</SelectItem>
                                                    )) : <SelectItem value="none" disabled>No machines found</SelectItem>}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                {/* Parts Selection for Parts Requests */}
                                {newTicket.ticket_type === "Parts Request" && (
                                    <div className="border rounded-md p-4 bg-slate-50 space-y-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <Label>Requested Parts</Label>
                                            <Button type="button" variant="outline" size="sm" onClick={handleAddPartRow}>
                                                <Plus className="h-3 w-3 mr-1" /> Add Part
                                            </Button>
                                        </div>
                                        
                                        {selectedParts.length === 0 && (
                                            <p className="text-sm text-gray-500 italic text-center py-2">No parts selected.</p>
                                        )}

                                        {selectedParts.map((row, index) => (
                                            <div key={index} className="grid grid-cols-12 gap-3 items-end border-b pb-3 last:border-0 last:pb-0">
                                                <div className="col-span-3">
                                                    <Label className="text-xs">Category</Label>
                                                    <Select value={row.category} onValueChange={v => handlePartRowChange(index, 'category', v)}>
                                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All</SelectItem>
                                                            {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-6">
                                                    <Label className="text-xs">Part</Label>
                                                    <Select value={row.part_id} onValueChange={v => handlePartRowChange(index, 'part_id', v)}>
                                                        <SelectTrigger className="h-9"><SelectValue placeholder="Select Part" /></SelectTrigger>
                                                        <SelectContent>
                                                            {getFilteredParts(row.category).map(p => (
                                                                <SelectItem key={p.id} value={p.id}>
                                                                    {p.part_name} ({p.part_number})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-2">
                                                    <Label className="text-xs">Qty</Label>
                                                    <Input 
                                                        type="number" 
                                                        min="1" 
                                                        className="h-9"
                                                        value={row.quantity} 
                                                        onChange={e => handlePartRowChange(index, 'quantity', e.target.value)} 
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemovePartRow(index)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="description">Description *</Label>
                                    <Textarea id="description" value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} required rows={4} placeholder="Describe the issue or request details..." />
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Ticket"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="mt-4 relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search tickets..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                {successMessage && <Alert className="mb-4 bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
                
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ticket #</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTickets.length > 0 ? filteredTickets.map(ticket => (
                                <TableRow 
                                    key={ticket.id} 
                                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => {
                                        setSelectedTicket(ticket);
                                        setIsDetailOpen(true);
                                    }}
                                >
                                    <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                                    <TableCell>{ticket.subject}</TableCell>
                                    <TableCell>{ticket.ticket_type}</TableCell>
                                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                    <TableCell>{ticket.created_date ? new Date(ticket.created_date).toLocaleDateString() : 'N/A'}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan="5" className="text-center">No tickets found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            {selectedTicket && (
                <PortalTicketDetail 
                    ticket={selectedTicket} 
                    isOpen={isDetailOpen} 
                    onOpenChange={setIsDetailOpen}
                    currentUser={user}
                />
            )}
        </Card>
    );
}