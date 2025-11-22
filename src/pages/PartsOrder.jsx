
import React, { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils'; // Import createPageUrl utility
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Package, CheckCircle, Loader2, Printer } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import PackingList from "../components/PackingList";
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

export default function PartsOrder() {
  const [customers, setCustomers] = useState([]);
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [machinesForCustomer, setMachinesForCustomer] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [lastSuccessfulOrder, setLastSuccessfulOrder] = useState(null);

  const [ticketId, setTicketId] = useState(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);

  const [orderData, setOrderData] = useState({
    date: new Date().toISOString().split('T')[0],
    customer_id: "",
    purchase_order_number: "",
    shipment_method: "",
    tracking_number: "",
    shipping_cost: "", 
    technician_id: "",
    notes: "",
  });

  const [orderedParts, setOrderedParts] = useState([{ part_id: "", quantity: 1, machine_id: "", category: "all" }]);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError("");
      
      try {
        const filter = await withTenantFilter();
        const [customerData, partData, categoryData, technicianData] = await Promise.all([
          base44.entities.Customer.filter(filter),
          base44.entities.Part.filter(filter),
          base44.entities.Category.filter(filter),
          base44.entities.Technician.filter(filter, '', 100)
        ]);
        setCustomers(customerData || []);
        setParts(partData || []);
        setCategories(categoryData || []);
        setTechnicians(technicianData?.filter(t => t.active !== false) || []);

        // Check for ticket ID in URL
        const urlParams = new URLSearchParams(window.location.search);
        const fromTicketId = urlParams.get('fromTicket');
        
        console.log('🔍 URL Params - fromTicket:', fromTicketId);
        
        if (fromTicketId) {
          setTicketId(fromTicketId);
          console.log('🎫 Attempting to load ticket:', fromTicketId);
          
          try {
            const ticketData = await base44.entities.Ticket.get(fromTicketId);
            console.log('✅ Ticket data received:', ticketData);
            console.log('📊 Available customers:', customerData.map(c => ({ id: c.id, name: c.company_name })));
            
            if (ticketData) {
              console.log('🔄 Setting form data...');
              console.log('  - customer_id:', ticketData.customer_id);
              console.log('  - description:', ticketData.description);
              console.log('  - technician_id:', ticketData.technician_id);
              
              // Pre-fill order form
              setOrderData(prev => {
                const newData = {
                  ...prev,
                  customer_id: ticketData.customer_id || '',
                  notes: ticketData.description || '',
                  technician_id: ticketData.technician_id || ''
                };
                console.log('✅ New orderData:', newData);
                return newData;
              });
              
              // Load machines for the customer
              if (ticketData.customer_id) {
                console.log('🏭 Loading machines for customer:', ticketData.customer_id);
                const machineFilter = await withTenantFilter({ customer_id: ticketData.customer_id });
                const machineData = await base44.entities.Machine.filter(machineFilter);
                console.log('✅ Machines loaded:', machineData?.length || 0);
                setMachinesForCustomer(machineData || []);
              }
              
              // Update ticket status
              console.log('📝 Updating ticket status to In Progress...');
              await base44.entities.Ticket.update(fromTicketId, { status: "In Progress" });
              console.log('✅ Ticket status updated');
            } else {
              console.warn('⚠️ Ticket data is null or undefined');
            }
          } catch (ticketError) {
            console.error('❌ Error loading ticket:', ticketError);
            console.error('Error details:', ticketError.message, ticketError.stack);
            setError('Failed to load ticket data: ' + ticketError.message);
          }
        }
      } catch (err) {
        console.error('❌ Failed to load initial data:', err);
        setError("Failed to load some required data. The page may not function correctly.");
      }
      setLoading(false);
    };
    
    loadInitialData();
  }, []);

  // Recursive function to deduct components for assemblies
  const deductAssemblyComponents = async (partId, quantity, allParts) => {
    const part = allParts.find(p => p.id === partId);
    if (!part) {
        console.warn(`Part with ID ${partId} not found during deduction.`);
        return;
    }

    if (part.is_assembly) {
        // Get assembly components
        const components = await base44.entities.AssemblyComponent.filter({ assembly_part_id: partId });
        
        // Deduct each component (recursively if it's also an assembly)
        for (const component of components) {
            const componentQuantity = component.quantity_required * quantity;
            await deductAssemblyComponents(component.component_part_id, componentQuantity, allParts);
        }
    } else {
        // Deduct regular part from inventory
        const newQuantity = Math.max(0, part.quantity_in_inventory - quantity);
        await base44.entities.Part.update(partId, { quantity_in_inventory: newQuantity });
    }
  };

  const handleCustomerChange = async (customerId) => {
    setOrderData(prev => ({ ...prev, customer_id: customerId }));
    setOrderedParts([{ part_id: "", quantity: 1, machine_id: "", category: "all" }]);
    
    if (customerId) {
      try {
        const filter = await withTenantFilter({ customer_id: customerId });
        const machineData = await base44.entities.Machine.filter(filter);
        setMachinesForCustomer(machineData || []);
      } catch (error) {
        console.error("Error loading machines:", error);
        setMachinesForCustomer([]);
      }
    } else {
      setMachinesForCustomer([]);
    }
  };

  const handlePartChange = (index, field, value) => {
    const newOrderedParts = [...orderedParts];
    newOrderedParts[index][field] = value;
    
    if (field === 'category') {
      newOrderedParts[index].part_id = "";
    }
    
    setOrderedParts(newOrderedParts);
  };

  const addPartEntry = () => {
    setOrderedParts([...orderedParts, { part_id: "", quantity: 1, machine_id: "", category: "all" }]);
  };

  const removePartEntry = (index) => {
    if (orderedParts.length > 1) {
      const newOrderedParts = orderedParts.filter((_, i) => i !== index);
      setOrderedParts(newOrderedParts);
    }
  };
  
  const getFilteredParts = (categoryFilter) => {
    if (!categoryFilter || categoryFilter === 'all') return parts;
    return parts.filter(part => part.category === categoryFilter);
  };

  const getTechnicianName = (technicianId) => {
    const technician = technicians.find(t => t.id === technicianId);
    return technician ? technician.full_name : '';
  };

  const handlePrint = () => {
    window.print();
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess(false);
    setLastSuccessfulOrder(null);

    if (!orderData.customer_id || orderedParts.some(p => !p.part_id)) {
      setError("Please select a customer and ensure all part fields are filled out.");
      setIsSubmitting(false);
      return;
    }

    try {
      const technicianName = getTechnicianName(orderData.technician_id);
      const orderId = `ORDER-${Date.now()}`; // Unique ID for this order, linking all related transactions
      
      // Fix for timezone issue: Create date object in local timezone
      const selectedDate = new Date(`${orderData.date}T00:00:00`);

      const promises = [];
      
      // Check if there's a shipping cost to create a separate shipping expense transaction
      const hasShippingCost = orderData.shipping_cost && parseFloat(orderData.shipping_cost) > 0;

      // 1. Create a single shipping expense transaction if there's shipping cost
      if (hasShippingCost) {
        const shippingData = {
          transaction_id: `SHIP-${Date.now()}`, // Unique ID for shipping transaction
          transaction_type: "shipping_expense",
          order_id: orderId, // Link to the overall order
          date: selectedDate, // Use the Date object created in local timezone
          customer_id: orderData.customer_id,
          purchase_order_number: orderData.purchase_order_number,
          shipment_method: orderData.shipment_method,
          tracking_number: orderData.tracking_number,
          shipping_cost: parseFloat(orderData.shipping_cost),
          technician_name: technicianName,
          technician_ids: orderData.technician_id ? [orderData.technician_id] : [],
          notes: orderData.notes, // Main notes go with the shipping transaction
          total_cost: parseFloat(orderData.shipping_cost),
        };
        const shippingWithTenant = await addTenantId(shippingData);
        promises.push(base44.entities.Transaction.create(shippingWithTenant));
      }

      // 2. Create a transaction for each part ordered and update inventory
      let firstPartTransaction = true; // Flag to apply main notes to the first part transaction if no shipping
      const defaultPartNote = `Part from order ${orderId}`;

      for (const part of orderedParts) {
        const partDetails = parts.find(p => p.id === part.part_id);
        const totalCost = (partDetails?.sales_price || 0) * Number(part.quantity);

        let partNotes = defaultPartNote;
        if (!hasShippingCost && firstPartTransaction) { // If no shipping and this is the first part, apply main notes
            partNotes = orderData.notes;
            firstPartTransaction = false; // Ensure notes are only applied once
        }

        // Create part transaction sequentially
        const transactionData = {
          transaction_id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          transaction_type: "parts_order",
          order_id: orderId, // Link to the overall order
          date: selectedDate, // Use the Date object created in local timezone
          customer_id: orderData.customer_id,
          machine_id: part.machine_id || null,
          part_id: part.part_id,
          quantity: Number(part.quantity),
          purchase_order_number: orderData.purchase_order_number,
          technician_name: technicianName,
          technician_ids: orderData.technician_id ? [orderData.technician_id] : [],
          notes: partNotes,
          total_cost: totalCost,
          // Note: No shipping cost on individual parts anymore
        };

        const transactionWithTenant = await addTenantId(transactionData);
        await base44.entities.Transaction.create(transactionWithTenant);

        // Deduct inventory (handles both regular parts and assemblies)
        // Await this directly to ensure sequential updates for complex assemblies
        await deductAssemblyComponents(part.part_id, Number(part.quantity), parts);

        // Small delay to prevent overwhelming the API (for sequential part transaction creation)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await Promise.all(promises); // Await shipping transaction (if any) and any other concurrent promises
      
      // Prepare data for packing list
      const fullCustomer = customers.find(c => c.id === orderData.customer_id);
      const fullParts = orderedParts.map(p => {
        const details = parts.find(part => part.id === p.part_id);
        const machine = machinesForCustomer.find(m => m.id === p.machine_id);
        return {
          ...p,
          part_name: details?.part_name || "N/A",
          part_number: details?.part_number || "N/A",
          machine_model: machine?.model || "N/A"
        }
      });

      setLastSuccessfulOrder({
        customer: fullCustomer,
        orderData: orderData,
        parts: fullParts
      });

      setSuccess(true);
      
      if (ticketId) {
        setShowResolveDialog(true);
      } else {
        resetForm();
        setTimeout(() => setSuccess(false), 8000);
      }

    } catch (err) {
      setError("Failed to create parts order: " + (err.message || "Unknown error"));
      console.error(err);
    }
    setIsSubmitting(false);
  };
  
  const resetForm = () => {
      setOrderData({
        date: new Date().toISOString().split('T')[0],
        customer_id: "",
        purchase_order_number: "",
        shipment_method: "",
        tracking_number: "",
        shipping_cost: "", 
        technician_id: "",
        notes: "",
      });
      setOrderedParts([{ part_id: "", quantity: 1, machine_id: "", category: "all" }]);
      setMachinesForCustomer([]);
      setTicketId(null); // Clear ticketId after form reset
  };

  const handleResolveTicket = async (resolve) => {
    if (resolve && ticketId) {
      try {
        await base44.entities.Ticket.update(ticketId, { status: "Resolved" });
      } catch (e) {
        console.error("Failed to resolve ticket", e);
        setError("Could not resolve the ticket, but the parts order was created.");
      }
    }
    setShowResolveDialog(false);
    resetForm();
    // Redirect to tickets page to show result
    window.location.href = createPageUrl('Tickets');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-3">Loading data...</span>
      </div>
    );
  }

  // Show a basic form even if some data failed to load
  return (
    <>
      <div className="print:hidden">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2" />
                Create Parts Order
              </CardTitle>
              <CardDescription>
                Create a parts order for a customer, with optional shipping and technician details.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="bg-green-50 border-green-200 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>
                    Parts order created successfully! 
                    {lastSuccessfulOrder && (
                        <Button variant="link" className="p-0 h-auto ml-2 text-green-800 font-bold" onClick={handlePrint}>
                            <Printer className="mr-1 h-4 w-4" /> Print Packing List
                        </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer">Customer *</Label>
                  <Select onValueChange={handleCustomerChange} value={orderData.customer_id}>
                    <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.length > 0 ? customers.map(c => 
                        <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                      ) : <SelectItem value="no-customers" disabled>No customers available</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input id="date" type="date" value={orderData.date} onChange={e => setOrderData(prev => ({...prev, date: e.target.value}))} />
                </div>
              </div>
              
              <Card>
                  <CardHeader><CardTitle className="text-lg">Parts to Order</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                      {orderedParts.map((part, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 border rounded-lg bg-slate-50/50">
                               <div className="md:col-span-3">
                                <Label>Machine</Label>
                                <Select value={part.machine_id} onValueChange={val => handlePartChange(index, 'machine_id', val)} disabled={!orderData.customer_id}>
                                  <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                                  <SelectContent>
                                    {machinesForCustomer.length > 0 ? machinesForCustomer.map(m => (
                                      <SelectItem key={m.id} value={m.id}>{m.model} (S/N: {m.serial_number})</SelectItem>
                                    )) : <div className="p-2 text-sm text-slate-500">No machines for this customer.</div>}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-2">
                                <Label>Category</Label>
                                <Select value={part.category} onValueChange={val => handlePartChange(index, 'category', val)}>
                                  <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-4">
                                <Label>Part *</Label>
                                 <Select value={part.part_id} onValueChange={val => handlePartChange(index, 'part_id', val)}>
                                  <SelectTrigger><SelectValue placeholder="Select part" /></SelectTrigger>
                                  <SelectContent>
                                    {getFilteredParts(part.category).length > 0 ? getFilteredParts(part.category).map(p => 
                                      <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number}) - Stock: {p.quantity_in_inventory}</SelectItem>
                                    ) : <SelectItem value="no-parts" disabled>No parts available</SelectItem>}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-1">
                                <Label>Qty *</Label>
                                <Input type="number" value={part.quantity} onChange={e => handlePartChange(index, 'quantity', e.target.value)} min="1" />
                              </div>
                              <div className="md:col-span-1 flex items-center">
                                {orderedParts.length > 1 &&
                                  <Button variant="ghost" size="icon" onClick={() => removePartEntry(index)}>
                                    <X className="h-4 w-4 text-red-500"/>
                                  </Button>
                                }
                              </div>
                          </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addPartEntry}><Plus className="mr-2 h-4 w-4" />Add Another Part</Button>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader><CardTitle className="text-lg">Shipment & PO Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                          <Label htmlFor="po_number">Purchase Order #</Label>
                          <Input id="po_number" value={orderData.purchase_order_number} onChange={e => setOrderData(prev => ({...prev, purchase_order_number: e.target.value}))} />
                      </div>
                      <div>
                          <Label htmlFor="shipment_method">Shipment Method</Label>
                          <Input id="shipment_method" value={orderData.shipment_method} onChange={e => setOrderData(prev => ({...prev, shipment_method: e.target.value}))} />
                      </div>
                      <div>
                          <Label htmlFor="tracking_number">Tracking #</Label>
                          <Input id="tracking_number" value={orderData.tracking_number} onChange={e => setOrderData(prev => ({...prev, tracking_number: e.target.value}))} />
                      </div>
                      <div>
                          <Label htmlFor="shipping_cost">Shipping Cost ($)</Label>
                          <Input 
                            id="shipping_cost" 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={orderData.shipping_cost} 
                            onChange={e => setOrderData(prev => ({...prev, shipping_cost: e.target.value}))} 
                          />
                      </div>
                  </CardContent>
              </Card>

               <Card>
                  <CardHeader><CardTitle className="text-lg">Assigned Technician</CardTitle></CardHeader>
                  <CardContent>
                      <Label htmlFor="technician">Technician (Optional)</Label>
                      <Select value={orderData.technician_id || 'none'} onValueChange={val => setOrderData(prev => ({...prev, technician_id: val === 'none' ? '' : val}))}>
                          <SelectTrigger>
                              <SelectValue placeholder="Select a technician" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {technicians.map(tech => (
                                  <SelectItem key={tech.id} value={tech.id}>
                                      {tech.full_name}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </CardContent>
              </Card>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea 
                  id="notes"
                  placeholder="Add any notes for this order..."
                  value={orderData.notes}
                  onChange={e => setOrderData(prev => ({...prev, notes: e.target.value}))}
                />
              </div>

              <Button type="submit" disabled={isSubmitting || customers.length === 0 || parts.length === 0} className="w-full md:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  "Create Parts Order"
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>

      <div className="hidden print:block">
        <PackingList order={lastSuccessfulOrder} />
      </div>
       <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
      
      <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Parts Order Created Successfully</AlertDialogTitle>
                  <AlertDialogDescription>
                      Is the original helpdesk ticket now resolved?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => handleResolveTicket(false)}>No, Keep Ticket Open</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleResolveTicket(true)}>Yes, Close Ticket</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
