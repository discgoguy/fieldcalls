
import React, { useState, useEffect } from "react";
import { base44 } from '@/api/base44Client';
import { Customer } from "@/entities/Customer";
import { Machine } from "@/entities/Machine";
import { Part } from "@/entities/Part";
import { Category } from "@/entities/Category";
import { Transaction } from "@/entities/Transaction";
import { Technician } from "@/entities/Technician";
import { Ticket } from "@/entities/Ticket"; // Import Ticket entity
import { AssemblyComponent } from "@/entities/AssemblyComponent"; // Import AssemblyComponent entity
import { createPageUrl } from '@/utils';
import { addTenantId, withTenantFilter } from '@/components/utils/tenant'; // Added import for tenant utilities
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Wrench, CheckCircle, Loader2, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
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

// New component for technician-specific inputs
const TechnicianHoursInput = ({ technician, data, onChange }) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-3 border rounded-lg bg-gray-50/50">
        <div className="md:col-span-2">
            <Label>{technician.full_name}</Label>
        </div>
        <div>
            <Label htmlFor={`travel-${technician.id}`}>Travel Hours</Label>
            <Input
                id={`travel-${technician.id}`}
                type="number"
                step="0.1"
                placeholder="0.0"
                value={data.travel_hours}
                onChange={(e) => onChange(technician.id, 'travel_hours', e.target.value)}
            />
        </div>
        <div>
            <Label htmlFor={`onsite-${technician.id}`}>On-site Hours</Label>
            <Input
                id={`onsite-${technician.id}`}
                type="number"
                step="0.1"
                placeholder="0.0"
                value={data.onsite_hours}
                onChange={(e) => onChange(technician.id, 'onsite_hours', e.target.value)}
            />
        </div>
    </div>
);


