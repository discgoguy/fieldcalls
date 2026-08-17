import React, { useState, useEffect } from "react";
import { Category, Customer, Part, Technician, Ticket } from '@/api/entities';
import { invokeApi , supabase } from '@/api/supabaseClient';
import { createPageUrl } from '@/utils';
import { getTimezone, formatDateTimeInTimezone } from '@/components/utils/timezoneUtils';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, AlertTriangle, CheckCircle, ClipboardCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import TicketForm from "../components/tickets/TicketForm";
import TicketCard from "../components/tickets/TicketCard";
import TicketDetailModal from "../components/tickets/TicketDetailModal"; // Added TicketDetailModal import
import { applySortSettings, sortArray } from '@/components/utils/sortUtils';
import { logTicketEvent } from '@/lib/ticketEvents';

export default function TicketsPage() {
    const [tickets, setTickets] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [cartPartsData, setCartPartsData] = useState(null);
    const [timezone, setTimezone] = useState('America/Halifax');

    const loadData = async () => {
        setLoading(true);
        setError("");
        try {
            const [ticketData, customerData, technicianData, userData, partData, categoryData, sortSettings] = await Promise.all([
                Ticket.list(),
                Customer.list(),
                Technician.list(),
                (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })(),
                Part.list(),
                Category.list(),
                applySortSettings()
            ]);
            const sortedTickets = sortArray(ticketData || [], sortSettings.tickets);
            setTickets(sortedTickets);
            setCustomers(customerData || []);
            setTechnicians(technicianData || []);
            setCurrentUser(userData);
            setParts(partData || []);
            setCategories(categoryData || []);
        } catch (e) {
            setError("Failed to load data. Please refresh the page.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initTimezone = async () => {
            const tz = await getTimezone();
            setTimezone(tz);
        };
        initTimezone();
        loadData();
        
        // Check for cart data
        const urlParams = new URLSearchParams(window.location.search);
        const fromCart = urlParams.get('fromCart');
        if (fromCart) {
            const cartData = sessionStorage.getItem('partsCartData');
            if (cartData) {
                const parsedCart = JSON.parse(cartData);
                const ticketParts = parsedCart.map(item => ({
                    part_id: item.partId,
                    quantity: item.quantity || 1,
                    category: 'all'
                }));
                setCartPartsData(ticketParts);
                setTimeout(() => {
                    setIsFormOpen(true);
                }, 500);
                sessionStorage.removeItem('partsCartData');
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
    }, []);

    const handleSaveTicket = async (ticketData) => {
        setIsSubmitting(true);
        setFormError("");
        setSuccessMessage("");
        try {
            // Scan recent tickets by creation date to find the highest numeric ID
            // String sorting of TICKET-XXXX can be unreliable (TICKET-10 < TICKET-2)
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
            
            const newTicketNumber = `TICKET-${(maxTicketNum + 1).toString().padStart(5, '0')}`;

            // Auto-assign ownership to whoever created the ticket, unless they
            // explicitly picked someone else in the form.
            const ownerTechnicianId = ticketData.technician_id || currentUser?.technician_id || '';
            const newTicketData = {
                ...ticketData,
                ticket_number: newTicketNumber,
                technician_id: ownerTechnicianId,
                created_by: currentUser?.full_name || currentUser?.email || '',
            };
            const createdTicket = await Ticket.create(newTicketData);

            await logTicketEvent(createdTicket.id, 'created', {
                actorName: currentUser?.full_name || currentUser?.email,
                actorId: currentUser?.id,
            });
            if (ownerTechnicianId) {
                const ownerName = technicians.find(t => t.id === ownerTechnicianId)?.full_name || ownerTechnicianId;
                await logTicketEvent(createdTicket.id, 'owner_assigned', {
                    toValue: ownerName,
                    actorName: currentUser?.full_name || currentUser?.email,
                    actorId: currentUser?.id,
                });

                // Notify the assignee, unless they assigned it to themselves.
                if (String(ownerTechnicianId) !== String(currentUser?.technician_id || '')) {
                    try {
                        await invokeApi('ticketNotifications', { action: 'assignment', ticketId: createdTicket.id });
                    } catch (assignEmailError) {
                        console.warn('Failed to send assignment notification:', assignEmailError);
                    }
                }
            }
            
            // Send email notification to Customer Service team
            try {
                // Ensure customers data is loaded before attempting to find customerName
                // If customers might not be loaded yet, consider refetching or handling gracefully
                const customerName = customers.find(c => c.id === ticketData.customer_id)?.company_name || 'Unknown Customer';
                await invokeApi('ticketNotifications', {
                    action: 'newTicket',
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
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setFormError(e.message || "Failed to save ticket.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateTicket = async (ticketId, ticketData) => {
        try {
            const previousTicket = tickets.find(t => t.id === ticketId) || selectedTicket;

            await Ticket.update(ticketId, ticketData);

            // Log meaningful changes to the ticket's activity timeline.
            if (previousTicket) {
                if ('status' in ticketData && ticketData.status !== previousTicket.status) {
                    await logTicketEvent(ticketId, 'status_changed', {
                        fromValue: previousTicket.status,
                        toValue: ticketData.status,
                        actorName: currentUser?.full_name || currentUser?.email,
                        actorId: currentUser?.id,
                    });
                }
                if ('technician_id' in ticketData && String(ticketData.technician_id || '') !== String(previousTicket.technician_id || '')) {
                    const fromName = technicians.find(t => t.id === previousTicket.technician_id)?.full_name || (previousTicket.technician_id ? previousTicket.technician_id : 'Unassigned');
                    const toName = technicians.find(t => t.id === ticketData.technician_id)?.full_name || (ticketData.technician_id ? ticketData.technician_id : 'Unassigned');
                    await logTicketEvent(ticketId, 'owner_transferred', {
                        fromValue: fromName,
                        toValue: toName,
                        actorName: currentUser?.full_name || currentUser?.email,
                        actorId: currentUser?.id,
                    });

                    // Notify the new assignee, unless they were assigned to themselves.
                    if (ticketData.technician_id && String(ticketData.technician_id) !== String(currentUser?.technician_id || '')) {
                        try {
                            await invokeApi('ticketNotifications', { action: 'assignment', ticketId });
                        } catch (assignEmailError) {
                            console.warn('Failed to send assignment notification:', assignEmailError);
                        }
                    }
                }
            }

            setSuccessMessage("Ticket successfully updated!");
            await loadData();
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
            await loadData();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch(e) {
            setError(e.message || "Failed to delete ticket.");
        }
    };

    const handleAddNote = async (ticketId, noteText) => {
        if (!noteText.trim() || !currentUser) return false;
        
        const currentTicket = tickets.find(t => t.id === ticketId);
        if (!currentTicket) return false;

        const timestamp = formatDateTimeInTimezone(new Date().toISOString(), timezone);
        const newNoteEntry = `[${timestamp} - ${currentUser.full_name || currentUser.email}]\n${noteText.trim()}\n\n`;
        const updatedNotes = (currentTicket.notes || "") + newNoteEntry;

        return handleUpdateTicket(ticketId, { notes: updatedNotes });
    };

    const handleConvert = (ticketId, type) => {
        const page = type === 'service' ? 'OnSiteService' : 'PartsOrder';
        // Use a safer URL construction in case createPageUrl doesn't support query params well
        const baseUrl = createPageUrl(page);
        const separator = baseUrl.includes('?') ? '&' : '?';
        window.location.href = `${baseUrl}${separator}fromTicket=${ticketId}`;
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
                    onCardClick={handleCardClick} // Added onCardClick prop
                />
            )) : <p className="text-gray-500 col-span-full">No tickets in this category.</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <ClipboardCheck className="mr-3 h-8 w-8" />
                    Support Tickets {/* Updated title */}
                </h1>
                <Dialog open={isFormOpen} onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) setCartPartsData(null);
                }}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" />New Ticket</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create a New Ticket</DialogTitle>
                        </DialogHeader>
                        <TicketForm 
                            customers={customers}
                            technicians={technicians}
                            parts={parts}
                            categories={categories}
                            onSubmit={handleSaveTicket}
                            isSubmitting={isSubmitting}
                            error={formError}
                            initialData={cartPartsData ? { parts: cartPartsData } : {}}
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
                    parts={parts}
                    categories={categories}
                    isOpen={isDetailOpen}
                    onOpenChange={setIsDetailOpen}
                    onUpdate={handleUpdateTicket}
                    onDelete={handleDeleteTicket}
                    onAddNote={handleAddNote}
                    onConvert={handleConvert}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
}