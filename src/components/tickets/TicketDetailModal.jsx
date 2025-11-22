
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertDialogFooterComponent, // Renamed to avoid conflict with DialogFooter
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogTitleComponent, // Renamed to avoid conflict with DialogTitle
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, XCircle, Save, Loader2, MessageSquare, CornerDownLeft, Wrench, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns'; // Import date-fns for relative time

export default function TicketDetailModal({ ticket, customers, technicians, isOpen, onOpenChange, onUpdate, onDelete, onAddNote, onConvert }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTicket, setEditedTicket] = useState(null);
    const [newNote, setNewNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        if (ticket) {
            // Ensure technician_id is in the format expected by the Select component's value prop for initial display
            // If technician_id is null or undefined, treat it as '' for "none" option
            setEditedTicket({ ...ticket, technician_id: ticket.technician_id === null || ticket.technician_id === undefined ? '' : ticket.technician_id });
        }
        setIsEditing(false); // Reset editing state when ticket changes
    }, [ticket]);

    const handleSave = async () => {
        setIsSubmitting(true);
        // editedTicket.technician_id is already converted to '' for "None" or Number for assigned technician
        const success = await onUpdate(ticket.id, editedTicket);
        if (success) {
            setIsEditing(false);
        }
        setIsSubmitting(false);
    };
    
    const handleAddNote = async () => {
        setIsSubmitting(true);
        const success = await onAddNote(ticket.id, newNote);
        if (success) {
            setNewNote("");
        }
        setIsSubmitting(false);
    };

    const handleStatusChange = async (newStatus) => {
        // Optimistically update the UI if needed, or rely on onUpdate prop callback to fetch/refresh
        // For this implementation, we'll let the onUpdate prop handle the state refresh.
        // Also, prevent status change if currently editing to avoid conflict.
        if (!isEditing) {
            await onUpdate(ticket.id, { ...ticket, status: newStatus });
        }
    };

    const handleConvert = (type) => {
        if (onConvert) {
            onConvert(ticket.id, type);
        }
    };

    const customerName = customers.find(c => c.id === ticket?.customer_id)?.company_name;
    
    const urgencyColors = { Low: "bg-blue-100 text-blue-800", Medium: "bg-yellow-100 text-yellow-800", High: "bg-orange-100 text-orange-800", Critical: "bg-red-100 text-red-800" };
    const statusColors = { Open: "bg-green-100 text-green-800", "In Progress": "bg-indigo-100 text-indigo-800", Pending: "bg-yellow-100 text-yellow-800", Resolved: "bg-gray-500 text-white", Closed: "bg-gray-500 text-white" };

    const renderNotes = () => {
        if (!ticket?.notes) return <p className="text-sm text-gray-500 italic">No notes yet.</p>;
        
        return ticket.notes.split('\n\n').filter(note => note.trim()).map((note, index) => {
            const [meta, ...content] = note.split('\n');
            return (
                <div key={index} className="text-sm p-3 bg-slate-50 rounded-md border">
                    <p className="font-semibold text-slate-600">{meta.replace(/\[|\]/g, '')}</p>
                    <p className="text-slate-800 whitespace-pre-wrap">{content.join('\n')}</p>
                </div>
            );
        });
    };

    if (!ticket || !editedTicket) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl flex flex-col">
                <DialogHeader>
                    <DialogTitle>Ticket: {ticket.ticket_number}</DialogTitle>
                    <DialogDescription>{isEditing ? "You are in edit mode." : `For customer: ${customerName}`}</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 overflow-y-auto pr-2 flex-grow">
                    {isEditing ? (
                        <div className="space-y-4 p-1">
                            {/* EDITING FORM */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><Label>Customer</Label><Input value={customerName} disabled /></div>
                                <div><Label>Date Created</Label><Input value={new Date(ticket.created_date).toLocaleDateString()} disabled /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><Label htmlFor="subject">Subject</Label><Input id="subject" value={editedTicket.subject} onChange={(e) => setEditedTicket({...editedTicket, subject: e.target.value})} /></div>
                                <div><Label htmlFor="type">Type</Label><Select value={editedTicket.ticket_type} onValueChange={(val) => setEditedTicket({...editedTicket, ticket_type: val})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Repair Request">Repair Request</SelectItem><SelectItem value="Parts Request">Parts Request</SelectItem><SelectItem value="Information Request">Information Request</SelectItem><SelectItem value="Quotation">Quotation</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><Label htmlFor="urgency">Urgency</Label><Select value={editedTicket.urgency} onValueChange={(val) => setEditedTicket({...editedTicket, urgency: val})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Critical">Critical</SelectItem></SelectContent></Select></div>
                                <div><Label htmlFor="status">Status</Label><Select value={editedTicket.status} onValueChange={(val) => setEditedTicket({...editedTicket, status: val})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Resolved">Resolved</SelectItem><SelectItem value="Closed">Closed</SelectItem></SelectContent></Select></div>
                                <div><Label>Assigned Technician</Label><Select
                                    value={String(editedTicket.technician_id === '' ? 'none' : editedTicket.technician_id)}
                                    onValueChange={(val) => setEditedTicket({...editedTicket, technician_id: val === 'none' ? '' : Number(val)})}
                                >
                                    <SelectTrigger><SelectValue placeholder="Assign a technician"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {technicians.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.full_name}</SelectItem>)}
                                    </SelectContent>
                                </Select></div>
                            </div>
                            <div><Label htmlFor="description">Description</Label><Textarea id="description" value={editedTicket.description} onChange={(e) => setEditedTicket({...editedTicket, description: e.target.value})} rows={5} /></div>
                        </div>
                    ) : (
                        <div className="space-y-4 p-1">
                             {/* VIEWING DATA */}
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-gray-800">{ticket.subject}</h3>
                                <div className="flex gap-2">
                                    <Badge className={urgencyColors[ticket.urgency]}>{ticket.urgency}</Badge>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Badge className={`${statusColors[ticket.status]} cursor-pointer hover:opacity-80`}>{ticket.status}</Badge>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleStatusChange("Open")}>Open</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange("In Progress")}>In Progress</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange("Pending")}>Pending</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange("Resolved")}>Resolved</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange("Closed")}>Closed</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            <div className="text-sm text-gray-500 mb-2">
                                <p><strong>Created:</strong> {new Date(ticket.created_date).toLocaleDateString()} ({formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true })})</p>
                                <p><strong>Type:</strong> {ticket.ticket_type}</p>
                            </div>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border">{ticket.description}</p>
                            
                            <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2 flex items-center"><MessageSquare className="h-4 w-4 mr-2 text-gray-500" />Notes</h4>
                                <div className="space-y-3 mb-4">{renderNotes()}</div>
                                <div className="space-y-2">
                                    <Textarea placeholder="Add a new note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} />
                                    <Button onClick={handleAddNote} disabled={isSubmitting || !newNote.trim()} size="sm">
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CornerDownLeft className="h-4 w-4 mr-2" />}
                                        Add Note
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="pt-4 border-t">
                    {!isEditing ? (
                        <div className="flex w-full justify-between items-center gap-2">
                            <div className="flex gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitleComponent>Are you sure?</AlertDialogTitleComponent><AlertDialogDescription>This will permanently delete the ticket. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooterComponent>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onDelete(ticket.id)}>Delete</AlertDialogAction>
                                        </AlertDialogFooterComponent>
                                    </AlertDialogContent>
                                </AlertDialog>
                                {ticket.ticket_type !== 'Parts Request' && (
                                    <Button variant="outline" size="sm" onClick={() => handleConvert('service')}>
                                        <Wrench className="h-4 w-4 mr-2" />Convert to Service
                                    </Button>
                                )}
                                {ticket.ticket_type !== 'Repair Request' && ticket.ticket_type !== 'Quotation' && (
                                    <Button variant="outline" size="sm" onClick={() => handleConvert('order')}>
                                        <Package className="h-4 w-4 mr-2" />Convert to Order
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
                                <Button variant="default" size="sm" onClick={() => setIsEditing(true)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
                            </div>
                        </div>
                    ) : (
                         <div className="flex w-full justify-end items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}><XCircle className="h-4 w-4 mr-2" />Cancel</Button>
                            <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
