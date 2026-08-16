import React, { useState, useEffect, useMemo } from "react";
import { Category, Customer, CustomerInventory, Machine, Part, Setting, Technician, Ticket, Transaction, AssemblyComponent } from '@/api/entities';
import { invokeApi, supabase } from '@/api/supabaseClient';
 // Import Ticket entity
import { createPageUrl } from '@/utils';
import { aggregateQuantitiesByPart, findInventoryShortages } from '@/lib/inventoryAvailability';
import InsufficientStockDialog from '@/components/parts/InsufficientStockDialog';
import { logTicketEvent } from '@/lib/ticketEvents';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Package, CheckCircle, Loader2, Printer, History } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PackingList from "../components/PackingList";
import PartsOrderHistory from "@/components/parts_order/PartsOrderHistory";
import PartsOrderPrintLayout from "@/components/parts_order/PartsOrderPrintLayout";
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

  const [allMachines, setAllMachines] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('new');
  const [highlightOrderId, setHighlightOrderId] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printMode, setPrintMode] = useState(null); // 'summary' | 'packing'

  const [ticketId, setTicketId] = useState(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [lastOrderId, setLastOrderId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [shippingMethods, setShippingMethods] = useState(["Express", "Air", "Ground", "Sea"]);

  const [assemblyComponents, setAssemblyComponents] = useState([]);
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [stockShortages, setStockShortages] = useState([]);

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
        const [customerData, partData, categoryData, technicianData, shippingSetting, machineData, transactionData, assemblyComponentData] = await Promise.all([
          Customer.list(),
          Part.list(),
          Category.list(),
          Technician.list(),
          Setting.filter({ key: 'shipping_methods' }),
          Machine.list(),
          Transaction.list('-created_date', 2000),
          AssemblyComponent.list()
        ]);
        setCustomers(customerData || []);
        setParts(partData || []);
        setCategories(categoryData || []);
        setTechnicians(technicianData?.filter(t => t.active !== false) || []);
        setAllMachines(machineData || []);
        setAssemblyComponents(assemblyComponentData || []);

        // Current user, for attributing ticket resolution
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
            setCurrentUser({ ...user, ...profile, full_name: profile?.full_name || user.email });
          }
        } catch (userErr) {
          console.error('Failed to load current user', userErr);
        }

        // Build past orders from transactions
        const ordersMap = {};
        (transactionData || []).forEach(t => {
          if (t.order_id) {
            if (!ordersMap[t.order_id]) {
              ordersMap[t.order_id] = {
                order_id: t.order_id,
                date: t.date,
                customer_id: t.customer_id,
                purchase_order_number: t.purchase_order_number,
                technician_name: t.technician_name,
                shipment_method: null,
                tracking_number: null,
                shipping_cost: 0,
                notes: t.notes || '',
                parts: []
              };
            }
            if (t.transaction_type === 'parts_order') {
              ordersMap[t.order_id].parts.push({ part_id: t.part_id, machine_id: t.machine_id, quantity: t.quantity });
              if (!ordersMap[t.order_id].notes && t.notes) ordersMap[t.order_id].notes = t.notes;
            } else if (t.transaction_type === 'shipping_expense') {
              ordersMap[t.order_id].shipment_method = t.shipment_method;
              ordersMap[t.order_id].tracking_number = t.tracking_number;
              ordersMap[t.order_id].shipping_cost = t.shipping_cost || 0;
              if (t.notes) ordersMap[t.order_id].notes = t.notes;
            }
          }
        });
        setPastOrders(Object.values(ordersMap).sort((a, b) => b.date.localeCompare(a.date)));
        
        if (shippingSetting && shippingSetting.length > 0) {
          setShippingMethods(JSON.parse(shippingSetting[0].value));
        }

        // Check for ticket ID in URL
        const urlParams = new URLSearchParams(window.location.search);
        const fromTicketId = urlParams.get('fromTicket');
        const fromCart = urlParams.get('fromCart');
        const fromOrderId = urlParams.get('order_id');
        const fromTab = urlParams.get('tab');
        if (fromOrderId) {
          setActiveTab('history');
          setHighlightOrderId(fromOrderId);
        } else if (fromTab === 'history') {
          setActiveTab('history');
        }
        
        if (fromCart) {
          const cartData = sessionStorage.getItem('partsCartData');
          if (cartData) {
            const parsedCart = JSON.parse(cartData);
            const partsToOrder = parsedCart.map(item => ({
              part_id: item.partId,
              quantity: item.quantity || 1,
              machine_id: "",
              category: "all"
            }));
            setOrderedParts(partsToOrder);
            sessionStorage.removeItem('partsCartData');
          }
        } else if (fromTicketId) {
          setTicketId(fromTicketId);
          try {
            // Explicitly fetch ticket using .get()
            const ticketData = await Ticket.get(fromTicketId);
            
            if (ticketData) {
                // Prepare new order data object to ensure state update is atomic and complete
                const newOrderData = {
                    date: new Date().toISOString().split('T')[0],
                    customer_id: ticketData.customer_id || "",
                    purchase_order_number: ticketData.customer_po_number || ticketData.purchase_order_number || "",
                    shipment_method: "",
                    tracking_number: "",
                    shipping_cost: "", 
                    technician_id: ticketData.technician_id || "",
                    notes: ticketData.description || "",
                };
                setOrderData(newOrderData);

                // Manually load machines for this customer
                if (ticketData.customer_id) {
                    const machines = await Machine.filter({ customer_id: ticketData.customer_id });
                    setMachinesForCustomer(machines || []);
                }

                // Populate parts if available
                if (ticketData.parts && Array.isArray(ticketData.parts) && ticketData.parts.length > 0) {
                    // Filter out any invalid parts (missing part_id)
                    const validParts = ticketData.parts.filter(p => p.part_id);
                    if (validParts.length > 0) {
                        const mappedParts = validParts.map(p => ({
                            part_id: p.part_id,
                            quantity: p.quantity || 1,
                            machine_id: ticketData.machine_id || "",
                            category: "all",
                            // Fetch price if possible or let handlePartChange logic handle it later? 
                            // We can't easily call handlePartChange here for all, so we set basic fields.
                            // If we have parts list available (from Promise.all), we can find price.
                        }));
                        setOrderedParts(mappedParts);
                    } else {
                         setOrderedParts([{ part_id: "", quantity: 1, machine_id: "", category: "all" }]);
                    }
                } else {
                    setOrderedParts([{ part_id: "", quantity: 1, machine_id: "", category: "all" }]);
                }

                await Ticket.update(fromTicketId, { status: "In Progress" });
            }
          } catch (e) {
            console.error("Failed to load ticket for conversion", e);
            setError("Failed to load ticket data: " + e.message);
          }
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
        setError("Failed to load some required data. The page may not function correctly.");
      }
      setLoading(false);
    };
    
    loadInitialData();
  }, []);

  // Deduct inventory via backend function (atomic, uses fresh DB reads)
  const deductInventory = async (partsToDeduct, referenceType, referenceId, referenceNumber) => {
    const response = await invokeApi('deductInventory', { 
      parts: partsToDeduct,
      referenceType,
      referenceId,
      referenceNumber,
    });
    if (!response.success) {
      throw new Error(response.error || 'Inventory deduction failed.');
    }
    if (response.deductions?.some(d => d.went_negative)) {
      console.warn('Some parts went below zero stock:', response.deductions.filter(d => d.went_negative));
    }
    return response.deductions;
  };

  // Maps for computing real availability (including assembly buildable quantity)
  const partsById = useMemo(() => {
    const map = {};
    parts.forEach(p => { map[p.id] = p; });
    return map;
  }, [parts]);

  const componentsByAssembly = useMemo(() => {
    const map = {};
    assemblyComponents.forEach(c => {
      if (!map[c.assembly_part_id]) map[c.assembly_part_id] = [];
      map[c.assembly_part_id].push(c);
    });
    return map;
  }, [assemblyComponents]);

  // Build enough of an assembly (from its components) to cover a shortfall, then
  // refresh local part data so the shortage check reflects the new stock level.
  const handleBuildAssemblyForShortage = async (partId, buildQuantity) => {
    await invokeApi('deductInventory', {
      parts: [{ part_id: partId, quantity: buildQuantity }],
      referenceType: 'assembly_build',
      referenceId: `BUILD-${Date.now()}`,
      referenceNumber: 'Built to fulfill parts order',
    });
    const freshAssembly = await Part.get(partId);
    const newStock = (freshAssembly?.quantity_in_inventory || 0) + buildQuantity;
    await Part.update(partId, { quantity_in_inventory: newStock });

    const freshParts = await Part.list();
    setParts(freshParts || []);

    const freshPartsById = {};
    (freshParts || []).forEach(p => { freshPartsById[p.id] = p; });
    const needed = aggregateQuantitiesByPart(orderedParts.map(p => ({ part_id: p.part_id, quantity: p.quantity })));
    const remaining = findInventoryShortages(needed, freshPartsById, componentsByAssembly);
    setStockShortages(remaining);
    if (remaining.length === 0) {
      setShowStockWarning(false);
    }
  };

  const handleCustomerChange = async (customerId) => {
    setOrderData(prev => ({ ...prev, customer_id: customerId }));
    setOrderedParts([{ part_id: "", quantity: 1, machine_id: "", category: "all" }]);
    
    if (customerId) {
      try {
        const machineData = await Machine.filter({ customer_id: customerId });
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
    } else if (field === 'part_id') {
      const selectedPart = parts.find(p => p.id === value);
      if (selectedPart) {
        const selectedCustomer = customers.find(c => c.id === orderData.customer_id);
        const useNonSA = selectedCustomer?.is_nonsa || false;
        newOrderedParts[index].price = useNonSA ? (selectedPart.nonsa_price || selectedPart.sales_price || 0) : (selectedPart.sales_price || 0);
      }
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
    let filtered = parts.filter(part => !part.is_obsolete && !part.is_internal);
    filtered = filtered.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || ''));
    if (!categoryFilter || categoryFilter === 'all') return filtered;
    return filtered.filter(part => part.category === categoryFilter);
  };

  const getTechnicianName = (technicianId) => {
    const technician = technicians.find(t => t.id === technicianId);
    return technician ? technician.full_name : '';
  };

  const handlePrint = () => {
    setPrintOrder(null);
    setPrintMode(null);
    setTimeout(() => window.print(), 100);
  };

  const handleHistoryPrint = (order, mode) => {
    setPrintOrder(order);
    setPrintMode(mode);
    setTimeout(() => window.print(), 100);
  };

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

    // Prevent selling parts that don't actually have enough stock (or buildable
    // assembly stock) available right now.
    const neededEntries = aggregateQuantitiesByPart(orderedParts.map(p => ({ part_id: p.part_id, quantity: p.quantity })));
    const shortages = findInventoryShortages(neededEntries, partsById, componentsByAssembly);
    if (shortages.length > 0) {
      setStockShortages(shortages);
      setShowStockWarning(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const technicianName = getTechnicianName(orderData.technician_id);
      const orderId = `ORDER-${Date.now()}`; // Unique ID for this order, linking all related transactions
      
      // Use the date string directly (YYYY-MM-DD) as required by the entity schema
      const selectedDate = orderData.date;

      const promises = [];
      
      // Check if there's a shipping cost to create a separate shipping expense transaction
      const hasShippingCost = orderData.shipping_cost && parseFloat(orderData.shipping_cost) > 0;

      // 1. Create a single shipping expense transaction if there's shipping cost
      if (hasShippingCost) {
        promises.push(Transaction.create({
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
        }));
      }

      // 2. Create a transaction for each part ordered
      // FIX: resolve the selected customer once so we can use it in the price fallback below
      const selectedCustomer = customers.find(c => c.id === orderData.customer_id);
      let firstPartTransaction = true;
      const defaultPartNote = `Part from order ${orderId}`;

      for (const part of orderedParts) {
        const partDetails = parts.find(p => p.id === part.part_id);

        // FIX: use the nonSA-aware price stored on the part entry by handlePartChange.
        // Fall back gracefully for parts pre-filled from a ticket (where price was never set).
        const unitPrice = part.price != null
          ? part.price
          : (selectedCustomer?.is_nonsa
              ? (partDetails?.nonsa_price || partDetails?.sales_price || 0)
              : (partDetails?.sales_price || 0));
        const totalCost = unitPrice * Number(part.quantity);

        let partNotes = defaultPartNote;
        if (!hasShippingCost && firstPartTransaction) {
            partNotes = orderData.notes;
            firstPartTransaction = false;
        }

        await Transaction.create({
          transaction_id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          transaction_type: "parts_order",
          order_id: orderId,
          date: selectedDate,
          customer_id: orderData.customer_id,
          machine_id: part.machine_id || null,
          part_id: part.part_id,
          quantity: Number(part.quantity),
          purchase_order_number: orderData.purchase_order_number,
          technician_name: technicianName,
          technician_ids: orderData.technician_id ? [orderData.technician_id] : [],
          notes: partNotes,
          total_cost: totalCost,
        });

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await Promise.all(promises); // Await shipping transaction if any

      // 3. Deduct inventory AFTER all transactions are saved (atomic, fresh DB reads).
      // The order itself (transactions above) has already been committed by this
      // point, so a failure here (e.g. a transient API issue) shouldn't wipe out
      // the rest of the flow -- surface it as a non-fatal warning instead.
      let inventoryWarning = '';
      try {
        await deductInventory(
          orderedParts.map(p => ({ part_id: p.part_id, quantity: Number(p.quantity) })),
          'parts_order',
          orderId,
          orderId + (orderData.purchase_order_number ? ' / PO: ' + orderData.purchase_order_number : '')
        );
      } catch (invDeductErr) {
        console.error('Inventory deduction failed (order was still created):', invDeductErr);
        inventoryWarning = 'The order was created, but inventory could not be automatically deducted: ' + (invDeductErr.message || 'Unknown error') + '. Please adjust stock manually if needed.';
      }

      // 4. Update Customer Inventory for parts not assigned to a machine
      for (const part of orderedParts) {
        if (!part.machine_id) {
          try {
            const existingInv = await CustomerInventory.filter({ 
              customer_id: orderData.customer_id, 
              part_id: part.part_id 
            });
            if (existingInv && existingInv.length > 0) {
              await CustomerInventory.update(existingInv[0].id, {
                quantity: existingInv[0].quantity + Number(part.quantity)
              });
            } else {
              await CustomerInventory.create({
                customer_id: orderData.customer_id,
                part_id: part.part_id,
                quantity: Number(part.quantity)
              });
            }
          } catch (invErr) {
            console.error("Failed to update customer inventory", invErr);
          }
        }
      }
      
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
      setLastOrderId(orderId);
      if (inventoryWarning) setError(inventoryWarning);
      
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
      setResolutionNote("");
  };

  const handleResolveTicket = async (resolve) => {
    if (resolve && ticketId) {
      try {
        const resolvedByName = currentUser?.full_name || currentUser?.email || '';
        await Ticket.update(ticketId, {
          status: "Resolved",
          resolved_by_name: resolvedByName,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNote.trim() || null,
          resulting_reference_type: 'parts_order',
          resulting_reference_id: lastOrderId,
        });
        await logTicketEvent(ticketId, 'resolved', {
          actorName: resolvedByName,
          details: resolutionNote.trim() ? { resolution_notes: resolutionNote.trim() } : undefined,
        });
        await logTicketEvent(ticketId, 'converted', {
          toValue: lastOrderId,
          actorName: resolvedByName,
          details: { reference_type: 'parts_order', reference_id: lastOrderId },
        });
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new"><Package className="mr-2 h-4 w-4" />New Parts Order</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />Order History</TabsTrigger>
          </TabsList>

          <TabsContent value="new">
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
                      {customers.length > 0 ? customers.filter(c => !c.inactive).sort((a, b) => a.company_name.localeCompare(b.company_name)).map(c => 
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
                                    {machinesForCustomer.length > 0 ? machinesForCustomer.sort((a, b) => a.model.localeCompare(b.model)).map(m => (
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
                                    {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
                          <Select value={orderData.shipment_method} onValueChange={val => setOrderData(prev => ({...prev, shipment_method: val}))}>
                            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                            <SelectContent>
                              {shippingMethods.map(method => (
                                <SelectItem key={method} value={method}>{method}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
          </TabsContent>

          <TabsContent value="history">
            <PartsOrderHistory
              highlightOrderId={highlightOrderId}
              pastOrders={pastOrders}
              customers={customers}
              parts={parts}
              machines={allMachines}
              technicians={technicians}
              onPrint={handleHistoryPrint}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Print areas */}
      <div className="hidden print:block">
        {printOrder ? (
          <PartsOrderPrintLayout
            order={printOrder}
            parts={parts}
            machines={allMachines}
            customers={customers}
            printMode={printMode}
          />
        ) : (
          <PackingList order={lastSuccessfulOrder} />
        )}
      </div>

      <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Parts Order Created Successfully</AlertDialogTitle>
                  <AlertDialogDescription>
                      Is the original helpdesk ticket now resolved?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                  <Label htmlFor="resolution-note" className="text-sm">What was done to resolve this? (optional)</Label>
                  <Textarea
                      id="resolution-note"
                      className="mt-1"
                      rows={3}
                      placeholder="e.g., Ordered replacement parts and shipped to customer."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                  />
              </div>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => handleResolveTicket(false)}>No, Keep Ticket Open</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleResolveTicket(true)}>Yes, Close Ticket</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <InsufficientStockDialog
        open={showStockWarning}
        onOpenChange={setShowStockWarning}
        shortages={stockShortages}
        onBuild={handleBuildAssemblyForShortage}
      />
    </>
  );
}
