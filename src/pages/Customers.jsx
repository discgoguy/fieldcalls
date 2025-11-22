import React, { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Loader2, AlertTriangle, Search, CheckCircle, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

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
    const [newCustomer, setNewCustomer] = useState({
        customer_identifier: "",
        company_name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: ""
    });

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const filter = await withTenantFilter();
            const data = await base44.entities.Customer.filter(filter);
            setCustomers(data || []);
            setFilteredCustomers(data || []);
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
            customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.email.toLowerCase().includes(searchTerm.toLowerCase())
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
            address: customer.address || ""
        });
        setIsDialogOpen(true);
        setError("");
    };

    const handleDialogClose = (open) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingCustomer(null);
            setNewCustomer({ customer_identifier: "", company_name: "", contact_person: "", phone: "", email: "", address: "" });
            setError("");
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
                await base44.entities.Customer.update(editingCustomer.id, newCustomer);
                setSuccessMessage("Customer successfully updated!");
            } else {
                const customerWithTenant = await addTenantId(newCustomer);
                await base44.entities.Customer.create(customerWithTenant);
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
                                <Button type="submit" disabled={isSubmitting} className="w-full">
                                    {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingCustomer ? "Update Customer" : "Save Customer")}
                                </Button>
                            </form>
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
                                    <TableCell>{c.company_name}</TableCell>
                                    <TableCell>{c.contact_person}</TableCell>
                                    <TableCell>{c.phone}</TableCell>
                                    <TableCell>{c.email}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditCustomer(c)}>
                                            <Pencil className="h-4 w-4" />
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