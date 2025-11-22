
import React, { useState, useEffect, useCallback } from "react";
import { Transaction } from "@/entities/Transaction";
import { Customer } from "@/entities/Customer";
import { Part } from "@/entities/Part";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ClipboardList, Filter, Wrench, DollarSign, Edit, Trash2, Calendar as CalendarIcon, Truck, ChevronsUpDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { withTenantFilter } from '@/components/utils/tenant';


const PAGE_SIZE = 50;

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [allCustomers, setAllCustomers] = useState({});
    const [allParts, setAllParts] = useState({});
    const [customersForFilter, setCustomersForFilter] = useState([]); // For the filter dropdown
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Modal states
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedTransaction, setEditedTransaction] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false);

    const [filters, setFilters] = useState({
        type: "all",
        customer_id: "all",
        date: {
            from: subDays(new Date(), 30),
            to: new Date(),
        },
    });

    const typeColors = {
        on_site_service: "bg-blue-100 text-blue-800",
        service_expense: "bg-yellow-100 text-yellow-800",
        parts_order: "bg-green-100 text-green-800",
        shipping_expense: "bg-orange-100 text-orange-800",
        inventory_addition: "bg-purple-100 text-purple-800",
        warranty_replacement: "bg-red-100 text-red-800",
        no_charge: "bg-gray-100 text-gray-800",
        service_agreement: "bg-indigo-100 text-indigo-800"
    };
    
    const typeIcons = {
        on_site_service: <Wrench className="h-4 w-4" />,
        service_expense: <DollarSign className="h-4 w-4" />,
        parts_order: <ClipboardList className="h-4 w-4" />,
        shipping_expense: <Truck className="h-4 w-4" />,
        inventory_addition: <ClipboardList className="h-4 w-4" />,
        warranty_replacement: <Wrench className="h-4 w-4" />,
        no_charge: <DollarSign className="h-4 w-4" />,
        service_agreement: <Wrench className="h-4 w-4" />
    };

    const fetchAndEnrichTransactions = useCallback(async (pageNum, currentTransactions) => {
        setLoading(pageNum === 1);
        setLoadingMore(pageNum > 1);
        setError("");

        try {
            let apiFilter = {};
            if (filters.type !== 'all') {
                apiFilter.transaction_type = filters.type;
            }
            if (filters.customer_id !== 'all') {
                apiFilter.customer_id = filters.customer_id;
            }
            
            if (filters.date.from) {
                apiFilter.date = { ...apiFilter.date, $gte: format(filters.date.from, 'yyyy-MM-dd') };
            }
            if (filters.date.to) {
                const toDate = new Date(filters.date.to);
                toDate.setDate(toDate.getDate() + 1);
                apiFilter.date = { ...apiFilter.date, $lt: format(toDate, 'yyyy-MM-dd') };
            }

            const newTransData = await Transaction.filter(await withTenantFilter(apiFilter), "-date", PAGE_SIZE, (pageNum - 1) * PAGE_SIZE);

            if (newTransData.length < PAGE_SIZE) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            if (newTransData.length > 0) {
                 const customerIds = [...new Set(newTransData.map(t => t.customer_id).filter(Boolean))];
                 const partIds = [...new Set(newTransData.filter(t => !['service_expense', 'shipping_expense'].includes(t.transaction_type)).map(t => t.part_id).filter(Boolean))];

                 const [customerData, partData] = await Promise.all([
                     customerIds.length > 0 ? Customer.filter(await withTenantFilter({ id: { $in: customerIds } })) : Promise.resolve([]),
                     partIds.length > 0 ? Part.filter(await withTenantFilter({ id: { $in: partIds } })) : Promise.resolve([])
                 ]);
                
                const customersById = customerData.reduce((acc, c) => ({ ...acc, [c.id]: c.company_name }), {});
                const partsById = partData.reduce((acc, p) => ({ ...acc, [p.id]: p.part_name }), {});
                setAllCustomers(prev => ({...prev, ...customersById}));
                setAllParts(prev => ({...prev, ...partsById}));

                const combinedTransactions = [...currentTransactions, ...newTransData];
                setTransactions(combinedTransactions);
            } else if (pageNum === 1) {
                setTransactions([]);
            }

        } catch (e) {
            setError("Failed to load transaction data. Please try refreshing.");
            console.error(e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters]);

    useEffect(() => {
        const loadFilterData = async () => {
            try {
                const customerData = await Customer.filter(await withTenantFilter({})); // Fetch all customers for the current tenant
                setCustomersForFilter(customerData || []);
            } catch (e) {
                console.error("Failed to load customers for filter", e);
            }
        };
        loadFilterData();
    }, []);

    useEffect(() => {
        setTransactions([]);
        setPage(1);
        setHasMore(true);
        fetchAndEnrichTransactions(1, []);
    }, [fetchAndEnrichTransactions]); 
    
    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchAndEnrichTransactions(nextPage, transactions);
    };

    const handleRowClick = (transaction) => {
        setSelectedTransaction(transaction);
        setEditedTransaction({
            ...transaction,
            date: transaction.date ? format(new Date(transaction.date), 'yyyy-MM-dd') : ''
        });
        setIsDetailModalOpen(true);
        setIsEditing(false);
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        try {
            const updatedData = {
                ...editedTransaction,
                date: editedTransaction.date ? new Date(`${editedTransaction.date}T00:00:00`) : editedTransaction.date,
                total_cost: editedTransaction.total_cost ? parseFloat(editedTransaction.total_cost) : null,
                quantity: editedTransaction.quantity ? parseInt(editedTransaction.quantity) : null,
                travel_hours: editedTransaction.travel_hours ? parseFloat(editedTransaction.travel_hours) : null,
                onsite_hours: editedTransaction.onsite_hours ? parseFloat(editedTransaction.onsite_hours) : null,
                kilometers: editedTransaction.kilometers ? parseFloat(editedTransaction.kilometers) : null,
                food_expense: editedTransaction.food_expense ? parseFloat(editedTransaction.food_expense) : null,
                hotel_expense: editedTransaction.hotel_expense ? parseFloat(editedTransaction.hotel_expense) : null,
                tolls_expense: editedTransaction.tolls_expense ? parseFloat(editedTransaction.tolls_expense) : null,
                shipping_cost: editedTransaction.shipping_cost ? parseFloat(editedTransaction.shipping_cost) : null,
            };
            
            await Transaction.update(selectedTransaction.id, updatedData);
            setIsDetailModalOpen(false);
            setIsEditing(false);
            setSuccessMessage("Transaction updated successfully!");
            
            // Refresh data
            setTransactions([]);
            setPage(1);
            setHasMore(true);
            fetchAndEnrichTransactions(1, []);
            
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (e) {
            setError("Failed to update transaction: " + (e.message || "Unknown error"));
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await Transaction.delete(selectedTransaction.id);
            setIsDetailModalOpen(false);
            setShowDeleteDialog(false);
            setSuccessMessage("Transaction deleted successfully!");
            
            // Refresh data
            setTransactions([]);
            setPage(1);
            setHasMore(true);
            fetchAndEnrichTransactions(1, []);
            
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (e) {
            setError("Failed to delete transaction: " + (e.message || "Unknown error"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><ClipboardList className="mr-2" />All Transactions</CardTitle>
                <CardDescription>A searchable and filterable log of all service calls, parts orders, and inventory changes. Click on any row to view details.</CardDescription>
                
                <div className="flex flex-wrap items-center gap-4 pt-4">
                    <div className="flex items-center gap-2">
                        <Label>Type:</Label>
                        <Select value={filters.type} onValueChange={(value) => setFilters(f => ({...f, type: value}))}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="on_site_service">On-Site Service (Parts)</SelectItem>
                                <SelectItem value="service_expense">On-Site Service (Expenses)</SelectItem>
                                <SelectItem value="parts_order">Parts Order</SelectItem>
                                <SelectItem value="shipping_expense">Shipping Expense</SelectItem>
                                <SelectItem value="inventory_addition">Inventory Addition</SelectItem>
                                <SelectItem value="warranty_replacement">Warranty Replacement</SelectItem>
                                <SelectItem value="no_charge">No Charge</SelectItem>
                                <SelectItem value="service_agreement">Service Agreement</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label>Customer:</Label>
                        <Popover open={isCustomerFilterOpen} onOpenChange={setIsCustomerFilterOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isCustomerFilterOpen}
                                    className="w-[250px] justify-between"
                                >
                                    {filters.customer_id !== 'all'
                                        ? customersForFilter.find(c => c.id === filters.customer_id)?.company_name
                                        : "Select customer..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search customer..." />
                                    <CommandEmpty>No customer found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={() => {
                                                setFilters(f => ({ ...f, customer_id: 'all' }));
                                                setIsCustomerFilterOpen(false);
                                            }}
                                            className="cursor-pointer"
                                            value="all-customers"
                                        >
                                            All Customers
                                        </CommandItem>
                                        {customersForFilter.map((customer) => (
                                            <CommandItem
                                                key={customer.id}
                                                value={customer.company_name}
                                                onSelect={() => {
                                                    setFilters(f => ({ ...f, customer_id: customer.id }));
                                                    setIsCustomerFilterOpen(false);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                {customer.company_name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label>Date:</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className="w-[300px] justify-start text-left font-normal"
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {filters.date?.from ? (
                                        filters.date.to ? (
                                            <>
                                                {format(filters.date.from, "LLL dd, y")} -{" "}
                                                {format(filters.date.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(filters.date.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={filters.date?.from}
                                    selected={filters.date}
                                    onSelect={(date) => setFilters(f => ({...f, date: date || {from: null, to: null}}))}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {successMessage && (
                    <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                        <AlertDescription>{successMessage}</AlertDescription>
                    </Alert>
                )}
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : error ? (
                    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                ) : (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="text-center">Quantity</TableHead>
                                    <TableHead>Technician</TableHead>
                                    <TableHead className="text-right">Total Cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length > 0 ? transactions.map(t => (
                                    <TableRow 
                                        key={t.id} 
                                        className="cursor-pointer hover:bg-gray-50"
                                        onClick={() => handleRowClick(t)}
                                    >
                                        <TableCell>{t.date ? format(new Date(t.date), 'MM/dd/yyyy') : 'N/A'}</TableCell>
                                        <TableCell>
                                            <Badge className={`flex items-center gap-1.5 ${typeColors[t.transaction_type]}`}>
                                                {typeIcons[t.transaction_type]}
                                                {t.transaction_type.replace(/_/g, ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{allCustomers[t.customer_id] || 'N/A'}</TableCell>
                                        <TableCell>
                                            {t.transaction_type === 'service_expense' ? (
                                                <span className="text-gray-500 italic">Travel & On-site Expenses</span>
                                            ) : t.transaction_type === 'shipping_expense' ? (
                                                <span className="text-gray-500 italic">Shipping & Delivery</span>
                                            ) : (
                                                allParts[t.part_id] || 'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">{t.quantity ?? '-'}</TableCell>
                                        <TableCell>{t.technician_name || 'N/A'}</TableCell>
                                        <TableCell className="text-right">${t.total_cost?.toFixed(2) ?? '0.00'}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan="7" className="text-center h-24">No transactions found for the selected filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                        {hasMore && (
                            <div className="flex justify-center p-4">
                                <Button onClick={handleLoadMore} disabled={loadingMore}>
                                    {loadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading...</> : "Load More"}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>

            {/* Transaction Detail Modal */}
            <Dialog open={isDetailModalOpen} onOpenChange={(open) => {
                setIsDetailModalOpen(open);
                if (!open) {
                    setIsEditing(false);
                    setSelectedTransaction(null);
                    setEditedTransaction(null);
                }
            }}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Transaction Details</DialogTitle>
                    </DialogHeader>

                    {selectedTransaction && editedTransaction && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Transaction ID</Label>
                                    <Input value={selectedTransaction.transaction_id || ''} disabled />
                                </div>
                                <div>
                                    <Label>Type</Label>
                                    {isEditing ? (
                                        <Select 
                                            value={editedTransaction.transaction_type} 
                                            onValueChange={(value) => {
                                                const newData = {...editedTransaction, transaction_type: value};
                                                // Auto-set total_cost to 0 for special types
                                                if (['warranty_replacement', 'no_charge', 'service_agreement'].includes(value)) {
                                                    newData.total_cost = 0;
                                                }
                                                setEditedTransaction(newData);
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="on_site_service">On-Site Service</SelectItem>
                                                <SelectItem value="service_expense">Service Expense</SelectItem>
                                                <SelectItem value="parts_order">Parts Order</SelectItem>
                                                <SelectItem value="shipping_expense">Shipping Expense</SelectItem>
                                                <SelectItem value="inventory_addition">Inventory Addition</SelectItem>
                                                <SelectItem value="warranty_replacement">Warranty Replacement</SelectItem>
                                                <SelectItem value="no_charge">No Charge</SelectItem>
                                                <SelectItem value="service_agreement">Service Agreement</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input value={selectedTransaction.transaction_type?.replace(/_/g, ' ') || ''} disabled />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Date</Label>
                                    {isEditing ? (
                                        <Input 
                                            type="date"
                                            value={editedTransaction.date || ''}
                                            onChange={(e) => setEditedTransaction({...editedTransaction, date: e.target.value})}
                                        />
                                    ) : (
                                        <Input value={selectedTransaction.date ? format(new Date(selectedTransaction.date), 'yyyy-MM-dd') : ''} disabled />
                                    )}
                                </div>
                                <div>
                                    <Label>Customer</Label>
                                    <Input value={allCustomers[selectedTransaction.customer_id] || 'N/A'} disabled />
                                </div>
                            </div>

                            {selectedTransaction.part_id && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Part</Label>
                                        <Input value={allParts[selectedTransaction.part_id] || 'N/A'} disabled />
                                    </div>
                                    <div>
                                        <Label>Quantity</Label>
                                        {isEditing ? (
                                            <Input 
                                                type="number"
                                                value={editedTransaction.quantity || ''}
                                                onChange={(e) => setEditedTransaction({...editedTransaction, quantity: e.target.value})}
                                            />
                                        ) : (
                                            <Input value={selectedTransaction.quantity || ''} disabled />
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Purchase Order #</Label>
                                    {isEditing ? (
                                        <Input 
                                            value={editedTransaction.purchase_order_number || ''}
                                            onChange={(e) => setEditedTransaction({...editedTransaction, purchase_order_number: e.target.value})}
                                        />
                                    ) : (
                                        <Input value={selectedTransaction.purchase_order_number || 'N/A'} disabled />
                                    )}
                                </div>
                                <div>
                                    <Label>Technician</Label>
                                    <Input value={selectedTransaction.technician_name || 'N/A'} disabled />
                                </div>
                            </div>

                            {/* Service Expenses Section */}
                            {(selectedTransaction.travel_hours || selectedTransaction.onsite_hours || selectedTransaction.kilometers || 
                              selectedTransaction.food_expense || selectedTransaction.hotel_expense || selectedTransaction.tolls_expense) && (
                                <div className="border-t pt-4">
                                    <h3 className="text-lg font-semibold mb-3">Service Details</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label>Travel Hours</Label>
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={editedTransaction.travel_hours || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, travel_hours: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.travel_hours || 'N/A'} disabled />
                                            )}
                                        </div>
                                        <div>
                                            <Label>On-site Hours</Label>
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={editedTransaction.onsite_hours || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, onsite_hours: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.onsite_hours || 'N/A'} disabled />
                                            )}
                                        </div>
                                        <div>
                                            <Label>Kilometers</Label>
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    step="0.1"
                                                    value={editedTransaction.kilometers || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, kilometers: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.kilometers || 'N/A'} disabled />
                                            )}
                                        </div>
                                        <div>
                                            <Label>Food Expense</Label>
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={editedTransaction.food_expense || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, food_expense: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.food_expense ? `$${selectedTransaction.food_expense}` : 'N/A'} disabled />
                                            )}
                                        </div>
                                        <div>
                                            <Label>Hotel Expense</Label>
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={editedTransaction.hotel_expense || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, hotel_expense: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.hotel_expense ? `$${selectedTransaction.hotel_expense}` : 'N/A'} disabled />
                                            )}
                                        </div>
                                        <div>
                                            <Label>Tolls Expense</Label>
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={editedTransaction.tolls_expense || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, tolls_expense: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.tolls_expense ? `$${selectedTransaction.tolls_expense}` : 'N/A'} disabled />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Shipping Details Section */}
                            {(selectedTransaction.shipment_method || selectedTransaction.tracking_number || selectedTransaction.shipping_cost) && (
                                <div className="border-t pt-4">
                                    <h3 className="text-lg font-semibold mb-3">Shipping Details</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label>Shipment Method</Label>
                                            {isEditing ? (
                                                <Input 
                                                    value={editedTransaction.shipment_method || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, shipment_method: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.shipment_method || 'N/A'} disabled />
                                            )}
                                        </div>
                                        <div>
                                            <Label>Tracking Number</Label>
                                            {isEditing ? (
                                                <Input 
                                                    value={editedTransaction.tracking_number || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, tracking_number: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.tracking_number || 'N/A'} disabled />
                                            )}
                                        </div>
                                        <div>
                                            <Label>Shipping Cost</Label>
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={editedTransaction.shipping_cost || ''}
                                                    onChange={(e) => setEditedTransaction({...editedTransaction, shipping_cost: e.target.value})}
                                                />
                                            ) : (
                                                <Input value={selectedTransaction.shipping_cost ? `$${selectedTransaction.shipping_cost}` : 'N/A'} disabled />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label>Total Cost</Label>
                                {isEditing ? (
                                    ['warranty_replacement', 'no_charge', 'service_agreement'].includes(editedTransaction.transaction_type) ? (
                                        <Input 
                                            type="number" 
                                            step="0.01"
                                            value="0.00"
                                            disabled
                                            className="bg-gray-100"
                                        />
                                    ) : (
                                        <Input 
                                            type="number" 
                                            step="0.01"
                                            value={editedTransaction.total_cost || ''}
                                            onChange={(e) => setEditedTransaction({...editedTransaction, total_cost: e.target.value})}
                                        />
                                    )
                                ) : (
                                    <Input value={selectedTransaction.total_cost ? `$${selectedTransaction.total_cost.toFixed(2)}` : '$0.00'} disabled />
                                )}
                                {isEditing && ['warranty_replacement', 'no_charge', 'service_agreement'].includes(editedTransaction.transaction_type) && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Total cost is automatically set to $0.00 for this transaction type.
                                    </p>
                                )}
                            </div>

                            <div>
                                <Label>Notes</Label>
                                {isEditing ? (
                                    <Textarea 
                                        value={editedTransaction.notes || ''}
                                        onChange={(e) => setEditedTransaction({...editedTransaction, notes: e.target.value})}
                                        rows={3}
                                    />
                                ) : (
                                    <Textarea value={selectedTransaction.notes || 'No notes'} disabled rows={3} />
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4 border-t">
                        {!isEditing ? (
                            <div className="flex w-full justify-end items-center gap-2">
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => setShowDeleteDialog(true)}
                                    className="mr-auto"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                                    Close
                                </Button>
                                <Button variant="default" size="sm" onClick={handleEdit}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleSaveEdit}>
                                    Save Changes
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this transaction. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeleting}
                        >
                            {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