export default function OnSiteService() {
  const [customers, setCustomers] = useState([]);
  const [machinesForCustomer, setMachinesForCustomer] = useState([]);
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [ticketId, setTicketId] = useState(null);
  const [checklistId, setChecklistId] = useState(null); // New state for checklist ID
  const [showResolveDialog, setShowResolveDialog] = useState(false);

  const [serviceData, setServiceData] = useState({
    date: new Date().toISOString().split('T')[0],
    customer_id: "",
    purchase_order_number: "",
    selected_technicians: [],
    kilometers: "",
    food_expense: "",
    hotel_expense: "",
    tolls_expense: "",
    notes: "",
  });

  const [technicianHours, setTechnicianHours] = useState({});

  const [usedParts, setUsedParts] = useState([{ machine_id: "", part_id: "", quantity: 1, category: "all" }]);
  const [isPreFilled, setIsPreFilled] = useState(false); // New state to track if form was pre-filled

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError("");
      try {
        const filter = await withTenantFilter(); // Apply tenant filter for initial data load
        const [customerData, partData, categoryData, technicianData] = await Promise.all([
          Customer.filter(filter), // Apply tenant filter
          Part.filter(filter), // Apply tenant filter
          Category.filter(filter), // Apply tenant filter
          Technician.filter(filter, '', 100) // Apply tenant filter, empty sort, limit 100
        ]);
        setCustomers(customerData || []);
        setParts(partData || []);
        setCategories(categoryData || []);
        setTechnicians(technicianData?.filter(t => t.active !== false) || []);

        // Check for URL parameters from checklist or ticket
        const urlParams = new URLSearchParams(window.location.search);
        const fromChecklistId = urlParams.get('checklist_id');
        const fromTicketId = urlParams.get('fromTicket');
        const preCustomerId = urlParams.get('customer_id');
        // const preMachineIds = urlParams.get('machine_ids'); // Assuming machine_ids might be multiple - not used
        const preTechnicianIds = urlParams.get('technician_ids');
        const preNotes = urlParams.get('notes');
        const preParts = urlParams.get('parts');
        
        console.log('🔍 URL Params:', { fromChecklistId, fromTicketId });


        if (fromChecklistId) {
          // Coming from maintenance checklist
          setChecklistId(fromChecklistId);
          setIsPreFilled(true);

          if (preCustomerId) {
            setServiceData(prev => ({ ...prev, customer_id: preCustomerId, notes: preNotes || '' }));
            const machineFilter = await withTenantFilter({ customer_id: preCustomerId }); // Apply tenant filter
            const machineData = await Machine.filter(machineFilter); // Apply tenant filter
            setMachinesForCustomer(machineData || []);
          }

          if (preTechnicianIds) {
            const techIds = JSON.parse(decodeURIComponent(preTechnicianIds));
            setServiceData(prev => ({ ...prev, selected_technicians: techIds }));
            const hours = {};
            techIds.forEach(id => {
              hours[id] = { travel_hours: '', onsite_hours: '' };
            });
            setTechnicianHours(hours);
          }

          if (preParts) {
            const parsedParts = JSON.parse(decodeURIComponent(preParts));
            if (parsedParts.length > 0) {
              setUsedParts(parsedParts.map(p => ({
                machine_id: p.machine_id || '',
                part_id: p.part_id || '',
                quantity: p.quantity || 1,
                category: 'all' // Default to all if not specified in pre-fill
              })));
            }
          }

        } else if (fromTicketId) {
          // Coming from ticket
          setTicketId(fromTicketId);
          console.log('🎫 Attempting to load ticket:', fromTicketId);
          
          try {
            const ticketData = await Ticket.get(fromTicketId);
            console.log('✅ Ticket data received:', ticketData);
            console.log('📊 Available customers:', customerData.map(c => ({ id: c.id, name: c.company_name })));
            
            if (ticketData) {
              console.log('🔄 Setting form data...');
              console.log('  - customer_id:', ticketData.customer_id);
              console.log('  - description:', ticketData.description);
              console.log('  - technician_id:', ticketData.technician_id);
              
              // Pre-fill form
              setServiceData(prev => {
                const newData = {
                  ...prev,
                  customer_id: ticketData.customer_id || '',
                  notes: ticketData.description || '',
                  selected_technicians: ticketData.technician_id ? [ticketData.technician_id] : []
                };
                console.log('✅ New serviceData:', newData);
                return newData;
              });
              
              // Load machines
              if (ticketData.customer_id) {
                console.log('🏭 Loading machines for customer:', ticketData.customer_id);
                const machineFilter = await withTenantFilter({ customer_id: ticketData.customer_id });
                const machineData = await Machine.filter(machineFilter);
                console.log('✅ Machines loaded:', machineData?.length || 0);
                setMachinesForCustomer(machineData || []);
              }
              
              // Initialize technician hours
              if (ticketData.technician_id) {
                console.log('👷 Initializing hours for technician:', ticketData.technician_id);
                setTechnicianHours({ [ticketData.technician_id]: { travel_hours: '', onsite_hours: '' } });
              }

              // Update ticket status
              console.log('📝 Updating ticket status to In Progress...');
              await Ticket.update(fromTicketId, { status: "In Progress" });
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
        setError("Failed to load some data. You may need to refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleCustomerChange = async (customerId) => {
    setServiceData(prev => ({ ...prev, customer_id: customerId }));
    if (!isPreFilled) { // Only reset parts if not pre-filled from a checklist
      setUsedParts([{ machine_id: "", part_id: "", quantity: 1, category: "all" }]);
    }
    if (customerId) {
      try {
        const filter = await withTenantFilter({ customer_id: customerId }); // Apply tenant filter
        const machineData = await Machine.filter(filter); // Apply tenant filter
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
    const newUsedParts = [...usedParts];
    newUsedParts[index][field] = value;

    if (field === 'category') {
      newUsedParts[index].part_id = "";
    }

    setUsedParts(newUsedParts);
  };

  const addPartEntry = () => {
    setUsedParts([...usedParts, { machine_id: "", part_id: "", quantity: 1, category: "all" }]);
  };

  const removePartEntry = (index) => {
    if (usedParts.length > 1) { // Prevent removing the last entry
      const newUsedParts = usedParts.filter((_, i) => i !== index);
      setUsedParts(newUsedParts);
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

  const handleTechnicianToggle = (technicianId) => {
    const isSelected = serviceData.selected_technicians.includes(technicianId);
    let newSelected = [...serviceData.selected_technicians];
    let newHours = {...technicianHours};

    if (isSelected) {
        newSelected = newSelected.filter(id => id !== technicianId);
        delete newHours[technicianId];
    } else {
        newSelected.push(technicianId);
        newHours[technicianId] = { travel_hours: '', onsite_hours: '' };
    }

    setServiceData(prev => ({ ...prev, selected_technicians: newSelected }));
    setTechnicianHours(newHours);
  };

  const handleHoursChange = (technicianId, field, value) => {
      setTechnicianHours(prev => ({
          ...prev,
          [technicianId]: {
              ...prev[technicianId],
              [field]: value
          }
      }));
  };

  // Recursive function to deduct components for assemblies
  const deductAssemblyComponents = async (partId, quantity, allParts) => {
      const part = allParts.find(p => p.id === partId);
      if (!part) {
          console.warn(`Part with ID ${partId} not found for deduction.`);
          return;
      }

      if (part.is_assembly) {
          // Get assembly components
          const componentFilter = await withTenantFilter({ assembly_part_id: partId }); // Apply tenant filter
          const components = await AssemblyComponent.filter(componentFilter);

          // Deduct each component (recursively if it's also an assembly)
          for (const component of components) {
              const componentQuantity = component.quantity_required * quantity;
              await deductAssemblyComponents(component.component_part_id, componentQuantity, allParts);
          }
      } else {
          // Deduct regular part from inventory
          const newQuantity = Math.max(0, part.quantity_in_inventory - quantity);
          await Part.update(partId, { quantity_in_inventory: newQuantity }); // Assuming Part.update handles tenant implicitly
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess(false);

    if (!serviceData.customer_id || serviceData.selected_technicians.length === 0) {
      setError("Please select a customer and at least one technician.");
      setIsSubmitting(false);
      return;
    }

    try {
      const serviceCallId = `SC-${Date.now()}`;
      const selectedDate = new Date(`${serviceData.date}T00:00:00`);
      const promises = [];
      const partsToProcess = usedParts.filter(p => p.part_id && Number(p.quantity) > 0);

      // --- Create Expense Transactions (one per technician) ---
      let generalExpensesAssigned = false;

      for (const techId of serviceData.selected_technicians) {
        const hoursData = technicianHours[techId] || {};
        const travelHours = parseFloat(hoursData.travel_hours) || 0;
        const onsiteHours = parseFloat(hoursData.onsite_hours) || 0;

        // Only create a transaction if this technician has hours logged.
        if (travelHours > 0 || onsiteHours > 0) {
            const technicianName = getTechnicianName(techId);
            let expenseData = {
                transaction_id: `EXP-${Date.now()}-${techId.substring(0, 4)}-${Math.random().toString(36).substr(2, 3)}`,
                transaction_type: "service_expense",
                service_call_id: serviceCallId,
                date: selectedDate,
                customer_id: serviceData.customer_id,
                purchase_order_number: serviceData.purchase_order_number,
                technician_name: technicianName,
                technician_ids: [techId], // Specific to this technician
                travel_hours: travelHours,
                onsite_hours: onsiteHours,
                notes: null,
                total_cost: 0,
            };

            // Assign general expenses (kilometers, food, etc.) to the FIRST transaction that gets created.
            if (!generalExpensesAssigned) {
                const generalExpenseCost =
                    (parseFloat(serviceData.food_expense) || 0) +
                    (parseFloat(serviceData.hotel_expense) || 0) +
                    (parseFloat(serviceData.tolls_expense) || 0);

                expenseData = {
                    ...expenseData,
                    kilometers: serviceData.kilometers ? parseFloat(serviceData.kilometers) : null,
                    food_expense: serviceData.food_expense ? parseFloat(serviceData.food_expense) : null,
                    hotel_expense: serviceData.hotel_expense ? parseFloat(serviceData.hotel_expense) : null,
                    tolls_expense: serviceData.tolls_expense ? parseFloat(serviceData.tolls_expense) : null,
                    notes: serviceData.notes, // Main notes go with the first expense transaction
                    total_cost: generalExpenseCost
                };
                generalExpensesAssigned = true; // Mark as assigned
            }

            const expenseWithTenant = await addTenantId(expenseData); // Add tenant ID
            promises.push(Transaction.create(expenseWithTenant));
        }
      }

      // --- Create Part Transactions and Deduct Inventory ---
      const technicianNamesCombined = serviceData.selected_technicians.map(id => getTechnicianName(id)).filter(Boolean).join(', ');
      let isFirstPartTransaction = true; // Flag to assign notes if no expense transactions were created

      for (const part of partsToProcess) {
        const partDetails = parts.find(p => p.id === part.part_id);
        const totalCost = (partDetails?.sales_price || 0) * Number(part.quantity);

        let partNotes = `Part used during service call ${serviceCallId}`;
        // If NO expense transactions were generated AND this is the first part transaction,
        // then assign the main service notes here.
        if (promises.length === 0 && isFirstPartTransaction) {
             partNotes = serviceData.notes;
             isFirstPartTransaction = false;
        }

        const transactionData = {
          transaction_id: `SVC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          transaction_type: "on_site_service",
          service_call_id: serviceCallId,
          date: selectedDate,
          customer_id: serviceData.customer_id,
          purchase_order_number: serviceData.purchase_order_number,
          machine_id: part.machine_id || null,
          part_id: part.part_id,
          quantity: Number(part.quantity),
          technician_name: technicianNamesCombined, // All selected techs are associated with part usage
          technician_ids: serviceData.selected_technicians,
          notes: partNotes,
          total_cost: totalCost,
        };

        const transactionWithTenant = await addTenantId(transactionData); // Add tenant ID
        promises.push(Transaction.create(transactionWithTenant));

        // Deduct inventory (handles both regular parts and assemblies)
        // This call will recursively handle assembly components if `part.part_id` is an assembly
        await deductAssemblyComponents(part.part_id, Number(part.quantity), parts);
      }

      // If no transactions were generated (e.g., no hours logged, no general expenses, and no parts used)
      if (promises.length === 0) {
          setError("No service expenses (hours or general expenses) or parts were provided to log a transaction.");
          setIsSubmitting(false);
          return;
      }

      await Promise.all(promises);
      setSuccess(true);

      // If the service call was created from a ticket, ask to resolve it
      if (ticketId) {
        setShowResolveDialog(true);
      } else {
        // Reset form immediately if not from a ticket
        resetForm();
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (err) {
      setError("Failed to create service transaction. " + (err.message || "An unknown error occurred."));
      console.error(err);
    }

    setIsSubmitting(false);
  };

  const resetForm = () => {
      setServiceData({
        date: new Date().toISOString().split('T')[0],
        customer_id: "",
        purchase_order_number: "",
        selected_technicians: [],
        kilometers: "",
        food_expense: "",
        hotel_expense: "",
        tolls_expense: "",
        notes: "",
      });
      setTechnicianHours({});
      setUsedParts([{ machine_id: "", part_id: "", quantity: 1, category: "all" }]);
      setMachinesForCustomer([]);
      setTicketId(null); // Clear ticketId as well
      setChecklistId(null); // Clear checklistId
      setIsPreFilled(false); // Reset pre-fill status
  };

  const handleResolveTicket = async (resolve) => {
    if (resolve && ticketId) {
      try {
        await Ticket.update(ticketId, { status: "Resolved" }); // Assuming Ticket.update handles tenant implicitly
      } catch (e) {
        console.error("Failed to resolve ticket", e);
        setError("Could not resolve the ticket, but the service call was logged.");
      }
    }
    setShowResolveDialog(false);
    resetForm();
    // Redirect to tickets page to show result
    window.location.href = createPageUrl('Tickets');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /><span className="ml-3">Loading initial data...</span></div>;
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Wrench className="mr-2" />Log On-Site Service Call</CardTitle>
            <CardDescription>Record parts used during a service visit for a customer's machine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {success && !ticketId && <Alert className="bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertTitle>Success</AlertTitle><AlertDescription>Service transaction logged successfully!</AlertDescription></Alert>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select onValueChange={handleCustomerChange} value={serviceData.customer_id} disabled={customers.length === 0 || isPreFilled}>
                  <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.length > 0 ? (
                      customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)
                    ) : (
                      <div className="p-2 text-sm text-slate-500">No customers found.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input id="date" type="date" value={serviceData.date} onChange={e => setServiceData(prev => ({...prev, date: e.target.value}))} />
              </div>
              <div>
                <Label htmlFor="purchase_order_number">Purchase Order #</Label>
                <Input id="purchase_order_number" placeholder="Optional" value={serviceData.purchase_order_number} onChange={e => setServiceData(prev => ({...prev, purchase_order_number: e.target.value}))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div className="md:col-span-1">
                    <Label htmlFor="kilometers">Kilometers (km)</Label>
                    <Input id="kilometers" type="number" step="0.1" placeholder="0.0" value={serviceData.kilometers} onChange={e => setServiceData(prev => ({...prev, kilometers: e.target.value}))} />
                </div>
                <div className="md:col-span-1">
                    <Label htmlFor="food_expense">Food ($)</Label>
                    <Input id="food_expense" type="number" step="0.01" placeholder="0.00" value={serviceData.food_expense} onChange={e => setServiceData(prev => ({...prev, food_expense: e.target.value}))} />
                </div>
                <div className="md:col-span-1">
                    <Label htmlFor="hotel_expense">Hotel ($)</Label>
                    <Input id="hotel_expense" type="number" step="0.01" placeholder="0.00" value={serviceData.hotel_expense} onChange={e => setServiceData(prev => ({...prev, hotel_expense: e.target.value}))} />
                </div>
                <div className="md:col-span-1">
                    <Label htmlFor="tolls_expense">Tolls ($)</Label>
                    <Input id="tolls_expense" type="number" step="0.01" placeholder="0.00" value={serviceData.tolls_expense} onChange={e => setServiceData(prev => ({...prev, tolls_expense: e.target.value}))} />
                </div>
            </div>

            {/* Technicians Selection */}
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center"><UserPlus className="mr-2" />Select Technicians & Log Hours *</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {technicians.map(tech => (
                    <div key={tech.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tech-${tech.id}`}
                        checked={serviceData.selected_technicians.includes(tech.id)}
                        onCheckedChange={() => handleTechnicianToggle(tech.id)}
                      />
                      <Label htmlFor={`tech-${tech.id}`} className="cursor-pointer">
                        {tech.full_name}
                      </Label>
                    </div>
                  ))}
                </div>
                {technicians.length === 0 && (
                  <p className="text-sm text-gray-500">No technicians available. You can add them in the Technicians page.</p>
                )}

                {/* Per-technician hour inputs */}
                {serviceData.selected_technicians.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                        {serviceData.selected_technicians.map(techId => {
                            const tech = technicians.find(t => t.id === techId);
                            if (!tech) return null;
                            return (
                                <TechnicianHoursInput
                                    key={techId}
                                    technician={tech}
                                    data={technicianHours[techId] || { travel_hours: '', onsite_hours: '' }}
                                    onChange={handleHoursChange}
                                />
                            );
                        })}
                    </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Parts Used *</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {usedParts.map((part, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 border rounded-lg bg-slate-50/50">
                    <div className="md:col-span-3">
                      <Label>Machine</Label>
                      <Select value={part.machine_id} onValueChange={val => handlePartChange(index, 'machine_id', val)} disabled={!serviceData.customer_id || isPreFilled}>
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
                      <Select value={part.category} onValueChange={val => handlePartChange(index, 'category', val)} disabled={isPreFilled}>
                        <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={"all"}>All Categories</SelectItem>
                          {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-4">
                      <Label>Part</Label>
                      <Select value={part.part_id} onValueChange={val => handlePartChange(index, 'part_id', val)} disabled={isPreFilled}>
                        <SelectTrigger><SelectValue placeholder="Select part" /></SelectTrigger>
                        <SelectContent>
                          {getFilteredParts(part.category).map(p => <SelectItem key={p.id} value={p.id}>{p.part_name} ({p.part_number})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-1">
                      <Label>Qty</Label>
                      <Input type="number" value={part.quantity} onChange={e => handlePartChange(index, 'quantity', e.target.value)} min="1" />
                    </div>
                    <div className="md:col-span-1 flex items-center">
                      {usedParts.length > 1 && !isPreFilled &&
                        <Button variant="ghost" size="icon" onClick={() => removePartEntry(index)}>
                          <X className="h-4 w-4 text-red-500"/>
                        </Button>
                      }
                    </div>
                  </div>
                ))}
                {!isPreFilled && ( // Only show "Add Another Part" if not pre-filled
                  <Button type="button" variant="outline" onClick={addPartEntry}><Plus className="mr-2 h-4 w-4" />Add Another Part</Button>
                )}
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="notes">Service Notes</Label>
              <Textarea id="notes" placeholder="Describe the work performed..." value={serviceData.notes} onChange={e => setServiceData(prev => ({...prev, notes: e.target.value}))} />
            </div>

            <Button type="submit" disabled={isSubmitting || loading || customers.length === 0} className="w-full md:w-auto">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting...</> : "Log Service Call"}
            </Button>
          </CardContent>
        </Card>
      </form>

      <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Service Call Logged Successfully</AlertDialogTitle>
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
