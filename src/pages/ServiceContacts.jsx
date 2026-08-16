import React, { useState, useEffect } from "react";
import { Technician } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Phone, Mail, User } from "lucide-react";

export default function ServiceContactsPage() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadContacts = async () => {
            try {
                const allTechnicians = await Technician.list();
                // Filter for Customer Service department (case-insensitive)
                const customerServiceContacts = (allTechnicians || []).filter(t => 
                    t.active !== false && 
                    t.department && 
                    t.department.toLowerCase() === 'customer service'
                );
                setContacts(customerServiceContacts);
            } catch (e) {
                console.error("Failed to load contacts", e);
            } finally {
                setLoading(false);
            }
        };
        loadContacts();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Service Contacts</h1>
                <p className="text-gray-500 mt-2">Contact our Customer Service team for assistance.</p>
            </div>

            {contacts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contacts.map(contact => (
                        <Card key={contact.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                                        {contact.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{contact.full_name}</CardTitle>
                                        <p className="text-sm text-gray-500">{contact.department}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-4">
                                {contact.phone && (
                                    <div className="flex items-center gap-3 text-gray-600">
                                        <Phone className="h-4 w-4" />
                                        <a href={`tel:${contact.phone}`} className="hover:text-blue-600 transition-colors">
                                            {contact.phone}
                                        </a>
                                    </div>
                                )}
                                {contact.email && (
                                    <div className="flex items-center gap-3 text-gray-600">
                                        <Mail className="h-4 w-4" />
                                        <a href={`mailto:${contact.email}`} className="hover:text-blue-600 transition-colors truncate">
                                            {contact.email}
                                        </a>
                                    </div>
                                )}
                                {contact.specialties && contact.specialties.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {contact.specialties.map((s, i) => (
                                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No Contacts Found</h3>
                    <p className="text-gray-500">No service contacts are currently listed.</p>
                </div>
            )}
        </div>
    );
}