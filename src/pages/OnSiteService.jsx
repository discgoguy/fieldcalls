import React, { useState, useEffect, useMemo } from "react";
import { Category, Customer, Machine, Part, Technician, Ticket, Transaction, AssemblyComponent } from '@/api/entities';
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
import { Plus, X, Wrench, CheckCircle, Loader2, UserPlus, History, Printer } from "lucide-react";
import ServiceCallPrintLayout from "@/components/service/ServiceCallPrintLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from '@/lib/dateUtils';
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
const TechnicianHoursInput = ({ technician, data, onChange, serviceType }) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-3 border rounded-lg bg-gray-50/50">
        <div className="md:col-span-2">
            <Label>{technician.full_name}</Label>
        </div>
        {serviceType === "on_site" && (
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
        )}
        <div className={serviceType === "remote" ? "md:col-span-2" : ""}>
            <Label htmlFor={`onsite-${technician.id}`}>{serviceType === "remote" ? "Service Hours" : "On-site Hours"}</Label>
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
  const [machines, setMachines] = useState([]);
  const [pastServiceCalls, setPastServiceCalls] = useState([]);
  const [selectedServiceCall, setSelectedServiceCall] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [ticketId, setTicketId] = useState(null);
  const [checklistId, setChecklistId] = useState(null); // New state for checklist ID
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [lastServiceCallId, setLastServiceCallId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('new');
  const [highlightServiceCallId, setHighlightServiceCallId] = useState(null);

  const [assemblyComponents, setAssemblyComponents] = useState([]);
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [stockShortages, setStockShortages] = useState([]);

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
    service_type: "on_site", // "on_site" or "remote"
  });
  
  const [technicianHours, setTechnicianHours] = useState({});

  const [usedParts, setUsedParts] = useState([{ machine_id: "", part_id: "", quantity: 1, category: "all" }]);
  const [isPreFilled, setIsPreFilled] = useState(false); // New state to track if form was pre-filled

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError("");
      try {
        const [customerData, partData, categoryData, technicianData, machineData, transactionData, assemblyComponentData] = await Promise.all([
          Customer.list(),
          Part.list(),
          Category.list(),
          Technician.list(),
          Machine.list(),
          Transaction.list("-created_date", 5000),
          AssemblyComponent.list()
        ]);
        setCustomers(customerData || []);
        setParts(partData || []);
        setCategories(categoryData || []);
        setTechnicians(technicianData?.filter(t => t.active !== false) || []);
        setMachines(machineData || []);
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
        
        // Group transactions by service_call_id
        const serviceCallsMap = {};
        (transactionData || []).forEach(t => {
          if (t.service_call_id) {
            if (!serviceCallsMap[t.service_call_id]) {
              serviceCallsMap[t.service_call_id] = {
                service_call_id: t.service_call_id,
                date: t.date,
                customer_id: t.customer_id,
                purchase_order_number: t.purchase_order_number,
                technician_ids: t.technician_ids || [],
                technician_name: t.technician_name,
                parts: [],
                expenses: null,
                notes: t.notes || ''
              };
            }
            
            if (t.transaction_type === 'on_site_service' || t.transaction_type === 'no_charge' || t.transaction_type === 'warranty_replacement' || t.transaction_type === 'service_agreement' || t.transaction_type === 'sales_agreement') {
              serviceCallsMap[t.service_call_id].parts.push({
                machine_id: t.machine_id,
                part_id: t.part_id,
                quantity: t.quantity
              });
            } else if (t.transaction_type === 'service_expense') {
              serviceCallsMap[t.service_call_id].expenses = {
                travel_hours: t.travel_hours,
                onsite_hours: t.onsite_hours,
                kilometers: t.kilometers,
                food_expense: t.food_expense,
                hotel_expense: t.hotel_expense,
                tolls_expense: t.tolls_expense
              };
              if (t.notes) {
                serviceCallsMap[t.service_call_id].notes = t.notes;
              }
            }
          }
        });
        
        setPastServiceCalls(Object.values(serviceCallsMap).sort((a, b) => b.date.localeCompare(a.date)));

        // Check for URL parameters from checklist, ticket or cart
        const urlParams = new URLSearchParams(window.location.search);
        const fromChecklistId = urlParams.get('checklist_id');
        const fromTicketId = urlParams.get('fromTicket');
        const fromCart = urlParams.get('fromCart');
        const fromServiceCallId = urlParams.get('service_call_id');
        const preCustomerId = urlParams.get('customer_id');
        const preMachineIds = urlParams.get('machine_ids');
        const preTechnicianIds = urlParams.get('technician_ids');
        const preNotes = urlParams.get('notes');
        const preParts = urlParams.get('parts');

        if (fromServiceCallId) {
          setActiveTab('history');
          setHighlightServiceCallId(fromServiceCallId);
        }

        if (fromCart) {
          const cartData = sessionStorage.getItem('partsCartData');
          if (cartData) {
            const parsedCart = JSON.parse(cartData);
            const partsToUse = parsedCart.map(item => ({
              machine_id: "",
              part_id: item.partId,
              quantity: item.quantity || 1,
              category: "all"
            }));
            setUsedParts(partsToUse);
            sessionStorage.removeItem('partsCartData');
          }
        } else if (fromChecklistId) {
          // Coming from maintenance checklist
          setChecklistId(fromChecklistId);
          setIsPreFilled(true);

          if (preCustomerId) {
            setServiceData(prev => ({ ...prev, customer_id: preCustomerId, notes: preNotes || '' }));
            const machineData = await Machine.filter({ customer_id: preCustomerId });
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
          const ticketData = await Ticket.get(fromTicketId);
          if (ticketData) {
            // Pre-fill form
            setServiceData(prev => ({
              ...prev,
              customer_id: ticketData.customer_id,
              notes: ticketData.description,
              purchase_order_number: ticketData.customer_po_number || ticketData.purchase_order_number || "",
              selected_technicians: ticketData.technician_id ? [ticketData.technician_id] : []
            }));
            // Load machines for customer after setting customer_id
            if (ticketData.customer_id) {
              const machineData = await Machine.filter({ customer_id: ticketData.customer_id });
              setMachinesForCustomer(machineData || []);
            }
            if (ticketData.technician_id) {
                const techId = ticketData.technician_id;
                setTechnicianHours({ [techId]: { travel_hours: '', onsite_hours: '' } });
            }

            // Update ticket status to "In Progress"
            await Ticket.update(fromTicketId, { status: "In Progress" });
          }
        }
      } catch (err) {
        setError("Failed to load some data. You may need to refresh the page.");
        console.error(err);
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
    } else {
      setIsPreFilled(false); // After first customer change, allow editing
    }
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
    const newUsedParts = [...usedParts];
    newUsedParts[index][field] = value;
    
    if (field === 'category') {
      newUsedParts[index].part_id = "";
    } else if (field === 'part_id') {
      const selectedPart = parts.find(p => p.id === value);
      if (selectedPart) {
        const selectedCustomer = customers.find(c => c.id === serviceData.customer_id);
        const useNonSA = selectedCustomer?.is_nonsa || false;
        newUsedParts[index].price = useNonSA ? (selectedPart.nonsa_price || selectedPart.sales_price || 0) : (selectedPart.sales_price || 0);
      }
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
    let filtered = parts.filter(part => !part.is_obsolete && !part.is_internal);
    filtered = filtered.sort((a, b) => (a.part_name || '').localeCompare(b.part_name || ''));
    if (!categoryFilter || categoryFilter === 'all') return filtered;
    return filtered.filter(part => part.category === categoryFilter);
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

  // Once past service calls are loaded, auto-select whichever one a deep link
  // (e.g. a ticket's "resolved via" link) asked to highlight.
  useEffect(() => {
    if (highlightServiceCallId && pastServiceCalls.length > 0) {
      const match = pastServiceCalls.find(c => c.service_call_id === highlightServiceCallId);
      if (match) {
        setSelectedServiceCall(match);
      }
    }
  }, [highlightServiceCallId, pastServiceCalls]);
  
  const handleHoursChange = (technicianId, field, value) => {
      setTechnicianHours(prev => ({
          ...prev,
          [technicianId]: {
              ...prev[technicianId],
              [field]: value
          }
      }));
  };

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
      referenceNumber: 'Built to fulfill service call',
    });
    const freshAssembly = await Part.get(partId);
    const newStock = (freshAssembly?.quantity_in_inventory || 0) + buildQuantity;
    await Part.update(partId, { quantity_in_inventory: newStock });

    const freshParts = await Part.list();
    setParts(freshParts || []);

    const freshPartsById = {};
    (freshParts || []).forEach(p => { freshPartsById[p.id] = p; });
    const needed = aggregateQuantitiesByPart(usedParts.filter(p => p.part_id && Number(p.quantity) > 0).map(p => ({ part_id: p.part_id, quantity: p.quantity })));
    const remaining = findInventoryShortages(needed, freshPartsById, componentsByAssembly);
    setStockShortages(remaining);
    if (remaining.length === 0) {
      setShowStockWarning(false);
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
        // Use the date string directly (YYYY-MM-DD) as required by the entity schema
        const selectedDate = serviceData.date;
        const promises = [];
        const partsToProcess = usedParts.filter(p => p.part_id && Number(p.quantity) > 0);

        // Prevent using parts that don't actually have enough stock (or buildable
        // assembly stock) available right now.
        if (partsToProcess.length > 0) {
          const neededEntries = aggregateQuantitiesByPart(partsToProcess.map(p => ({ part_id: p.part_id, quantity: p.quantity })));
          const shortages = findInventoryShortages(neededEntries, partsById, componentsByAssembly);
          if (shortages.length > 0) {
            setStockShortages(shortages);
            setShowStockWarning(true);
            setIsSubmitting(false);
            return;
          }
        }

        // Check if service is on weekend
        const serviceDate = new Date(selectedDate + 'T00:00:00');
        const dayOfWeek = serviceDate.getDay();
        const isWeekendService = dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday

      // --- Create Expense Transactions (one per technician) ---
      let generalExpensesAssigned = false;

      for (const techId of serviceData.selected_technicians) {
        const hoursData = technicianHours[techId] || {};
        const travelHours = serviceData.service_type === "on_site" ? (parseFloat(hoursData.travel_hours) || 0) : 0;
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
                is_weekend_service: isWeekendService,
            };
            
            // Assign general expenses (kilometers, food, etc.) to the FIRST transaction that gets created.
            // For remote service, skip travel expenses
            if (!generalExpensesAssigned) {
                const generalExpenseCost = serviceData.service_type === "on_site" 
                    ? ((parseFloat(serviceData.food_expense) || 0) + 
                       (parseFloat(serviceData.hotel_expense) || 0) + 
                       (parseFloat(serviceData.tolls_expense) || 0))
                    : 0;

                expenseData = {
                    ...expenseData,
                    kilometers: serviceData.service_type === "on_site" && serviceData.kilometers ? parseFloat(serviceData.kilometers) : null,
                    food_expense: serviceData.service_type === "on_site" && serviceData.food_expense ? parseFloat(serviceData.food_expense) : null,
                    hotel_expense: serviceData.service_type === "on_site" && serviceData.hotel_expense ? parseFloat(serviceData.hotel_expense) : null,
                    tolls_expense: serviceData.service_type === "on_site" && serviceData.tolls_expense ? parseFloat(serviceData.tolls_expense) : null,
                    notes: serviceData.notes, // Main notes go with the first expense transaction
                    total_cost: generalExpenseCost
                };
                generalExpensesAssigned = true; // Mark as assigned
            }

            promises.push(Transaction.create(expenseData));
        }
      }
      
      // --- Create Part Transactions and Deduct Inventory ---
      const technicianNamesCombined = serviceData.selected_technicians.map(id => getTechnicianName(id)).filter(Boolean).join(', ');
      let isFirstPartTransaction = true; // Flag to assign notes if no expense transactions were created

      for (const part of partsToProcess) {
        // FIX: use the nonSA-aware price stored on the part entry by handlePartChange.
        // Fall back to sales_price only if price was never set (e.g. parts pre-filled from cart/checklist).
        const partDetails = parts.find(p => p.id === part.part_id);
        const selectedCustomer = customers.find(c => c.id === serviceData.customer_id);
        const unitPrice = part.price != null
          ? part.price
          : (selectedCustomer?.is_nonsa
              ? (partDetails?.nonsa_price || partDetails?.sales_price || 0)
              : (partDetails?.sales_price || 0));
        const totalCost = unitPrice * Number(part.quantity);

        let partNotes = `Part used during service call ${serviceCallId}`;
        // If NO expense transactions were generated AND this is the first part transaction,
        // then assign the main service notes here.
        if (promises.length === 0 && isFirstPartTransaction) { 
             partNotes = serviceData.notes;
             isFirstPartTransaction = false;
        }

        promises.push(Transaction.create({
          transaction_id: `SVC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          transaction_type: serviceData.service_type === "remote" ? "remote_service" : "on_site_service",
          service_call_id: serviceCallId,
          date: selectedDate,
          customer_id: serviceData.customer_id,
          purchase_order_number: serviceData.purchase_order_number,
          machine_id: part.machine_id || null,
          part_id: part.part_id,
          quantity: Number(part.quantity),
          technician_name: technicianNamesCombined,
          technician_ids: serviceData.selected_technicians,
          notes: partNotes,
          total_cost: totalCost,
          is_weekend_service: isWeekendService,
        }));
      }
      
      // If no transactions were generated (e.g., no hours logged, no general expenses, and no parts used)
      if (promises.length === 0) {
          setError("No service expenses (hours or general expenses) or parts were provided to log a transaction.");
          setIsSubmitting(false);
          return;
      }

      await Promise.all(promises);

      // Deduct inventory AFTER all transactions are saved (atomic, fresh DB reads).
      // The transactions above have already been committed by this point, so a
      // failure here (e.g. a transient API issue) shouldn't wipe out the rest of
      // the flow -- surface it as a non-fatal warning instead.
      let inventoryWarning = '';
      if (partsToProcess.length > 0) {
        try {
          await deductInventory(
            partsToProcess.map(p => ({ part_id: p.part_id, quantity: Number(p.quantity) })),
            'service_order',
            serviceCallId,
            serviceCallId + (serviceData.purchase_order_number ? ' / PO: ' + serviceData.purchase_order_number : '')
          );
        } catch (invDeductErr) {
          console.error('Inventory deduction failed (service call was still logged):', invDeductErr);
          inventoryWarning = 'The service call was logged, but inventory could not be automatically deducted: ' + (invDeductErr.message || 'Unknown error') + '. Please adjust stock manually if needed.';
        }
      }
      
      // Reload past service calls after successful submission
      const transactionData = await Transaction.list("-created_date", 5000);
      const serviceCallsMap = {};
      (transactionData || []).forEach(t => {
        if (t.service_call_id) {
          if (!serviceCallsMap[t.service_call_id]) {
            serviceCallsMap[t.service_call_id] = {
              service_call_id: t.service_call_id,
              date: t.date,
              customer_id: t.customer_id,
              purchase_order_number: t.purchase_order_number,
              technician_ids: t.technician_ids || [],
              technician_name: t.technician_name,
              parts: [],
              expenses: null,
              notes: t.notes || ''
            };
          }
          
          if (t.transaction_type === 'on_site_service' || t.transaction_type === 'no_charge' || t.transaction_type === 'warranty_replacement' || t.transaction_type === 'service_agreement' || t.transaction_type === 'sales_agreement') {
            serviceCallsMap[t.service_call_id].parts.push({
              machine_id: t.machine_id,
              part_id: t.part_id,
              quantity: t.quantity
            });
          } else if (t.transaction_type === 'service_expense') {
            serviceCallsMap[t.service_call_id].expenses = {
              travel_hours: t.travel_hours,
              onsite_hours: t.onsite_hours,
              kilometers: t.kilometers,
              food_expense: t.food_expense,
              hotel_expense: t.hotel_expense,
              tolls_expense: t.tolls_expense
            };
            if (t.notes) {
              serviceCallsMap[t.service_call_id].notes = t.notes;
            }
          }
        }
      });
      setPastServiceCalls(Object.values(serviceCallsMap).sort((a, b) => b.date.localeCompare(a.date)));
      
      setSuccess(true);
      setLastServiceCallId(serviceCallId);
      if (inventoryWarning) setError(inventoryWarning);
      
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
        service_type: "on_site",
      });
      setTechnicianHours({});
      setUsedParts([{ machine_id: "", part_id: "", quantity: 1, category: "all" }]);
      setMachinesForCustomer([]);
      setTicketId(null); // Clear ticketId as well
      setChecklistId(null); // Clear checklistId
      setIsPreFilled(false); // Reset pre-fill status
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
          resulting_reference_type: 'on_site_service',
          resulting_reference_id: lastServiceCallId,
        });
        await logTicketEvent(ticketId, 'resolved', {
          actorName: resolvedByName,
          details: resolutionNote.trim() ? { resolution_notes: resolutionNote.trim() } : undefined,
        });
        await logTicketEvent(ticketId, 'converted', {
          toValue: lastServiceCallId,
          actorName: resolvedByName,
          details: { reference_type: 'on_site_service', reference_id: lastServiceCallId },
        });
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new"><Wrench className="mr-2 h-4 w-4" />New Service Call</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />Service History</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
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
                      customers.filter(c => !c.inactive).sort((a, b) => a.company_name.localeCompare(b.company_name)).map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)
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

            <div>
              <Label>Service Type *</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="service_type"
                    value="on_site"
                    checked={serviceData.service_type === "on_site"}
                    onChange={e => setServiceData(prev => ({...prev, service_type: e.target.value}))}
                    className="w-4 h-4"
                  />
                  <span>On-Site Service</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="service_type"
                    value="remote"
                    checked={serviceData.service_type === "remote"}
                    onChange={e => setServiceData(prev => ({...prev, service_type: e.target.value}))}
                    className="w-4 h-4"
                  />
                  <span>Remote Service</span>
                </label>
              </div>
            </div>
            
            {serviceData.service_type === "on_site" && (
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
            )}

            {/* Technicians Selection */}
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center"><UserPlus className="mr-2" />Select Technicians & Log Hours *</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {technicians.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(tech => (
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
                                    serviceType={serviceData.service_type}
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
                     <Select value={part.machine_id} onValueChange={val => handlePartChange(index, 'machine_id', val)} disabled={!serviceData.customer_id}>
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
                         <SelectItem value={"all"}>All Categories</SelectItem>
                         {categories.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                       </SelectContent>
                     </Select>
                    </div>
                    <div className="md:col-span-4">
                     <Label>Part</Label>
                     <Select value={part.part_id} onValueChange={val => handlePartChange(index, 'part_id', val)}>
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
                     {usedParts.length > 1 &&
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
        </TabsContent>

        <TabsContent value="history">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Calls List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><History className="mr-2" />Service Calls</CardTitle>
                <CardDescription>Click to view details</CardDescription>
              </CardHeader>
              <CardContent>
                {pastServiceCalls.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>No service calls logged yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {pastServiceCalls.map(call => {
                      const customer = customers.find(c => c.id === call.customer_id);
                      const isSelected = selectedServiceCall?.service_call_id === call.service_call_id;
                      
                      return (
                        <Card 
                          key={call.service_call_id}
                          className={`cursor-pointer transition-colors hover:bg-blue-50 ${isSelected ? 'bg-blue-100 border-blue-400' : ''}`}
                          onClick={() => setSelectedServiceCall(call)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-sm font-semibold text-blue-600">{call.service_call_id}</span>
                              <span className="text-xs text-gray-500">{format(new Date(call.date), 'MMM dd, yyyy')}</span>
                            </div>
                            <div className="text-sm">
                              <p className="font-medium text-gray-900">{customer?.company_name || 'Unknown'}</p>
                              <p className="text-gray-600 text-xs mt-1">{call.technician_name || 'N/A'}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Call Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Service Call Details</CardTitle>
                {selectedServiceCall && (
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="h-4 w-4 mr-2" />Print
                    </Button>
                )}
              </CardHeader>
              <CardContent>
                {!selectedServiceCall ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Select a service call to view details</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                      <div>
                        <Label className="text-xs text-gray-500">Service Call ID</Label>
                        <p className="font-mono text-sm font-semibold">{selectedServiceCall.service_call_id}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Date</Label>
                        <p className="font-medium">{format(new Date(selectedServiceCall.date), 'MMM dd, yyyy')}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Customer</Label>
                        <p className="font-medium">{customers.find(c => c.id === selectedServiceCall.customer_id)?.company_name || 'Unknown'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Technicians</Label>
                        <p className="text-sm">{selectedServiceCall.technician_name || 'N/A'}</p>
                      </div>
                      {selectedServiceCall.purchase_order_number && (
                        <div className="col-span-2">
                          <Label className="text-xs text-gray-500">Purchase Order</Label>
                          <p className="text-sm">{selectedServiceCall.purchase_order_number}</p>
                        </div>
                      )}
                    </div>

                    {selectedServiceCall.expenses && (
                      <div className="p-3 border rounded-lg bg-gray-50">
                        <Label className="text-sm font-semibold mb-3 block">Service Details</Label>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {selectedServiceCall.expenses.travel_hours > 0 && (
                            <div>
                              <span className="text-gray-600">Travel Hours:</span>{' '}
                              <span className="font-medium">{selectedServiceCall.expenses.travel_hours}h</span>
                            </div>
                          )}
                          {selectedServiceCall.expenses.onsite_hours > 0 && (
                            <div>
                              <span className="text-gray-600">On-site Hours:</span>{' '}
                              <span className="font-medium">{selectedServiceCall.expenses.onsite_hours}h</span>
                            </div>
                          )}
                          {selectedServiceCall.expenses.kilometers > 0 && (
                            <div>
                              <span className="text-gray-600">Distance:</span>{' '}
                              <span className="font-medium">{selectedServiceCall.expenses.kilometers} km</span>
                            </div>
                          )}
                          {selectedServiceCall.expenses.food_expense > 0 && (
                            <div>
                              <span className="text-gray-600">Food:</span>{' '}
                              <span className="font-medium">${selectedServiceCall.expenses.food_expense.toFixed(2)}</span>
                            </div>
                          )}
                          {selectedServiceCall.expenses.hotel_expense > 0 && (
                            <div>
                              <span className="text-gray-600">Hotel:</span>{' '}
                              <span className="font-medium">${selectedServiceCall.expenses.hotel_expense.toFixed(2)}</span>
                            </div>
                          )}
                          {selectedServiceCall.expenses.tolls_expense > 0 && (
                            <div>
                              <span className="text-gray-600">Tolls:</span>{' '}
                              <span className="font-medium">${selectedServiceCall.expenses.tolls_expense.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedServiceCall.parts.length > 0 && (
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Parts Used</Label>
                        <div className="space-y-2">
                          {selectedServiceCall.parts.map((part, idx) => {
                            const partDetails = parts.find(p => p.id === part.part_id);
                            const machineDetails = machines.find(m => m.id === part.machine_id);
                            return (
                              <div key={idx} className="p-3 border rounded bg-white text-sm">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-medium">{partDetails?.part_name || 'Unknown Part'}</span>
                                  <Badge variant="secondary">Qty: {part.quantity}</Badge>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Part #: {partDetails?.part_number || 'N/A'}
                                </p>
                                {machineDetails && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Machine: {machineDetails.model} (S/N: {machineDetails.serial_number})
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedServiceCall.notes && (
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">Service Notes</Label>
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 border rounded">{selectedServiceCall.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ServiceCallPrintLayout
          serviceCall={selectedServiceCall}
          customer={customers.find(c => c.id === selectedServiceCall?.customer_id)}
          technicians={technicians}
          parts={parts}
          machines={machines}
      />

      <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Service Call Logged Successfully</AlertDialogTitle>
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
                      placeholder="e.g., Replaced the faulty sensor on-site."
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
