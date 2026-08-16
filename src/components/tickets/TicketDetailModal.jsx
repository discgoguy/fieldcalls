import React, { useState, useEffect } from 'react';
import { Ticket, TicketNote, TicketEvent, User } from '@/api/entities';
import { invokeApi , supabase } from '@/api/supabaseClient';
import { UploadFile } from '@/api/integrations';
import { canManageTicket } from '@/lib/ticketOwnership';
import { createPageUrl } from '@/utils';
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
  DropdownMenuSeparator,
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
import { Edit, Trash2, XCircle, Save, Loader2, MessageSquare, CornerDownLeft, Send, Lock, Globe, Upload, File as FileIcon, X, Plus, CheckCircle, ChevronDown, Package, Wrench, ShieldAlert, History as HistoryIcon, ExternalLink, UserCircle } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/dateUtils'; // Import date-fns for relative time
import { Checkbox } from "@/components/ui/checkbox";

export default function TicketDetailModal({ ticket, customers, technicians, parts, categories = [], isOpen, onOpenChange, onUpdate, onDelete, onAddNote, onConvert }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTicket, setEditedTicket] = useState(null);
    const [editedParts, setEditedParts] = useState([]);
    const [newNote, setNewNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [ticketNotes, setTicketNotes] = useState([]);
    const [ticketEvents, setTicketEvents] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [isCustomerVisible, setIsCustomerVisible] = useState(true);
    const [uploading, setUploading] = useState(false);

    const canManage = canManageTicket(ticket, currentUser?.technician_id, currentUser?.role === 'admin');
    const ownerName = technicians.find(t => t.id === ticket?.technician_id)?.full_name;

    useEffect(() => {
        (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })().then(setCurrentUser);
    }, []);

    useEffect(() => {
        if (ticket) {
            TicketNote.filter({ ticket_id: ticket.id }).then(notes => {
                 setTicketNotes(notes.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
            });
            TicketEvent.filter({ ticket_id: ticket.id }).then(events => {
                setTicketEvents((events || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
            }).catch(() => setTicketEvents([]));
        }
    }, [ticket, isOpen]);
    
    useEffect(() => {
        if (ticket) {
            setEditedTicket({ ...ticket, technician_id: ticket.technician_id === null || ticket.technician_id === undefined ? '' : ticket.technician_id });
            setEditedParts(ticket.parts ? ticket.parts.map(p => ({ ...p })) : []);
        }
        setIsEditing(false);
    }, [ticket]);

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setUploading(true);
        try {
            const uploadedFiles = [];
            for (const file of files) {
                const result = await UploadFile({ file });
                uploadedFiles.push({
                    url: result.file_url,
                    name: file.name
                });
            }
            setEditedTicket({
                ...editedTicket,
                attachments: [...(editedTicket.attachments || []), ...uploadedFiles]
            });
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (index) => {
        const newAttachments = (editedTicket.attachments || []).filter((_, i) => i !== index);
        setEditedTicket({ ...editedTicket, attachments: newAttachments });
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        const success = await onUpdate(ticket.id, { ...editedTicket, parts: editedParts.filter(p => p.part_id) });
        if (success) {
            setIsEditing(false);
        }
        setIsSubmitting(false);
    };

    const handleEditPartChange = (index, field, value) => {
        const updated = [...editedParts];
        updated[index][field] = value;
        setEditedParts(updated);
    };

    const addEditPart = () => setEditedParts([...editedParts, { part_id: '', quantity: 1 }]);

    const removeEditPart = (index) => setEditedParts(editedParts.filter((_, i) => i !== index));
    
    const handleAddNote = async () => {
        if (!newNote.trim() || !currentUser) return;
        setIsSubmitting(true);
        try {
            // 1. Create the structured note
            const note = await TicketNote.create({
                ticket_id: ticket.id,
                created_by: currentUser.email,
                author_name: currentUser.full_name || currentUser.email,
                author_role: 'technician',
                content: newNote.trim(),
                is_internal: !isCustomerVisible
            });

            // 1.5 Update last_reply_role
            // We update the ticket to reflect that the technician replied
            await onUpdate(ticket.id, { ...ticket, last_reply_role: 'technician' });

            // 2. Send notification
            if (isCustomerVisible) {
                await invokeApi('sendTicketNoteNotification', { noteId: note.id });
            }

            // 3. Also update the legacy string for backward compatibility if needed (optional, but good for list view snippets)
            // We'll append to legacy notes just in case, but maybe not necessary if we fully switch.
            // Let's keep the old behavior of onAddNote for now to maintain the "notes" column on the ticket itself
            // await onAddNote(ticket.id, newNote); // This was appending to the string.
            
            // Refresh notes
            const updatedNotes = await TicketNote.filter({ ticket_id: ticket.id });
            setTicketNotes(updatedNotes.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
            setNewNote("");
        } catch (e) {
            console.error("Failed to add note", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        // Optimistically update the UI if needed, or rely on onUpdate prop callback to fetch/refresh
        // For this implementation, we'll let the onUpdate prop handle the state refresh.
        // Also, prevent status change if currently editing to avoid conflict.
        if (!isEditing) {
            await onUpdate(ticket.id, { ...ticket, status: newStatus });
        }
    };

    const customerName = customers.find(c => c.id === ticket?.customer_id)?.company_name;
    
    const urgencyColors = { Low: "bg-blue-100 text-blue-800", Medium: "bg-yellow-100 text-yellow-800", High: "bg-orange-100 text-orange-800", Critical: "bg-red-100 text-red-800" };
    const statusColors = { Open: "bg-green-100 text-green-800", "In Progress": "bg-indigo-100 text-indigo-800", Pending: "bg-yellow-100 text-yellow-800", Resolved: "bg-gray-500 text-white", Closed: "bg-gray-500 text-white" };

    const renderNotes = () => {
        return (
            <div className="space-y-4">
                {/* Legacy Notes Section */}
                {ticket?.notes && (
                    <div className="mb-6">
                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Legacy / System Logs</h5>
                        <div className="space-y-2">
                            {ticket.notes.split('\n\n').filter(note => note.trim()).map((note, index) => {
                                const [meta, ...content] = note.split('\n');
                                return (
                                    <div key={index} className="text-sm p-3 bg-gray-50 rounded-md border opacity-75">
                                        <p className="font-semibold text-gray-500 text-xs">{meta.replace(/\[|\]/g, '')}</p>
                                        <p className="text-gray-700 whitespace-pre-wrap">{content.join('\n')}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Modern Notes Section */}
                {ticketNotes.length > 0 ? (
                    <div className="space-y-4">
                        {ticketNotes.map((note) => (
                            <div key={note.id} className={`flex ${note.author_role === 'technician' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 ${
                                    note.author_role === 'technician' 
                                        ? (note.is_internal ? 'bg-yellow-50 border-yellow-200 border' : 'bg-blue-50 border-blue-200 border') 
                                        : 'bg-green-50 border-green-200 border shadow-sm'
                                }`}>
                                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                                        <div className="flex items-center gap-1 font-semibold">
                                            {note.author_name}
                                            <span className="font-normal text-gray-500">({note.author_role})</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-400">
                                            {note.is_internal && <Lock className="w-3 h-3" title="Internal Only" />}
                                            {!note.is_internal && <Globe className="w-3 h-3" title="Visible to Customer" />}
                                            <span>{(note.created_date ? formatDistanceToNow(new Date(note.created_date), { addSuffix: true }) : '—')}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap text-gray-800">{note.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    !ticket?.notes && <p className="text-sm text-gray-500 italic text-center py-4">No messages yet.</p>
                )}
            </div>
        );
    };

    if (!ticket || !editedTicket) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
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
                                    value={editedTicket.technician_id === '' || editedTicket.technician_id === null || editedTicket.technician_id === undefined ? 'none' : String(editedTicket.technician_id)}
                                    onValueChange={(val) => setEditedTicket({...editedTicket, technician_id: val === 'none' ? '' : val})}
                                    disabled={!canManage}
                                >
                                    <SelectTrigger><SelectValue placeholder="Assign a technician"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {technicians.filter(t => t.active !== false).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.full_name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {!canManage && <p className="text-xs text-amber-700 mt-1">Only the current owner or an admin can transfer ownership.</p>}
                                </div>
                            </div>
                            <div><Label htmlFor="description">Description</Label><Textarea id="description" value={editedTicket.description} onChange={(e) => setEditedTicket({...editedTicket, description: e.target.value})} rows={5} /></div>

                            {/* Editable Parts List */}
                            <div className="space-y-2">
                                <Label className="font-semibold">Parts List</Label>
                                <div className="space-y-2 p-3 border rounded-lg bg-slate-50">
                                    {editedParts.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border">
                                            <div className="col-span-8">
                                                <Select value={item.part_id} onValueChange={(val) => handleEditPartChange(index, 'part_id', val)}>
                                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select part" /></SelectTrigger>
                                                    <SelectContent>
                                                        {(parts || []).filter(p => !p.is_obsolete).sort((a, b) => a.part_name.localeCompare(b.part_name)).map(p =>
                                                            <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number})</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-3">
                                                <Input type="number" className="h-8 text-sm" value={item.quantity} min="1" onChange={(e) => handleEditPartChange(index, 'quantity', parseInt(e.target.value) || 1)} />
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <Button type="button" variant="ghost" size="sm" onClick={() => removeEditPart(index)}>
                                                    <X className="h-3 w-3 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addEditPart}>
                                        <Plus className="mr-1 h-3 w-3" />Add Part
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Attachments</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        multiple
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        className="flex-1"
                                    />
                                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                </div>
                                {editedTicket.attachments && editedTicket.attachments.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        {editedTicket.attachments.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                                                <div className="flex items-center gap-2">
                                                    <FileIcon className="h-4 w-4 text-gray-500" />
                                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                                                        {file.name}
                                                    </a>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeAttachment(index)}
                                                >
                                                    <X className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                <p><strong>Created:</strong> {new Date(ticket.created_date).toLocaleDateString()} ({(ticket.created_date ? formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true }) : '—')})</p>
                                {ticket.created_by && <p><strong>Created by:</strong> {ticket.created_by}</p>}
                                <p className="flex items-center gap-1.5">
                                    <strong>Owner:</strong> {ownerName || 'Unassigned'}
                                    {!canManage && (
                                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-xs">
                                            <ShieldAlert className="w-3 h-3" />Locked to owner
                                        </span>
                                    )}
                                </p>
                                <p><strong>Type:</strong> {ticket.ticket_type}</p>
                                {(ticket.customer_po_number || ticket.purchase_order_number) && <p><strong>Customer PO #:</strong> {ticket.customer_po_number || ticket.purchase_order_number}</p>}
                                {ticket.machine_id && <p><strong>Machine ID:</strong> {ticket.machine_id}</p>}
                            </div>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border">{ticket.description}</p>
                            
                            {ticket.attachments && ticket.attachments.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="font-semibold mb-2 text-sm">Attachments:</h4>
                                    <div className="space-y-2">
                                        {(ticket.attachments || []).map((file, index) => (
                                            <a
                                                key={index}
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 p-2 bg-slate-50 rounded border hover:bg-slate-100 transition-colors"
                                            >
                                                <FileIcon className="h-4 w-4 text-gray-500" />
                                                <span className="text-sm">{file.name}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {ticket.parts && ticket.parts.length > 0 && (
                                <div className="mt-4 mb-4">
                                    <h4 className="font-semibold mb-2 text-sm">Requested Parts:</h4>
                                    <div className="bg-slate-50 rounded-md border overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-100 text-gray-600 font-medium border-b">
                                                <tr>
                                                    <th className="px-3 py-2">Part Number</th>
                                                    <th className="px-3 py-2">Part Name</th>
                                                    <th className="px-3 py-2 text-right">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ticket.parts.map((item, i) => {
                                                    const part = parts?.find(p => p.id === item.part_id);
                                                    return (
                                                        <tr key={i} className="border-b last:border-0">
                                                            <td className="px-3 py-2">{part?.part_number || 'N/A'}</td>
                                                            <td className="px-3 py-2">{part?.part_name || 'Unknown Part'}</td>
                                                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {ticket.resolved_at && (
                                <div className="p-3 border rounded-md bg-green-50 border-green-200 space-y-1">
                                    <h4 className="font-semibold text-sm text-green-800 flex items-center"><CheckCircle className="h-4 w-4 mr-1.5" />Resolution</h4>
                                    <p className="text-sm text-green-900">
                                        Resolved by <strong>{ticket.resolved_by_name || 'Unknown'}</strong> on {new Date(ticket.resolved_at).toLocaleString()}
                                    </p>
                                    {ticket.resolution_notes && <p className="text-sm text-green-900 whitespace-pre-wrap">{ticket.resolution_notes}</p>}
                                    {ticket.resulting_reference_id && (
                                        <a
                                            href={ticket.resulting_reference_type === 'on_site_service'
                                                ? `${createPageUrl('OnSiteService')}?service_call_id=${encodeURIComponent(ticket.resulting_reference_id)}`
                                                : `${createPageUrl('PartsOrder')}?order_id=${encodeURIComponent(ticket.resulting_reference_id)}`}
                                            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline font-medium"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            View {ticket.resulting_reference_type === 'on_site_service' ? 'Service Call' : 'Parts Order'} ({ticket.resulting_reference_id})
                                        </a>
                                    )}
                                </div>
                            )}

                            <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2 flex items-center"><HistoryIcon className="h-4 w-4 mr-2 text-gray-500" />Activity Timeline</h4>
                                {ticketEvents.length > 0 ? (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2 text-sm">
                                        {ticketEvents.map(ev => (
                                            <div key={ev.id} className="flex items-start justify-between gap-2 text-gray-600 border-b last:border-0 pb-1.5">
                                                <span>
                                                    {ev.event_type === 'created' && <>Created by <strong>{ev.actor_name || 'someone'}</strong></>}
                                                    {ev.event_type === 'owner_assigned' && <>Assigned to <strong>{ev.to_value}</strong></>}
                                                    {ev.event_type === 'owner_transferred' && <>Ownership transferred from <strong>{ev.from_value}</strong> to <strong>{ev.to_value}</strong> by {ev.actor_name}</>}
                                                    {ev.event_type === 'status_changed' && <>Status changed from <strong>{ev.from_value}</strong> to <strong>{ev.to_value}</strong> by {ev.actor_name}</>}
                                                    {ev.event_type === 'resolved' && <>Resolved by <strong>{ev.actor_name}</strong></>}
                                                    {ev.event_type === 'converted' && <>Converted to {ev.details?.reference_type === 'on_site_service' ? 'Service Call' : 'Parts Order'} <strong>{ev.to_value}</strong></>}
                                                    {ev.event_type === 'reminder_sent' && <>Reminder email sent to <strong>{ev.to_value}</strong></>}
                                                    {ev.event_type === 'escalated' && <>Escalated to manager (no activity for a while)</>}
                                                </span>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDistanceToNow(new Date(ev.created_date), { addSuffix: true })}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">No activity recorded yet.</p>
                                )}
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2 flex items-center"><MessageSquare className="h-4 w-4 mr-2 text-gray-500" />Conversation & Notes</h4>
                                <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {renderNotes()}
                                </div>
                                <div className="bg-slate-50 p-3 rounded-lg border space-y-3">
                                    <Textarea 
                                        placeholder="Type a note..." 
                                        value={newNote} 
                                        onChange={(e) => setNewNote(e.target.value)} 
                                        rows={3} 
                                        className="bg-white"
                                    />
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox 
                                                id="customer-visible" 
                                                checked={isCustomerVisible} 
                                                onCheckedChange={setIsCustomerVisible} 
                                            />
                                            <Label htmlFor="customer-visible" className="text-sm font-medium cursor-pointer">
                                                Visible to Customer
                                            </Label>
                                        </div>
                                        <Button onClick={handleAddNote} disabled={isSubmitting || !newNote.trim()} size="sm">
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                            Send Note
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="pt-4 border-t">
                    {!isEditing ? (
                        <div className="flex w-full justify-end items-center gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="mr-auto" disabled={!canManage} title={!canManage ? `Only ${ownerName || 'the owner'} or an admin can delete this ticket` : undefined}><Trash2 className="h-4 w-4 mr-2" />Delete Ticket</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitleComponent>Are you sure?</AlertDialogTitleComponent><AlertDialogDescription>This will permanently delete the ticket. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooterComponent>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(ticket.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooterComponent>
                                </AlertDialogContent>
                            </AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={!canManage} title={!canManage ? `Only ${ownerName || 'the owner'} or an admin can convert or close this ticket` : undefined}>
                                        Convert / Close
                                        <ChevronDown className="h-3 w-3 ml-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {/* Convert options */}
                                    {ticket.ticket_type === 'Parts Request' ? (
                                        <DropdownMenuItem onClick={() => { onConvert && onConvert(ticket.id, 'order'); onOpenChange(false); }}>
                                            <Package className="h-4 w-4 mr-2 text-blue-600" />Convert to Parts Order
                                        </DropdownMenuItem>
                                    ) : ticket.ticket_type === 'Repair Request' || ticket.ticket_type === 'Other' ? (
                                        <DropdownMenuItem onClick={() => { onConvert && onConvert(ticket.id, 'service'); onOpenChange(false); }}>
                                            <Wrench className="h-4 w-4 mr-2 text-blue-600" />Convert to Service Call
                                        </DropdownMenuItem>
                                    ) : (
                                        <>
                                            <DropdownMenuItem onClick={() => { onConvert && onConvert(ticket.id, 'order'); onOpenChange(false); }}>
                                                <Package className="h-4 w-4 mr-2 text-blue-600" />Convert to Parts Order
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => { onConvert && onConvert(ticket.id, 'service'); onOpenChange(false); }}>
                                                <Wrench className="h-4 w-4 mr-2 text-blue-600" />Convert to Service Call
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleStatusChange('Resolved')}>
                                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />Mark as Resolved
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleStatusChange('Closed')}>
                                                <XCircle className="h-4 w-4 mr-2 text-gray-500" />Mark as Closed
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Dismiss</Button>
                            <Button variant="default" size="sm" onClick={() => setIsEditing(true)}><Edit className="h-4 w-4 mr-2" />Edit</Button>
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