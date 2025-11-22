
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Part } from "@/entities/Part";
import { Category } from "@/entities/Category";
import { MachineType } from "@/entities/MachineType";
import { Supplier } from "@/entities/Supplier";
import { Setting } from "@/entities/Setting";
import { PurchaseOrderItem } from "@/entities/PurchaseOrderItem";
import { PurchaseOrder } from "@/entities/PurchaseOrder";
import { AssemblyComponent } from "@/entities/AssemblyComponent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Settings, Loader2, AlertTriangle, Search, CheckCircle, Download, Upload, Filter, Wrench, Grid, List, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import PartCard from "../components/parts/PartCard";
import AssemblyComponentsManager from "../components/parts/AssemblyComponentsManager";
import { addTenantId, withTenantFilter } from '@/components/utils/tenant';

export default function PartsPage() {
    const [parts, setParts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [machineTypes, setMachineTypes] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [exchangeRate, setExchangeRate] = useState(1.35);
    const [filteredParts, setFilteredParts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [stockFilter, setStockFilter] = useState("all");
    const [supplierFilter, setSupplierFilter] = useState("all");
    const [viewMode, setViewMode] = useState("card");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingPart, setEditingPart] = useState(null);
    const [assemblyComponents, setAssemblyComponents] = useState([]);
    const [newPart, setNewPart] = useState({
        part_name: "",
        part_number: "",
        supplier: "",
        cost: "",
        cost_usd: "",
        markup_percentage: "50",
        sales_price: "",
        nonsa_price: "",
        quantity_in_inventory: "",
        reorder_level: "",
        category: "",
        compatible_machine_types: [],
        description: "",
        is_assembly: false,
        assembly_labor_cost: ""
    });

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importErrors, setImportErrors] = useState([]);
    const fileInputRef = useRef(null);

    // Recursive function to calculate assembly cost including nested assemblies
    const calculateAssemblyCost = useCallback((assemblyId, partsMap, componentsMap, visited = new Set()) => {
        // Prevent infinite loops in case of circular references
        if (visited.has(assemblyId)) {
            console.warn(`Circular reference detected for assembly ${assemblyId}`);
            return 0;
        }
        visited.add(assemblyId);

        const components = componentsMap[assemblyId] || [];
        let totalCost = 0;

        components.forEach(comp => {
            const componentPart = partsMap[comp.component_part_id];
            if (componentPart) {
                if (componentPart.is_assembly) {
                    // Recursively calculate nested assembly cost
                    const nestedCost = calculateAssemblyCost(componentPart.id, partsMap, componentsMap, new Set(visited));
                    totalCost += nestedCost * comp.quantity_required;
                } else {
                    totalCost += (componentPart.cost || 0) * comp.quantity_required;
                }
            }
        });

        return totalCost;
    }, []);

    // Calculate available quantity for assemblies based on component availability
    const calculateAssemblyAvailability = useCallback((assemblyId, partsMap, componentsMap, visited = new Set()) => {
        if (visited.has(assemblyId)) {
            return 0;
        }
        visited.add(assemblyId);

        const components = componentsMap[assemblyId] || [];
        if (components.length === 0) return 0;

        let minAvailable = Infinity;

        components.forEach(comp => {
            const componentPart = partsMap[comp.component_part_id];
            if (componentPart) {
                let available;
                if (componentPart.is_assembly) {
                    available = calculateAssemblyAvailability(componentPart.id, partsMap, componentsMap, new Set(visited));
                } else {
                    available = componentPart.quantity_in_inventory || 0;
                }
                const possibleQty = Math.floor(available / comp.quantity_required);
                minAvailable = Math.min(minAvailable, possibleQty);
            } else {
                minAvailable = 0;
            }
        });

        return minAvailable === Infinity ? 0 : minAvailable;
    }, []);

    const loadPartsAndCategories = useCallback(async () => {
        setLoading(true);
        try {
            const filter = await withTenantFilter(); // Apply tenant filter

            const [partData, categoryData, machineTypeData, supplierData, settingsData, purchaseOrderData, purchaseOrderItemData, assemblyComponentData] = await Promise.all([
                Part.filter(filter),
                Category.filter(filter),
                MachineType.filter(filter),
                Supplier.filter(filter),
                Setting.filter({ ...filter, key: "usd_cad_exchange_rate" }), // Combine filters
                PurchaseOrder.filter({ ...filter, status: { $ne: 'Complete' } }), // Combine filters
                PurchaseOrderItem.filter(filter),
                AssemblyComponent.filter(filter)
            ]);
            
            const activePOIds = new Set(purchaseOrderData.map(po => po.id));
            const onOrderMap = {};
            
            purchaseOrderItemData.forEach(item => {
                if (activePOIds.has(item.purchase_order_id)) {
                    const onOrder = item.quantity_ordered - (item.quantity_received || 0);
                    if (onOrder > 0) {
                        onOrderMap[item.part_id] = (onOrderMap[item.part_id] || 0) + onOrder;
                    }
                }
            });

            // Create maps for efficient lookups
            const partsMap = (partData || []).reduce((acc, part) => {
                acc[part.id] = part;
                return acc;
            }, {});

            const componentsMap = (assemblyComponentData || []).reduce((acc, comp) => {
                if (!acc[comp.assembly_part_id]) {
                    acc[comp.assembly_part_id] = [];
                }
                acc[comp.assembly_part_id].push(comp);
                return acc;
            }, {});

            // Process parts with assembly calculations
            const partsWithOnOrder = (partData || []).map(part => {
                let finalCost = part.cost || 0;
                let availableQty = part.quantity_in_inventory || 0;

                if (part.is_assembly) {
                    // Calculate assembly cost from components
                    const componentsCost = calculateAssemblyCost(part.id, partsMap, componentsMap);
                    const laborCost = part.assembly_labor_cost || 0;
                    finalCost = componentsCost + laborCost;

                    // Calculate virtual inventory
                    availableQty = calculateAssemblyAvailability(part.id, partsMap, componentsMap);
                }

                // Recalculate sales price based on cost and markup
                const markup = part.markup_percentage || 50;
                const salesPrice = finalCost * (1 + markup / 100);

                return {
                    ...part,
                    cost: finalCost,
                    sales_price: salesPrice,
                    quantity_in_inventory: availableQty,
                    on_order: onOrderMap[part.id] || 0,
                    _components: componentsMap[part.id] || []
                };
            });
            
            setParts(partsWithOnOrder);
            setFilteredParts(partsWithOnOrder);
            setCategories(categoryData || []);
            setMachineTypes(machineTypeData || []);
            const sortedSuppliers = (supplierData || []).sort((a, b) => a.name.localeCompare(b.name));
            setSuppliers(sortedSuppliers);
            if (settingsData && settingsData.length > 0) {
                setExchangeRate(parseFloat(settingsData[0].value) || 1.35);
            }
        } catch (e) {
            setError("Failed to load parts, categories, machine types, or suppliers.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [calculateAssemblyCost, calculateAssemblyAvailability]);

    useEffect(() => {
        loadPartsAndCategories();
    }, [loadPartsAndCategories]);

    useEffect(() => {
        const results = parts.filter(part => {
            const searchMatch = part.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (part.supplier && part.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
            const categoryMatch = categoryFilter === 'all' || (part.category && part.category.toLowerCase() === categoryFilter.toLowerCase());
            const supplierMatch = supplierFilter === 'all' || part.supplier === supplierFilter;
            
            let stockMatch = true;
            if (stockFilter === 'out_of_stock') {
                stockMatch = part.quantity_in_inventory === 0;
            } else if (stockFilter === 'running_low') {
                stockMatch = part.quantity_in_inventory > 0 && 
                            part.reorder_level !== null && 
                            part.reorder_level !== undefined &&
                            part.reorder_level >= 0 &&
                            part.quantity_in_inventory <= part.reorder_level;
            } else if (stockFilter === 'needs_attention') {
                stockMatch = (part.quantity_in_inventory === 0) || 
                            (part.reorder_level !== null && 
                            part.reorder_level !== undefined &&
                            part.reorder_level >= 0 &&
                            part.quantity_in_inventory <= part.reorder_level);
            }
            
            return searchMatch && categoryMatch && stockMatch && supplierMatch;
        });
        setFilteredParts(results);
    }, [searchTerm, categoryFilter, stockFilter, supplierFilter, parts]);

    // Calculate CAD cost from USD if applicable (only for non-assembly parts)
    useEffect(() => {
        if (newPart.is_assembly) return; // Skip for assemblies

        const selectedSupplier = suppliers.find(s => s.name === newPart.supplier);

        if (selectedSupplier?.is_usd) {
            if (newPart.cost_usd !== "") {
                const cadCost = parseFloat(newPart.cost_usd) * exchangeRate;
                if (Math.abs(parseFloat(newPart.cost || 0) - cadCost) > 0.0001) {
                    setNewPart(prev => ({...prev, cost: cadCost.toFixed(4)}));
                }
            } else if (newPart.cost !== "") {
                setNewPart(prev => ({...prev, cost: ""}));
            }
        } else {
            if (newPart.cost_usd !== "") {
                setNewPart(prev => ({...prev, cost_usd: ""}));
            }
        }
    }, [newPart.cost_usd, newPart.supplier, suppliers, exchangeRate, newPart.cost, newPart.is_assembly]);

    // Calculate cost from assembly components
    useEffect(() => {
        if (!newPart.is_assembly) return;

        const componentsCost = assemblyComponents.reduce((sum, comp) => {
            const part = parts.find(p => p.id === comp.component_part_id);
            if (part) {
                return sum + (part.cost || 0) * (comp.quantity_required || 0);
            }
            return sum;
        }, 0);

        const laborCost = parseFloat(newPart.assembly_labor_cost) || 0;
        const totalCost = componentsCost + laborCost;

        if (Math.abs(parseFloat(newPart.cost || 0) - totalCost) > 0.01) {
            setNewPart(prev => ({ ...prev, cost: totalCost.toFixed(2) }));
        }
    }, [assemblyComponents, newPart.assembly_labor_cost, newPart.is_assembly, parts, newPart.cost]);

    // Calculate sales price when cost or markup changes
    useEffect(() => {
        if (newPart.cost && newPart.markup_percentage) {
            const cost = parseFloat(newPart.cost);
            const markup = parseFloat(newPart.markup_percentage);
            if (!isNaN(cost) && !isNaN(markup)) {
                const salesPrice = cost * (1 + markup / 100);
                setNewPart(prev => ({ ...prev, sales_price: salesPrice.toFixed(2) }));
            } else {
                 setNewPart(prev => ({ ...prev, sales_price: "" }));
            }
        } else {
            setNewPart(prev => ({ ...prev, sales_price: "" }));
        }
    }, [newPart.cost, newPart.markup_percentage]);

    const handleFixSupplierName = async () => {
        setLoading(true);
        setError("");
        setSuccessMessage("Searching for parts from 'Automation direct'...");
        try {
            const filter = await withTenantFilter();
            const partsToUpdate = await Part.filter({ ...filter, supplier: "Automation direct" });

            if (partsToUpdate.length === 0) {
                setSuccessMessage("No parts found with the supplier 'Automation direct'. Nothing to update.");
                setTimeout(() => setSuccessMessage(""), 5000);
                setLoading(false);
                return;
            }

            setSuccessMessage(`Found ${partsToUpdate.length} parts. Updating them to 'Automation Direct'...`);

            const updatePromises = partsToUpdate.map(part => 
                Part.update(part.id, { supplier: "Automation Direct" })
            );
            await Promise.all(updatePromises);
            
            setSuccessMessage(`Successfully updated ${partsToUpdate.length} parts. Reloading data.`);
            await loadPartsAndCategories();
            
            setTimeout(() => setSuccessMessage(""), 5000);

        } catch (e) {
            setError(`An error occurred during the update: ${e.message}`);
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePart = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");
        try {
            const selectedSupplier = suppliers.find(s => s.name === newPart.supplier);
            
            if (!newPart.part_name || !newPart.part_number) {
                throw new Error("Part Name and Part Number are required.");
            }

            // Validation for assemblies
            if (newPart.is_assembly) {
                if (assemblyComponents.length === 0) {
                    throw new Error("Assembly must have at least one component.");
                }
                if (assemblyComponents.some(c => !c.component_part_id || !c.quantity_required)) {
                    throw new Error("All assembly components must have a part selected and quantity specified.");
                }
            } else {
                // Validation for regular parts
                if (newPart.quantity_in_inventory === null || newPart.quantity_in_inventory === "") {
                    throw new Error("Quantity is required for regular parts.");
                }
                if (selectedSupplier?.is_usd && (newPart.cost_usd === null || newPart.cost_usd === "")) {
                    throw new Error("Cost (USD) is required for this supplier.");
                }
                if (!selectedSupplier?.is_usd && (newPart.cost === null || newPart.cost === "")) {
                    throw new Error("Cost (CAD) is required.");
                }
            }

            if (categories.length > 0 && !newPart.category) {
                throw new Error("Category is required.");
            }

            const parsedCost = newPart.cost !== "" ? parseFloat(newPart.cost) : null;
            const parsedCostUsd = newPart.cost_usd !== "" ? parseFloat(newPart.cost_usd) : null;
            const parsedMarkup = newPart.markup_percentage !== "" ? parseFloat(newPart.markup_percentage) : 50;
            const parsedSalesPrice = newPart.sales_price !== "" ? parseFloat(newPart.sales_price) : null;
            const parsedNonsaPrice = newPart.nonsa_price !== "" ? parseFloat(newPart.nonsa_price) : null;
            const parsedQuantity = newPart.is_assembly ? 0 : (newPart.quantity_in_inventory !== "" ? parseInt(newPart.quantity_in_inventory) : null);
            const parsedReorderLevel = newPart.reorder_level !== "" ? parseInt(newPart.reorder_level) : 10;
            const parsedLaborCost = newPart.assembly_labor_cost !== "" ? parseFloat(newPart.assembly_labor_cost) : 0;

            let partData = {
                ...newPart,
                cost: parsedCost,
                cost_usd: parsedCostUsd,
                markup_percentage: parsedMarkup,
                sales_price: parsedSalesPrice,
                nonsa_price: parsedNonsaPrice,
                quantity_in_inventory: parsedQuantity,
                reorder_level: parsedReorderLevel,
                category: newPart.category || (categories.length > 0 ? categories[0].name : "uncategorized"),
                compatible_machine_types: newPart.compatible_machine_types || [],
                supplier: newPart.supplier === "" ? null : newPart.supplier,
                is_assembly: newPart.is_assembly,
                assembly_labor_cost: newPart.is_assembly ? parsedLaborCost : null
            };

            let savedPartId;

            if (editingPart) {
                await Part.update(editingPart.id, partData);
                savedPartId = editingPart.id;

                // Update assembly components
                if (newPart.is_assembly) {
                    // Delete existing components
                    const filter = await withTenantFilter();
                    const existingComponents = await AssemblyComponent.filter({ ...filter, assembly_part_id: editingPart.id });
                    await Promise.all(existingComponents.map(c => AssemblyComponent.delete(c.id)));
                    
                    // Create new components
                    if (assemblyComponents.length > 0) {
                        const componentsWithTenant = await Promise.all(assemblyComponents.map(comp => addTenantId({
                            assembly_part_id: editingPart.id,
                            component_part_id: comp.component_part_id,
                            quantity_required: comp.quantity_required
                        })));
                        await AssemblyComponent.bulkCreate(componentsWithTenant);
                    }
                }

                setSuccessMessage("Part successfully updated!");
            } else {
                const partWithTenant = await addTenantId(partData); // Add tenant ID for new part
                const newPartRecord = await Part.create(partWithTenant);
                savedPartId = newPartRecord.id;

                // Create assembly components
                if (newPart.is_assembly && assemblyComponents.length > 0) {
                    const componentsWithTenant = await Promise.all(assemblyComponents.map(comp => addTenantId({
                        assembly_part_id: savedPartId,
                        component_part_id: comp.component_part_id,
                        quantity_required: comp.quantity_required
                    })));
                    await AssemblyComponent.bulkCreate(componentsWithTenant);
                }

                setSuccessMessage("Part successfully created!");
            }
            
            setIsDialogOpen(false); // Use setIsDialogOpen instead of setIsFormOpen
            await loadPartsAndCategories();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(e.message || "Failed to save part.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditPart = async (part) => {
        setEditingPart(part);
        setNewPart({
            part_name: part.part_name || "",
            part_number: part.part_number || "",
            supplier: part.supplier === null ? "" : part.supplier,
            cost: part.cost?.toString() || "",
            cost_usd: part.cost_usd?.toString() || "",
            markup_percentage: part.markup_percentage?.toString() || "50",
            sales_price: part.sales_price?.toString() || "",
            nonsa_price: part.nonsa_price?.toString() || "",
            quantity_in_inventory: part.is_assembly ? "0" : (part.quantity_in_inventory?.toString() || ""),
            reorder_level: part.reorder_level?.toString() || "",
            category: part.category || (categories.length > 0 ? categories[0].name : ""),
            compatible_machine_types: part.compatible_machine_types || [],
            description: part.description || "",
            is_assembly: part.is_assembly || false,
            assembly_labor_cost: part.assembly_labor_cost?.toString() || ""
        });

        // Load assembly components if it's an assembly
        if (part.is_assembly) {
            try {
                const filter = await withTenantFilter();
                const components = await AssemblyComponent.filter({ ...filter, assembly_part_id: part.id });
                setAssemblyComponents(components);
            } catch (e) {
                console.error("Failed to load assembly components:", e);
                setAssemblyComponents([]);
            }
        } else {
            setAssemblyComponents([]);
        }

        setIsDialogOpen(true);
    };

    const handleExport = () => {
        const headers = [
            "part_name", "part_number", "supplier", "cost", "cost_usd", "markup_percentage", "sales_price", "nonsa_price",
            "quantity_in_inventory", "reorder_level", "category", "compatible_machine_types", "description", "is_assembly", "assembly_labor_cost"
        ];
        const escapeCsv = (value) => {
            if (value === null || value === undefined) return '';
            let stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        const csvRows = [headers.map(h => escapeCsv(h)).join(",")];
        
        filteredParts.forEach(part => {
            const row = [
                escapeCsv(part.part_name),
                escapeCsv(part.part_number),
                escapeCsv(part.supplier),
                escapeCsv(part.cost),
                escapeCsv(part.cost_usd),
                escapeCsv(part.markup_percentage),
                escapeCsv(part.sales_price),
                escapeCsv(part.nonsa_price),
                escapeCsv(part.quantity_in_inventory),
                escapeCsv(part.reorder_level),
                escapeCsv(part.category),
                escapeCsv((part.compatible_machine_types || []).join(';')),
                escapeCsv(part.description),
                escapeCsv(part.is_assembly),
                escapeCsv(part.assembly_labor_cost)
            ];
            csvRows.push(row.join(","));
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parts_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleImportFileChange = (event) => {
        setImportFile(event.target.files[0]);
    };

    const parseCsvRow = (row) => {
        const values = [];
        let inQuote = false;
        let currentValue = '';

        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            const nextChar = row[i + 1];

            if (char === '"') {
                if (inQuote && nextChar === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue);

        return values;
    };

    const handleImport = async () => {
        if (!importFile) {
            setImportErrors(["Please select a CSV file."]);
            return;
        }

        setImporting(true);
        setImportErrors([]);
        setSuccessMessage("");

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

            if (lines.length <= 1) {
                setImportErrors(["CSV file is empty or only contains headers."]);
                setImporting(false);
                return;
            }

            const headerValues = parseCsvRow(lines[0]);
            const actualHeaders = headerValues.map(h => h.trim().toLowerCase());

            const expectedHeaders = [
                "part_name", "part_number", "supplier", "cost", "cost_usd", "markup_percentage", "sales_price", "nonsa_price",
                "quantity_in_inventory", "reorder_level", "category", "compatible_machine_types", "description", "is_assembly", "assembly_labor_cost" // Added for completeness, although newPart.is_assembly handles it.
            ];
            const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));
            if (missingHeaders.length > 0) {
                setImportErrors([`Missing expected CSV headers: ${missingHeaders.join(', ')}. Please ensure all columns are present.`]);
                setImporting(false);
                return;
            }

            const partsToCreate = [];
            const partsToUpdate = [];
            const newErrors = [];
            
            const existingPartsByNumber = parts.reduce((acc, part) => {
                acc[part.part_number] = part;
                return acc;
            }, {});

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim()) continue;

                try {
                    const values = parseCsvRow(line);
                    const partData = {};

                    actualHeaders.forEach((header, index) => {
                        const rawValue = values[index];
                        const value = rawValue === undefined ? '' : rawValue.trim();

                        switch (header) {
                            case "part_name":
                            case "part_number":
                            case "supplier":
                            case "category":
                            case "description":
                                partData[header] = value;
                                break;
                            case "cost":
                            case "cost_usd":
                            case "markup_percentage":
                            case "sales_price":
                            case "nonsa_price":
                            case "assembly_labor_cost":
                                partData[header] = value ? parseFloat(value) : null;
                                if (isNaN(partData[header])) partData[header] = null;
                                break;
                            case "quantity_in_inventory":
                            case "reorder_level":
                                partData[header] = value ? parseInt(value, 10) : null;
                                if (isNaN(partData[header])) partData[header] = null;
                                break;
                            case "compatible_machine_types":
                                partData[header] = value ? value.split(';').map(s => s.trim()).filter(s => s) : [];
                                break;
                            case "is_assembly":
                                partData[header] = value.toLowerCase() === 'true' || value === '1';
                                break;
                            default:
                                break;
                        }
                    });

                    const supplierNameFromCSV = partData.supplier;
                    const selectedSupplierFromCSV = suppliers.find(s => s.name === supplierNameFromCSV);

                    // Skip quantity check for assemblies as it's calculated
                    if (!partData.is_assembly && (partData.quantity_in_inventory === null || partData.quantity_in_inventory === "")) {
                        newErrors.push(`Row ${i + 1} (Part Number: ${partData.part_number || 'N/A'}): Missing required field (Quantity). Skipping.`);
                        continue;
                    }
                    if (selectedSupplierFromCSV?.is_usd && (partData.cost_usd === null || partData.cost_usd === "")) {
                        newErrors.push(`Row ${i + 1} (Part Number: ${partData.part_number || 'N/A'}): Supplier '${supplierNameFromCSV}' requires Cost (USD). Skipping.`);
                        continue;
                    }
                    if (!selectedSupplierFromCSV?.is_usd && (partData.cost === null || partData.cost === "")) {
                        newErrors.push(`Row ${i + 1} (Part Number: ${partData.part_number || 'N/A'}): Cost (CAD) is required. Skipping.`);
                        continue;
                    }

                    if (selectedSupplierFromCSV?.is_usd && partData.cost_usd !== null) {
                        partData.cost = parseFloat(partData.cost_usd) * exchangeRate;
                    }

                    const finalMarkupPercentage = partData.markup_percentage ?? 50;
                    let finalSalesPrice = partData.sales_price;
                    if (finalSalesPrice === null && partData.cost !== null) {
                        finalSalesPrice = partData.cost * (1 + finalMarkupPercentage / 100);
                    }
                    
                    const finalPartData = {
                        part_name: partData.part_name,
                        part_number: partData.part_number,
                        supplier: partData.supplier === "" ? null : partData.supplier,
                        cost: partData.cost,
                        cost_usd: partData.cost_usd,
                        markup_percentage: finalMarkupPercentage,
                        sales_price: finalSalesPrice,
                        nonsa_price: partData.nonsa_price,
                        quantity_in_inventory: partData.is_assembly ? 0 : (partData.quantity_in_inventory ?? 0), // Assemblies have 0 initial stock
                        reorder_level: partData.reorder_level ?? 10,
                        category: partData.category || (categories.length > 0 ? categories[0].name : "uncategorized"),
                        compatible_machine_types: partData.compatible_machine_types || [],
                        description: partData.description || "",
                        is_assembly: partData.is_assembly || false,
                        assembly_labor_cost: partData.is_assembly ? (partData.assembly_labor_cost ?? 0) : null
                    };
                    
                    const existingPart = existingPartsByNumber[partData.part_number];
                    if (existingPart) {
                        partsToUpdate.push({ id: existingPart.id, data: finalPartData });
                    } else {
                        partsToCreate.push(finalPartData);
                    }

                } catch (err) {
                    newErrors.push(`Row ${i + 1}: Failed to process - ${err.message || err}.`);
                    console.error(`Error processing CSV row ${i + 1}:`, err);
                }
            }

            try {
                if (partsToCreate.length > 0) {
                    const BATCH_SIZE = 50;
                    for (let i = 0; i < partsToCreate.length; i += BATCH_SIZE) {
                        const batch = partsToCreate.slice(i, i + BATCH_SIZE);
                        const processedBatch = await Promise.all(batch.map(addTenantId)); // Add tenant_id here
                        await Part.bulkCreate(processedBatch);
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                if (partsToUpdate.length > 0) {
                    for (const { id, data } of partsToUpdate) {
                        await Part.update(id, data);
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
            } catch (err) {
                newErrors.push(`Error during bulk operation: ${err.message || 'An unknown error occurred during saving to database'}`);
                console.error("Bulk save/update error:", err);
            }

            if (newErrors.length > 0) {
                setImportErrors(newErrors);
                setSuccessMessage(`Import completed with ${partsToCreate.length + partsToUpdate.length} parts processed and ${newErrors.length} errors.`);
            } else {
                setSuccessMessage(`Successfully processed ${partsToCreate.length + partsToUpdate.length} parts.`);
                setIsImportDialogOpen(false);
            }
            await loadPartsAndCategories();
            setImporting(false);
            setImportFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            setTimeout(() => setSuccessMessage(""), 6000);
        };
        reader.onerror = () => {
            setImportErrors(["Failed to read file."]);
            setImporting(false);
        };
        reader.readAsText(importFile);
    };

    const getStockStatus = (part) => {
        if (part.quantity_in_inventory === 0) {
            if (part.on_order > 0) {
                return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Backordered</Badge>;
            }
            return <Badge variant="destructive">Out of Stock</Badge>;
        }
        if (part.reorder_level !== null && part.reorder_level !== undefined && part.reorder_level >= 0 && part.quantity_in_inventory <= part.reorder_level) {
            return <Badge variant="warning" className="bg-yellow-500 text-white hover:bg-yellow-600">Low Stock</Badge>;
        }
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">In Stock</Badge>;
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center"><Settings className="mr-2" />Parts Inventory</CardTitle>
                        <CardDescription>Manage your parts inventory and pricing.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleFixSupplierName}>
                            <Wrench className="mr-2 h-4 w-4" />
                            Fix Supplier Name
                        </Button>
                        <Button variant="outline" onClick={handleExport} disabled={filteredParts.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
                            setIsImportDialogOpen(open);
                            if (!open) {
                                setImportFile(null);
                                setImportErrors([]);
                                setImporting(false);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = "";
                                }
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import CSV
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Import Parts from CSV</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <Label htmlFor="csvFile">CSV File</Label>
                                    <Input
                                        id="csvFile"
                                        type="file"
                                        accept=".csv"
                                        onChange={handleImportFileChange}
                                        ref={fileInputRef}
                                        className="col-span-3"
                                    />
                                    {importErrors.length > 0 && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {importErrors.map((err, index) => (
                                                <Alert key={index} variant="destructive">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertDescription>{err}</AlertDescription>
                                                </Alert>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Button onClick={handleImport} disabled={!importFile || importing}>
                                    {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing...</> : "Start Import"}
                                </Button>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isDialogOpen} onOpenChange={(open) => {
                            setIsDialogOpen(open);
                            if (!open) {
                                setEditingPart(null);
                                setAssemblyComponents([]);
                                setNewPart({
                                    part_name: "",
                                    part_number: "",
                                    supplier: "",
                                    cost: "",
                                    cost_usd: "",
                                    markup_percentage: "50",
                                    sales_price: "",
                                    nonsa_price: "",
                                    quantity_in_inventory: "",
                                    reorder_level: "",
                                    category: categories.length > 0 ? categories[0].name : "",
                                    compatible_machine_types: [],
                                    description: "",
                                    is_assembly: false,
                                    assembly_labor_cost: ""
                                });
                                setError("");
                            } else if (!editingPart) {
                                if (categories.length > 0) {
                                    setNewPart(prev => ({ ...prev, category: categories[0].name }));
                                }
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button><Plus className="mr-2 h-4 w-4" />Add Part</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</DialogTitle>
                                </DialogHeader>
                                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                                <form onSubmit={handleSavePart} className="space-y-4 pt-4">
                                    <div className="flex items-center space-x-2 p-3 border rounded-lg bg-blue-50">
                                        <Checkbox
                                            id="is_assembly"
                                            checked={newPart.is_assembly}
                                            onCheckedChange={(checked) => {
                                                setNewPart({...newPart, is_assembly: checked});
                                                if (!checked) {
                                                    setAssemblyComponents([]);
                                                }
                                            }}
                                        />
                                        <Label htmlFor="is_assembly" className="cursor-pointer font-semibold">
                                            This is an Assembly/Kit (made from other parts)
                                        </Label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="part_name">Part Name *</Label>
                                            <Input id="part_name" value={newPart.part_name} onChange={(e) => setNewPart({...newPart, part_name: e.target.value})} required />
                                        </div>
                                        <div>
                                            <Label htmlFor="part_number">Part Number *</Label>
                                            <Input id="part_number" value={newPart.part_number} onChange={(e) => setNewPart({...newPart, part_number: e.target.value})} required />
                                        </div>
                                    </div>

                                    {!newPart.is_assembly && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="supplier">Supplier</Label>
                                                <Select
                                                    value={newPart.supplier || "none"}
                                                    onValueChange={(value) => setNewPart({ ...newPart, supplier: value === "none" ? "" : value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a supplier" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">None</SelectItem>
                                                        {suppliers.map(sup => (
                                                            <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor="category">Category</Label>
                                                <Select 
                                                    value={newPart.category} 
                                                    onValueChange={(value) => setNewPart({...newPart, category: value})}
                                                    required={categories.length > 0}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {categories.map(cat => (
                                                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                                        ))}
                                                        {categories.length === 0 && (
                                                            <SelectItem value="no_category_available" disabled>No categories available</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {newPart.is_assembly && (
                                        <div>
                                            <Label htmlFor="category">Category</Label>
                                            <Select 
                                                value={newPart.category} 
                                                onValueChange={(value) => setNewPart({...newPart, category: value})}
                                                required={categories.length > 0}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(cat => (
                                                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                                    ))}
                                                    {categories.length === 0 && (
                                                        <SelectItem value="no_category_available" disabled>No categories available</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {newPart.is_assembly && (
                                        <>
                                            <AssemblyComponentsManager
                                                components={assemblyComponents}
                                                onChange={setAssemblyComponents}
                                                availableParts={parts}
                                                currentAssemblyId={editingPart?.id}
                                            />
                                            <div>
                                                <Label htmlFor="assembly_labor_cost">Assembly Labor Cost ($)</Label>
                                                <Input 
                                                    id="assembly_labor_cost" 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={newPart.assembly_labor_cost} 
                                                    onChange={(e) => setNewPart({...newPart, assembly_labor_cost: e.target.value})} 
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <Label>Compatible Machine Types</Label>
                                        <div className="mt-2 space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={newPart.compatible_machine_types.length === machineTypes.length && machineTypes.length > 0}
                                                    onChange={(e) => {
                                                        const allTypes = machineTypes.map(t => t.name);
                                                        setNewPart({ ...newPart, compatible_machine_types: e.target.checked ? allTypes : [] });
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="font-medium">All Machine Types</span>
                                            </label>
                                            <hr className="my-2" />
                                            {machineTypes.map((type) => (
                                                <label key={type.id} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={newPart.compatible_machine_types.includes(type.name)}
                                                        onChange={(e) => {
                                                            const currentTypes = newPart.compatible_machine_types;
                                                            const newTypes = e.target.checked
                                                                ? [...currentTypes, type.name]
                                                                : currentTypes.filter(t => t !== type.name);
                                                            setNewPart({...newPart, compatible_machine_types: newTypes });
                                                        }}
                                                        className="rounded"
                                                    />
                                                    <span>{type.name}</span>
                                                </label>
                                            ))}
                                            {machineTypes.length === 0 && (
                                                <p className="text-sm text-gray-500">No machine types available</p>
                                            )}
                                        </div>
                                    </div>

                                    {!newPart.is_assembly && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                          {suppliers.find(s => s.name === newPart.supplier)?.is_usd && (
                                              <div>
                                                  <Label htmlFor="cost_usd">Cost (USD) *</Label>
                                                  <Input id="cost_usd" type="number" step="0.01" value={newPart.cost_usd} onChange={(e) => setNewPart({...newPart, cost_usd: e.target.value, cost: ''})} required />
                                              </div>
                                          )}
                                          <div>
                                              <Label htmlFor="cost">Cost (CAD){suppliers.find(s => s.name === newPart.supplier)?.is_usd ? '' : ' *'}</Label>
                                              <Input id="cost" type="number" step="0.01" value={newPart.cost} 
                                                onChange={(e) => setNewPart({...newPart, cost: e.target.value})} 
                                                readOnly={suppliers.find(s => s.name === newPart.supplier)?.is_usd}
                                                required={!suppliers.find(s => s.name === newPart.supplier)?.is_usd}
                                                className={suppliers.find(s => s.name === newPart.supplier)?.is_usd ? 'bg-gray-100' : ''}
                                              />
                                          </div>
                                        </div>
                                    )}

                                    {newPart.is_assembly && (
                                        <div>
                                            <Label htmlFor="cost">Total Cost (CAD) - Calculated</Label>
                                            <Input 
                                                id="cost" 
                                                type="number" 
                                                step="0.01" 
                                                value={newPart.cost} 
                                                readOnly 
                                                className="bg-gray-100 font-semibold"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Cost is automatically calculated from components and labor</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label htmlFor="markup_percentage">Markup %</Label>
                                            <Input id="markup_percentage" type="number" value={newPart.markup_percentage} onChange={(e) => setNewPart({...newPart, markup_percentage: e.target.value})} />
                                        </div>
                                        <div>
                                            <Label htmlFor="sales_price">Sales Price</Label>
                                            <Input id="sales_price" type="number" step="0.01" value={newPart.sales_price} readOnly className="bg-gray-100" />
                                        </div>
                                        <div>
                                            <Label htmlFor="nonsa_price">NonSA Price</Label>
                                            <Input id="nonsa_price" type="number" step="0.01" value={newPart.nonsa_price} onChange={(e) => setNewPart({...newPart, nonsa_price: e.target.value})} />
                                        </div>
                                    </div>

                                    {!newPart.is_assembly && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="quantity_in_inventory">Current Stock *</Label>
                                                <Input id="quantity_in_inventory" type="number" value={newPart.quantity_in_inventory} onChange={(e) => setNewPart({...newPart, quantity_in_inventory: e.target.value})} required />
                                            </div>
                                            <div>
                                                <Label htmlFor="reorder_level">Reorder Level</Label>
                                                <Input id="reorder_level" type="number" value={newPart.reorder_level} onChange={(e) => setNewPart({...newPart, reorder_level: e.target.value})} />
                                            </div>
                                        </div>
                                    )}

                                    {newPart.is_assembly && (
                                        <div className="p-3 border rounded-lg bg-yellow-50">
                                            <p className="text-sm font-medium">Assembly Inventory Note:</p>
                                            <p className="text-xs text-gray-600">Inventory for assemblies is calculated automatically based on component availability. You don't need to track assembly stock separately.</p>
                                        </div>
                                    )}

                                    <div>
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea id="description" value={newPart.description} onChange={(e) => setNewPart({...newPart, description: e.target.value})} />
                                    </div>

                                    <Button type="submit" disabled={isSubmitting} className="w-full">
                                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingPart ? "Update Part" : "Save Part")}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input placeholder="Search by name, part number, supplier..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                         <Filter className="h-5 w-5 text-muted-foreground"/>
                         <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                         <Filter className="h-5 w-5 text-muted-foreground"/>
                         <Select value={stockFilter} onValueChange={setStockFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by stock" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Stock Levels</SelectItem>
                                <SelectItem value="needs_attention">Needs Attention</SelectItem>
                                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                                <SelectItem value="running_low">Running Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                         <Filter className="h-5 w-5 text-muted-foreground"/>
                         <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by supplier" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Suppliers</SelectItem>
                                {suppliers.map(sup => (
                                    <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center border rounded-md">
                        <Button 
                            variant={viewMode === 'card' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => setViewMode('card')}
                            className="rounded-r-none"
                        >
                            <Grid className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant={viewMode === 'list' ? 'default' : 'ghost'} 
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className="rounded-l-none"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {successMessage && <Alert className="mb-4 bg-green-50 border-green-200 text-green-800"><CheckCircle className="h-4 w-4" /><AlertDescription>{successMessage}</AlertDescription></Alert>}
                {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : error && !isDialogOpen && !isImportDialogOpen ? (
                    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
                ) : (
                    <>
                        {viewMode === 'card' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredParts.length > 0 ? filteredParts.map(part => (
                                   <PartCard key={part.id} part={part} onEdit={handleEditPart} />
                                )) : (
                                    <div className="col-span-full text-center py-12 text-gray-500">
                                        <p className="text-lg font-semibold">No parts found</p>
                                        <p>Try adjusting your search or filters.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Part Name</TableHead>
                                            <TableHead>Part Number</TableHead>
                                            <TableHead>Supplier</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Cost (CAD)</TableHead>
                                            <TableHead className="text-right">Sales Price</TableHead>
                                            <TableHead className="text-center">Stock</TableHead>
                                            <TableHead className="text-center">On Order</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredParts.length > 0 ? filteredParts.map(part => (
                                            <TableRow key={part.id}>
                                                <TableCell className="font-medium">
                                                    {part.part_name}
                                                    {part.is_assembly && <Badge className="ml-2" variant="secondary">Assembly</Badge>}
                                                </TableCell>
                                                <TableCell>{part.part_number}</TableCell>
                                                <TableCell>{part.supplier || 'N/A'}</TableCell>
                                                <TableCell><Badge variant="outline">{part.category}</Badge></TableCell>
                                                <TableCell className="text-right">${part.cost?.toFixed(2) || '0.00'}</TableCell>
                                                <TableCell className="text-right font-semibold">${part.sales_price?.toFixed(2) || '0.00'}</TableCell>
                                                <TableCell className="text-center">
                                                    {part.quantity_in_inventory}
                                                    {part.is_assembly && <span className="text-xs text-gray-500 ml-1">(calc)</span>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {part.on_order > 0 ? (
                                                        <span className="text-blue-600 font-medium">{part.on_order}</span>
                                                    ) : (
                                                        <span className="text-gray-400">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{getStockStatus(part)}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => handleEditPart(part)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan="10" className="text-center py-12 text-gray-500">
                                                    <p className="text-lg font-semibold">No parts found</p>
                                                    <p>Try adjusting your search or filters.</p>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
