import React, { useState, useEffect, useRef } from 'react';
import { Ticket, TicketNote, User as DbUser } from '@/api/entities';
import { invokeApi } from '@/api/supabaseClient';
import { UploadFile } from '@/api/integrations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, Send, User, Lock, File as FileIcon, Paperclip, X } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from '@/lib/dateUtils';

export default function PortalTicketDetail({ ticket, isOpen, onOpenChange, currentUser }) {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const scrollRef = useRef(null);

    const loadNotes = async () => {
        if (!ticket) return;
        setLoadingNotes(true);
        try {
            const data = await TicketNote.filter({ ticket_id: ticket.id });
            // Filter out internal notes (client-side security, ideally backend)
            const visibleNotes = data.filter(n => !n.is_internal).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            setNotes(visibleNotes);
        } catch (e) {
            console.error("Failed to load notes", e);
        } finally {
            setLoadingNotes(false);
        }
    };

    useEffect(() => {
        if (isOpen && ticket) {
            loadNotes();
        }
    }, [isOpen, ticket]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [notes]);

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
            
            // Add to ticket attachments
            const currentAttachments = ticket.attachments || [];
            await Ticket.update(ticket.id, {
                attachments: [...currentAttachments, ...uploadedFiles]
            });
            
            setAttachments([...attachments, ...uploadedFiles]);
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (index) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const handleSendNote = async () => {
        if (!newNote.trim()) return;
        setIsSubmitting(true);
        try {
            const note = await TicketNote.create({
                ticket_id: ticket.id,
                created_by: currentUser.email,
                author_name: currentUser.full_name || currentUser.email,
                author_role: 'customer',
                content: newNote.trim(),
                is_internal: false
            });

            // Update ticket last_reply_role
            await Ticket.update(ticket.id, { last_reply_role: 'customer' });

            await invokeApi('ticketNotifications', { action: 'note', noteId: note.id });
            
            setNewNote("");
            await loadNotes();
        } catch (e) {
            console.error("Failed to send note", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!ticket) return null;

    const statusColors = { 
        Open: "bg-blue-100 text-blue-800", 
        "In Progress": "bg-yellow-100 text-yellow-800", 
        Pending: "bg-orange-100 text-orange-800", 
        Resolved: "bg-green-100 text-green-800", 
        Closed: "bg-gray-100 text-gray-800" 
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl">{ticket.subject}</DialogTitle>
                            <DialogDescription>Ticket #{ticket.ticket_number}</DialogDescription>
                        </div>
                        <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                    </div>
                </DialogHeader>
                
                <div className="flex-1 flex flex-col overflow-hidden">
                    <ScrollArea className="flex-1 p-6 pt-0">
                        {/* Ticket Details */}
                        <div className="bg-slate-50 rounded-lg p-4 mb-6 border">
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div><span className="font-semibold text-gray-500">Type:</span> {ticket.ticket_type}</div>
                                <div><span className="font-semibold text-gray-500">Created:</span> {new Date(ticket.created_date).toLocaleDateString()}</div>
                                <div><span className="font-semibold text-gray-500">Urgency:</span> {ticket.urgency}</div>
                                {ticket.purchase_order_number && <div><span className="font-semibold text-gray-500">PO #:</span> {ticket.purchase_order_number}</div>}
                            </div>
                            <div className="text-sm text-gray-800">
                                <h4 className="font-semibold text-gray-500 mb-1">Description:</h4>
                                <p className="whitespace-pre-wrap">{ticket.description}</p>
                            </div>
                            
                            {ticket.attachments && ticket.attachments.length > 0 && (
                                <div className="mt-3">
                                    <h4 className="font-semibold text-gray-500 text-sm mb-2">Attachments:</h4>
                                    <div className="space-y-2">
                                        {(ticket.attachments || []).map((file, index) => (
                                            <a
                                                key={index}
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 p-2 bg-white rounded border hover:bg-gray-50 transition-colors"
                                            >
                                                <FileIcon className="h-4 w-4 text-gray-500" />
                                                <span className="text-sm">{file.name}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Discussion */}
                        <div className="space-y-6">
                            <h3 className="font-semibold flex items-center text-gray-700">
                                <MessageSquare className="w-4 h-4 mr-2" /> Discussion
                            </h3>
                            
                            {loadingNotes ? (
                                <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                            ) : notes.length === 0 ? (
                                <p className="text-center text-gray-400 text-sm italic py-4">No messages yet.</p>
                            ) : (
                                <div className="space-y-4">
                                    {notes.map((note) => (
                                        <div key={note.id} className={`flex ${note.author_role === 'customer' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-lg p-3 ${
                                                note.author_role === 'customer' 
                                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                                            }`}>
                                                <div className="flex items-center gap-2 text-xs opacity-90 mb-1">
                                                    <span className="font-bold">{note.author_name}</span>
                                                    <span>• {note.created_date ? formatDistanceToNow(new Date(note.created_date), { addSuffix: true }) : '—'}</span>
                                                </div>
                                                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={scrollRef} />
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 border-t bg-white space-y-3">
                        <div className="flex gap-2">
                            <label className="cursor-pointer">
                                <Input
                                    type="file"
                                    multiple
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    className="hidden"
                                />
                                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                                    <span>
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Paperclip className="w-4 h-4 mr-2" />}
                                        Attach Files
                                    </span>
                                </Button>
                            </label>
                        </div>
                        
                        {attachments.length > 0 && (
                            <div className="space-y-1">
                                {attachments.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm">
                                        <div className="flex items-center gap-2">
                                            <FileIcon className="h-4 w-4 text-gray-500" />
                                            <span>{file.name}</span>
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
                        
                        <div className="flex gap-2">
                            <Textarea 
                                placeholder="Type a reply..." 
                                value={newNote} 
                                onChange={(e) => setNewNote(e.target.value)}
                                className="min-h-[80px] resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendNote();
                                    }
                                }}
                            />
                            <Button 
                                onClick={handleSendNote} 
                                disabled={isSubmitting || !newNote.trim()}
                                className="h-auto px-6"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-gray-400 text-center">
                            Replies are emailed to the support team immediately.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}