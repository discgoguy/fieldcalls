import React, { useState, useEffect } from "react";
import { Customer, User } from '@/api/entities';
import { invokeApi } from '@/api/supabaseClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Loader2, AlertTriangle, Search, CheckCircle, Pencil, Mail, Link as LinkIcon, UserMinus, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { applySortSettings, sortArray } from '@/components/utils/sortUtils';

export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [isPortalDialogOpen, setIsPortalDialogOpen] = useState(false);
    const [portalCustomer, setPortalCustomer] = useState(null);
    const [linkedUsers, setLinkedUsers] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [selectedUserIdToLink, setSelectedUserIdToLink] = useState("");
    const [portalLoading, setPortalLoading] = useState(false);

    const [newCustomer, setNewCustomer] = useState({
        customer_identifier: "",
        company_name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        is_nonsa: false,
        inactive: false
    });

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const [data, sortSettings] = await Promise.all([
                Customer.list(),
                applySortSettings()
            ]);
            const sortedData = sortArray(data || [], sortSettings.customers);
            setCustomers(sortedData);
            setFilteredCustomers(sortedData);
        } catch (e) {
            setError("Failed to load customers.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    useEffect(() => {
        const results = customers.filter(customer =>
            (customer.customer_identifier && customer.customer_identifier.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (customer.company_name && customer.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (customer.contact_person && customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredCustomers(results);
    }, [searchTerm, customers]);

    const handleEditCustomer = (customer) => {
        setEditingCustomer(customer);
        setNewCustomer({
            customer_identifier: customer.customer_identifier || "",
            company_name: customer.company_name || "",
            contact_person: customer.contact_person || "",
            phone: customer.phone || "",
            email: customer.email || "",
            address: customer.address || "",
            is_nonsa: customer.is_nonsa || false,
            inactive: customer.inactive || false
        });
        setIsDialogOpen(true);
        setError("");
    };

    const handleDialogClose = (open) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingCustomer(null);
            setNewCustomer({ customer_identifier: "", company_name: "", contact_person: "", phone: "", email: "", address: "", is_nonsa: false, inactive: false });
            setError("");
        }
    };

    const handleOpenPortalDialog = async (customer) => {
        setPortalCustomer(customer);
        setIsPortalDialogOpen(true);
        setPortalLoading(true);
        setError("");
        try {
            // Fetch all users to find linked ones and available ones
            // Note: Ideally we would use a filter for linked users, but listing all allows us to build both lists
            const allUsers = await User.list(); 
            if (allUsers) {
                setLinkedUsers(allUsers.filter(u => u.customer_id === customer.id));
                setAvailableUsers(allUsers.filter(u => !u.customer_id || u.customer_id === ""));
            }
        } catch (e) {
            console.error("Failed to load users", e);
            setError("Failed to load users. You may not have permission.");
        } finally {
            setPortalLoading(false);
        }
    };

    const handleLinkUser = async () => {
        if (!selectedUserIdToLink || !portalCustomer) return;
        setPortalLoading(true);
        try {
            await User.update(selectedUserIdToLink, {
                customer_id: portalCustomer.id,
                is_customer: true
            });
            // Refresh lists
            const allUsers = await User.list();
            if (allUsers) {
                setLinkedUsers(allUsers.filter(u => u.customer_id === portalCustomer.id));
                setAvailableUsers(allUsers.filter(u => !u.customer_id || u.customer_id === ""));
            }
            setSuccessMessage("User linked successfully.");
            setSelectedUserIdToLink("");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (e) {
            setError("Failed to link user: " + e.message);
        } finally {
            setPortalLoading(false);
        }
    };

    const handleUnlinkUser = async (userId) => {
        if (!portalCustomer) return;
        setPortalLoading(true);
        try {
            await User.update(userId, {
                customer_id: null,
                is_customer: false
            });
            // Refresh lists
            const allUsers = await User.list();
            if (allUsers) {
                setLinkedUsers(allUsers.filter(u => u.customer_id === portalCustomer.id));
                setAvailableUsers(allUsers.filter(u => !u.customer_id || u.customer_id === ""));
            }
            setSuccessMessage("User unlinked successfully.");
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (e) {
            setError("Failed to unlink user: " + e.message);
        } finally {
            setPortalLoading(false);
        }
    };

    const handleSendInvite = async (email) => {
        if (!email || !portalCustomer) return;
        setPortalLoading(true);
        try {
            const portalUrl = window.location.origin;
            await invokeApi('sendPortalInvitation', {
                email,
                customerName: portalCustomer.company_name,
                portalUrl
            });
            setSuccessMessage(`Invitation sent to ${email}`);
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (e) {
            setError("Failed to send invitation: " + e.message);
        } finally {
            setPortalLoading(false);
        }
    };

    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");
        try {
            if (!newCustomer.customer_identifier || !newCustomer.company_name || !newCustomer.contact_person || !newCustomer.phone) {
                throw new Error("Identifier, Company Name, Contact Person, and Phone are required.");
            }
            if (editingCustomer) {
                await Customer.update(editingCustomer.id, newCustomer);
                setSuccessMessage("Customer successfully updated!");
            } else {
                await Customer.create(newCustomer);
                setSuccessMessage("Customer successfully created!");
            }
            
            handleDialogClose(false);
            await loadCustomers();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save customer. Identifier might already exist.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Users className="mr-2" />Customers</CardTitle>
                        <CardDescription>Manage your customer database.</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" />Add Customer</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingCustomer ? "Edit Customer" : "Add a New Customer"}</DialogTitle>
                            </DialogHeader>
                            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                            <form onSubmit={handleSaveCustomer} className="space-y-4 pt-4">
                                <div>
                                    <Label htmlFor="customer_identifier">Customer Identifier *</Label>
                                    <Input id="customer_identifier" value={newCustomer.customer_identifier} onChange={(e) => setNewCustomer({...newCustomer, customer_identifier: e.target.value})} required />
                                </div>
                                <div>
                                    <Label htmlFor="company_name">Company Name *</Label>
                                    <Input id="company_name" value={newCustomer.company_name} onChange={(e) => setNewCustomer({...newCustomer, company_name: e.target.value})} required />
                                </div>
                                <div>
                                    <Label htmlFor="contact_person">Contact Person *</Label>
                                    <Input id="contact_person" value={newCustomer.contact_person} onChange={(e) => setNewCustomer({...newCustomer, contact_person: e.target.value})} required />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Phone *</Label>
                                    <Input id="phone" type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} required />
                                </div>
                                <div>
                                    <Label htmlFor="email">Email</Label>
                                    <Input id="email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})} />
                                </div>
                                 <div>
                                    <Label htmlFor="address">Address</Label>
                                    <Textarea id="address" value={newCustomer.address} onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})} />
                                </div>
                                <div className="flex items-center space-x-2 p-3 border rounded-lg bg-blue-50">
                                    <input
                                        type="checkbox"
                                        id="is_nonsa"
                                        checked={newCustomer.is_nonsa}
                                        onChange={(e) => setNewCustomer({...newCustomer, is_nonsa: e.target.checked})}
                                        className="rounded"
                                    />
                                    <Label htmlFor="is_nonsa" className="cursor-pointer font-semibold">
                                        NonSA Customer (Use NonSA pricing)
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
                                    <input
                                        type="checkbox"
                                        id="inactive"
                                        checked={newCustomer.inactive}
                                        onChange={(e) => setNewCustomer({...newCustomer, inactive: e.target.checked})}
                                        className="rounded"
                                    />
                                    <Label htmlFor="inactive" className="cursor-pointer font-semibold">
                                        Inactive Customer (Hide from dropdowns)
                                    </Label>
                                </div>
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingCustomer ? "Update Customer" : "Save Customer")}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isPortalDialogOpen} onOpenChange={setIsPortalDialogOpen}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Portal Access: {portalCustomer?.company_name}</DialogTitle>
                                <CardDescription>Manage user access to the customer portal.</CardDescription>
                            </DialogHeader>
                            
                            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                            {successMessage && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}

                            <div className="space-y-6 py-4">
                                {/* Linked Users Section */}
                                <div className="space-y-3">
                                    <h3 className="font-medium text-sm flex items-center"><Users className="w-4 h-4 mr-2" /> Linked Users</h3>
                                    {portalLoading && linkedUsers.length === 0 ? (
                                        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin" /></div>
                                    ) : linkedUsers.length > 0 ? (
                                        <div className="space-y-2">
                                            {linkedUsers.map(u => (
                                                <div key={u.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-md border text-sm">
                                                    <div className="truncate max-w-[180px]">
                                                        <div className="font-medium">{u.full_name}</div>
                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" h-6 w-6 onClick={() => handleSendInvite(u.email)} title="Send Portal Link">
                                                            <Mail className="h-3 w-3 text-blue-500" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" h-6 w-6 onClick={() => handleUnlinkUser(u.id)} title="Unlink User">
                                                            <UserMinus className="h-3 w-3 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No users linked yet.</p>
                                    )}
                                </div>

                                {/* Link New User Section */}
                                <div className="space-y-3 pt-4 border-t">
                                    <h3 className="font-medium text-sm flex items-center"><LinkIcon className="w-4 h-4 mr-2" /> Link Existing User</h3>
                                    <div className="flex gap-2">
                                        <select 
                                            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={selectedUserIdToLink}
                                            onChange={(e) => setSelectedUserIdToLink(e.target.value)}
                                            disabled={portalLoading}
                                        >
                                            <option value="">Select a user...</option>
                                            {availableUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                                            ))}
                                        </select>
                                        <Button onClick={handleLinkUser} disabled={!selectedUserIdToLink || portalLoading} size="sm">
                                            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                    <Alert className="bg-blue-50 border-blue-100 mt-2">
                                        <AlertDescription className="text-xs text-blue-800">
                                            <strong>Note:</strong> New users must be invited via the 
                                            <a href="/dashboard/users" target="_blank" className="underline ml-1">Dashboard</a> 
                                            first. Once they register, they will appear in the list above to be linked.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="mt-4 relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by identifier, company, contact, or email..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                {successMessage && <Alert className="mb-4 bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : error && !isDialogOpen ? (
                    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Identifier</TableHead>
                                <TableHead>Company Name</TableHead>
                                <TableHead>Contact Person</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell>{c.customer_identifier}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {c.company_name}
                                            {c.is_nonsa && <Badge className="text-xs bg-pink-100 text-pink-800 hover:bg-pink-200">NonSA</Badge>}
                                            {c.inactive && <Badge className="text-xs bg-gray-700 text-white hover:bg-gray-800">Inactive</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell>{c.contact_person}</TableCell>
                                    <TableCell>{c.phone}</TableCell>
                                    <TableCell>{c.email}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditCustomer(c)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenPortalDialog(c)} title="Manage Portal Access">
                                            <Users className="h-4 w-4 text-blue-600" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan="6" className="text-center">No customers found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}