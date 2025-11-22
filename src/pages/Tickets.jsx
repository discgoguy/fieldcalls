
import React, { useState, useEffect } from "react";
import { Ticket } from "@/entities/Ticket";
import { Customer } from "@/entities/Customer";
import { Technician } from "@/entities/Technician";
import { User } from "@/entities/User";
import { createPageUrl } from '@/utils';
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, AlertTriangle, CheckCircle, ClipboardCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import TicketForm from "../components/tickets/TicketForm";
import TicketCard from "../components/tickets/TicketCard";
import TicketDetailModal from "../components/tickets/TicketDetailModal";
import { sendTicketNotification } from "@/functions/sendTicketNotification";

export default function TicketsPage() {
    const [tickets, setTickets] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    const loadTickets = async () => {
        setLoading(true);
        setError("");
        try {
            const filter = await withTenantFilter();
            const ticketData = await Ticket.filter(filter, '-created_date');
            setTickets(ticketData || []);
            
            // Load ALL customers and technicians, not just those associated with tickets
            const [customerData, technicianData] = await Promise.all([
                Customer.filter(filter),
                Technician.filter(filter)
            ]);
            
            setCustomers(customerData || []);
            setTechnicians(technicianData || []);
            
            const userData = await User.me();
            setCurrentUser(userData);
        } catch (e) {
            setError("Failed to load data. Please refresh the page.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, []);

    const handleSaveTicket = async (ticketData) => {
        setIsSubmitting(true);
        setFormError("");
        setSuccessMessage("");
        try {
            const tenantFilter = await withTenantFilter();
            const lastTicketInTenant = await Ticket.filter(tenantFilter, "-created_date", 1);
            const lastTicketNum = lastTicketInTenant.length > 0 ? parseInt(lastTicketInTenant[0].ticket_number.split('-')[1]) : 0;
            const newTicketNumber = `TICKET-${(lastTicketNum + 1).toString().padStart(5, '0')}`;

            let newTicketData = { ...ticketData, ticket_number: newTicketNumber };
            newTicketData = await addTenantId(newTicketData);
            
            await Ticket.create(newTicketData);
            
            // Send email notification to Customer Service team
            try {
                // Ensure customers data is loaded before attempting to find customerName
                // If customers might not be loaded yet, consider refetching or handling gracefully
                const customerName = customers.find(c => c.id === ticketData.customer_id)?.company_name || 'Unknown Customer';
                await sendTicketNotification({
                    ticketData: newTicketData,
                    customerName: customerName
                });
                console.log('Email notifications sent successfully');
            } catch (emailError) {
                console.warn('Failed to send email notifications:', emailError);
                // Don't fail the ticket creation if email fails
            }
            
            setSuccessMessage("Ticket successfully created and Customer Service team notified!");
            setIsFormOpen(false);
            await loadTickets(); // Changed from loadData
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setFormError(e.message || "Failed to save ticket.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateTicket = async (ticketId, ticketData) => {
        try {
            await Ticket.update(ticketId, ticketData);
            setSuccessMessage("Ticket successfully updated!");
            await loadTickets(); // Changed from loadData
            // Find the updated ticket to keep the modal open with fresh data
            const updatedTicket = tickets.find(t => t.id === ticketId);
            if(updatedTicket) {
                 const refreshedTicket = { ...updatedTicket, ...ticketData };
                 setSelectedTicket(refreshedTicket);
            }
           
            setTimeout(() => setSuccessMessage(""), 4000);
            return true;
        } catch (e) {
            setError(e.message || "Failed to update ticket.");
            return false;
        }
    };

    const handleDeleteTicket = async (ticketId) => {
        try {
            await Ticket.delete(ticketId);
            setSuccessMessage("Ticket deleted.");
            setIsDetailOpen(false);
            setSelectedTicket(null);
            await loadTickets(); // Changed from loadData
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch(e) {
            setError(e.message || "Failed to delete ticket.");
        }
    };

    const handleAddNote = async (ticketId, noteText) => {
        if (!noteText.trim() || !currentUser) return false;
        
        const currentTicket = tickets.find(t => t.id === ticketId);
        if (!currentTicket) return false;

        const newNoteEntry = `[${new Date().toLocaleString()} - ${currentUser.full_name || currentUser.email}]\n${noteText.trim()}\n\n`;
        const updatedNotes = (currentTicket.notes || "") + newNoteEntry;

        return handleUpdateTicket(ticketId, { notes: updatedNotes });
    };

    const handleConvert = (ticketId, type) => {
        const page = type === 'service' ? 'OnSiteService' : 'PartsOrder';
        console.log(`🔄 Converting ticket ${ticketId} to ${page}`);
        const url = createPageUrl(page) + `?fromTicket=${ticketId}`;
        console.log('🌐 Navigation URL:', url);
        window.location.href = url;
    };
    
    const handleCardClick = (ticket) => {
        setSelectedTicket(ticket);
        setIsDetailOpen(true);
    };

    const customerMap = customers.reduce((acc, c) => ({...acc, [c.id]: c.company_name}), {});
    const technicianMap = technicians.reduce((acc, t) => ({...acc, [t.id]: t.full_name}), {});
    
    const openTickets = tickets.filter(t => ['Open', 'In Progress', 'Pending'].includes(t.status));
    const closedTickets = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed');

    const TicketList = ({ ticketData }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {ticketData.length > 0 ? ticketData.map(ticket => (
                <TicketCard 
                    key={ticket.id}
                    ticket={ticket}
                    customerName={customerMap[ticket.customer_id]}
                    technicianName={technicianMap[ticket.technician_id]}
                    onConvert={handleConvert}
                    onCardClick={handleCardClick}
                />
            )) : <p className="text-gray-500 col-span-full">No tickets in this category.</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <ClipboardCheck className="mr-3 h-8 w-8" />
                    Support Tickets
                </h1>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" />New Ticket</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create a New Ticket</DialogTitle>
                        </DialogHeader>
                        <TicketForm 
                            customers={customers}
                            technicians={technicians}
                            onSubmit={handleSaveTicket}
                            isSubmitting={isSubmitting}
                            error={formError}
                        />
                    </DialogContent>
                </Dialog>
            </div>
            
            {successMessage && <Alert className="mb-4 bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : error ? (
                <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
            ) : (
                <Tabs defaultValue="open">
                    <TabsList>
                        <TabsTrigger value="open">Active Tickets ({openTickets.length})</TabsTrigger>
                        <TabsTrigger value="closed">Closed/Resolved ({closedTickets.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="open" className="pt-4">
                        <TicketList ticketData={openTickets} />
                    </TabsContent>
                    <TabsContent value="closed" className="pt-4">
                        <TicketList ticketData={closedTickets} />
                    </TabsContent>
                </Tabs>
            )}
            
            {selectedTicket && (
                <TicketDetailModal
                    ticket={selectedTicket}
                    customers={customers}
                    technicians={technicians}
                    isOpen={isDetailOpen}
                    onOpenChange={setIsDetailOpen}
                    onUpdate={handleUpdateTicket}
                    onDelete={handleDeleteTicket}
                    onAddNote={handleAddNote}
                    onConvert={handleConvert}
                />
            )}
        </div>
    );
}
