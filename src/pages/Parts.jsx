import React, { useState, useEffect, useCallback, useRef } from "react";
import { AssemblyComponent, Category, MachineType, Part, PurchaseOrder, PurchaseOrderItem, Setting, Supplier, Transaction } from '@/api/entities';
import { invokeApi } from '@/api/supabaseClient';
 // Added Transaction import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Settings, Loader2, AlertTriangle, Search, CheckCircle, Download, Upload, Filter, Wrench, Grid, List, Pencil, Trash2, AlertCircle, ShoppingCart, ListPlus, Star, Printer, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import PartCard from "../components/parts/PartCard";
import AssemblyComponentsManager from "../components/parts/AssemblyComponentsManager";
import PartsCartModal from "../components/parts/PartsCartModal";
import AssemblyPrintLayout from "../components/parts/AssemblyPrintLayout";
import { applySortSettings, sortArray } from '@/components/utils/sortUtils';
import { useAuth } from '@/lib/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Added AlertDialog components

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
    const [machineTypeFilter, setMachineTypeFilter] = useState("all");
    const [showObsolete, setShowObsolete] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [sortColumn, setSortColumn] = useState("");
    const [sortDirection, setSortDirection] = useState("desc");
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
        assembly_labor_cost: "",
        is_obsolete: false,
        is_internal: false,
        is_pack: false,
        pack_size: "1",
        cost_per_pack: ""
    });

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importErrors, setImportErrors] = useState([]);
    const fileInputRef = useRef(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [partToDelete, setPartToDelete] = useState(null);
    const [deleteWarnings, setDeleteWarnings] = useState([]);
    
    const [isBuildDialogOpen, setIsBuildDialogOpen] = useState(false);
    const [buildingPart, setBuildingPart] = useState(null);
    const [buildQuantity, setBuildQuantity] = useState(1);
    const [isBuilding, setIsBuilding] = useState(false);
    const [buildError, setBuildError] = useState("");
    
    const [cartItems, setCartItems] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [showAssemblyPrint, setShowAssemblyPrint] = useState(false);

    // Manual inventory quantity change warning (part detail/edit page)
    const [showQuantityWarning, setShowQuantityWarning] = useState(false);
    const [pendingQuantityChange, setPendingQuantityChange] = useState(null);
    const { user } = useAuth();

    // Recursive function to calculate assembly cost including nested assemblies
    const calculateAssemblyCost = useCallback((assemblyId, partsMap, componentsMap, visited = new Set()) => {
        if (visited.has(assemblyId)) return 0;
        visited.add(assemblyId);
        const components = componentsMap[assemblyId] || [];
        let totalCost = 0;
        components.forEach(comp => {
            const componentPart = partsMap[comp.component_part_id];
            if (componentPart) {
                if (componentPart.is_assembly) {
                    const nestedCost = calculateAssemblyCost(componentPart.id, partsMap, componentsMap, new Set(visited));
                    totalCost += nestedCost * comp.quantity_required;
                } else {
                    totalCost += (componentPart.cost || 0) * comp.quantity_required;
                }
            }
        });
        return totalCost;
    }, []);

    // Recursive function to calculate assembly sales price from component sales prices
    const calculateAssemblySalesPrice = useCallback((assemblyId, partsMap, componentsMap, laborCost = 0, visited = new Set()) => {
        if (visited.has(assemblyId)) return 0;
        visited.add(assemblyId);
        const components = componentsMap[assemblyId] || [];
        let totalSalesPrice = 0;
        components.forEach(comp => {
            const componentPart = partsMap[comp.component_part_id];
            if (componentPart) {
                if (componentPart.is_assembly) {
                    // For nested assemblies, use their already-computed sales_price
                    totalSalesPrice += (componentPart.sales_price || 0) * comp.quantity_required;
                } else {
                    totalSalesPrice += (componentPart.sales_price || 0) * comp.quantity_required;
                }
            }
        });
        return totalSalesPrice + laborCost;
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
            const [partData, categoryData, machineTypeData, supplierData, settingsData, purchaseOrderData, purchaseOrderItemData, assemblyComponentData, transactionData, sortSettings, partsViewDefaults] = await Promise.all([
                Part.list(),
                Category.list(),
                MachineType.list(),
                Supplier.list(),
                Setting.filter({ key: "usd_cad_exchange_rate" }),
                PurchaseOrder.filter({ status: { $ne: 'Complete' } }),
                PurchaseOrderItem.list(),
                AssemblyComponent.list(),
                Transaction.filter({ date: { $gte: (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().split('T')[0]; })() } }),
                applySortSettings(),
                Setting.filter({ key: 'parts_view_defaults' })
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

            // Calculate auto-favorites (parts used in >1 order in past 3 months)
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            
            const autoFavoriteMap = {};
            (transactionData || []).forEach(t => {
                if (t.part_id && t.order_id && new Date(t.date) >= threeMonthsAgo) {
                    if (!autoFavoriteMap[t.part_id]) {
                        autoFavoriteMap[t.part_id] = new Set();
                    }
                    autoFavoriteMap[t.part_id].add(t.order_id);
                }
            });

            // Process parts with assembly calculations
            const partsWithOnOrder = (partData || []).map(part => {
                let finalCost = part.cost || 0;
                let availableQty = part.quantity_in_inventory || 0;
                let canBuild = 0;

                let salesPrice;
                if (part.is_assembly) {
                    const componentsCost = calculateAssemblyCost(part.id, partsMap, componentsMap);
                    const laborCost = part.assembly_labor_cost || 0;
                    finalCost = componentsCost + laborCost;
                    canBuild = calculateAssemblyAvailability(part.id, partsMap, componentsMap);
                    availableQty = part.quantity_in_inventory || 0;
                    // Sales price = sum of component sales prices × qty + labor cost
                    salesPrice = calculateAssemblySalesPrice(part.id, partsMap, componentsMap, laborCost);
                } else {
                    const markup = part.markup_percentage || 50;
                    salesPrice = finalCost * (1 + markup / 100);
                }

                // Check if auto-favorite (used in >1 order)
                const orderCount = autoFavoriteMap[part.id] ? autoFavoriteMap[part.id].size : 0;
                const isAutoFavorite = orderCount > 1;

                return {
                    ...part,
                    cost: finalCost,
                    sales_price: salesPrice,
                    quantity_in_inventory: availableQty,
                    can_build: canBuild,
                    on_order: onOrderMap[part.id] || 0,
                    _components: componentsMap[part.id] || [],
                    is_auto_favorite: isAutoFavorite,
                    is_any_favorite: part.is_favorite || isAutoFavorite
                };
            });
            
            const sortedParts = sortArray(partsWithOnOrder, sortSettings.parts);
            
            setParts(sortedParts);
            setFilteredParts(sortedParts);
            setCategories(categoryData || []);
            setMachineTypes(machineTypeData || []);
            const sortedSuppliers = (supplierData || []).sort((a, b) => a.name.localeCompare(b.name));
            setSuppliers(sortedSuppliers);
            if (settingsData && settingsData.length > 0) {
                setExchangeRate(parseFloat(settingsData[0].value) || 1.35);
            }
            
            // Apply default view settings: sessionStorage (sticky for session) takes priority over DB setting
            const sessionFavorites = sessionStorage.getItem('parts_showFavoritesOnly');
            if (sessionFavorites !== null) {
                setShowFavoritesOnly(sessionFavorites === 'true');
            } else if (partsViewDefaults && partsViewDefaults.length > 0) {
                const defaults = JSON.parse(partsViewDefaults[0].value);
                if (defaults.showFavoritesOnly) {
                    setShowFavoritesOnly(true);
                }
            }
            if (partsViewDefaults && partsViewDefaults.length > 0) {
                const defaults = JSON.parse(partsViewDefaults[0].value);
                if (defaults.isListView) {
                    setViewMode('list');
                }
            }
        } catch (e) {
            setError("Failed to load parts, categories, machine types, or suppliers.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [calculateAssemblyCost, calculateAssemblyAvailability, calculateAssemblySalesPrice]);

    useEffect(() => {
        loadPartsAndCategories();
    }, [loadPartsAndCategories]);

    useEffect(() => {
        let results = parts.filter(part => {
            const searchMatch = part.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                part.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (part.supplier && part.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
            const categoryMatch = categoryFilter === 'all' || (part.category && part.category.toLowerCase() === categoryFilter.toLowerCase());
            const supplierMatch = supplierFilter === 'all' || part.supplier === supplierFilter;
            const machineTypeMatch = machineTypeFilter === 'all' || (part.compatible_machine_types && part.compatible_machine_types.includes(machineTypeFilter));
            const obsoleteMatch = showObsolete || !part.is_obsolete;
            const favoriteMatch = !showFavoritesOnly || part.is_any_favorite;
            
            let stockMatch = true;
            if (stockFilter !== 'all') {
                // Hide parts that are on order or buildable when any stock filter is active
                if (part.on_order > 0 || part.can_build > 0) {
                    stockMatch = false;
                } else if (stockFilter === 'out_of_stock') {
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
            }
            
            return searchMatch && categoryMatch && stockMatch && supplierMatch && machineTypeMatch && obsoleteMatch && favoriteMatch;
        });
        
        // Apply sorting if column is selected
        if (sortColumn) {
            results = [...results].sort((a, b) => {
                let aVal = a[sortColumn];
                let bVal = b[sortColumn];
                
                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;
                
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortDirection === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
                }
                
                if (sortDirection === 'desc') {
                    return bVal - aVal;
                } else {
                    return aVal - bVal;
                }
            });
        }
        
        setFilteredParts(results);
    }, [searchTerm, categoryFilter, stockFilter, supplierFilter, machineTypeFilter, parts, showObsolete, showFavoritesOnly, sortColumn, sortDirection]);

    // Calculate CAD cost from USD if applicable (only for non-assembly, non-pack parts)
    useEffect(() => {
        if (newPart.is_assembly) return; // Skip for assemblies
        if (newPart.is_pack) return; // Skip for pack parts (cost is derived from cost_per_pack)

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

    // Calculate cost and sales price from assembly components
    useEffect(() => {
        if (!newPart.is_assembly) return;

        const laborCost = parseFloat(newPart.assembly_labor_cost) || 0;

        const componentsCost = assemblyComponents.reduce((sum, comp) => {
            const part = parts.find(p => p.id === comp.component_part_id);
            return part ? sum + (part.cost || 0) * (comp.quantity_required || 0) : sum;
        }, 0);
        const totalCost = componentsCost + laborCost;

        // Sales price = sum of component sales prices × qty + labor cost
        const componentsSalesPrice = assemblyComponents.reduce((sum, comp) => {
            const part = parts.find(p => p.id === comp.component_part_id);
            return part ? sum + (part.sales_price || 0) * (comp.quantity_required || 0) : sum;
        }, 0);
        const totalSalesPrice = componentsSalesPrice + laborCost;

        setNewPart(prev => ({
            ...prev,
            cost: totalCost.toFixed(2),
            sales_price: totalSalesPrice.toFixed(2)
        }));
    }, [assemblyComponents, newPart.assembly_labor_cost, newPart.is_assembly, parts]);

    // Calculate unit cost from pack cost and pack size (handles both USD and CAD suppliers)
    useEffect(() => {
        if (!newPart.is_pack) return;
        const isUsd = suppliers.find(s => s.name === newPart.supplier)?.is_usd;
        const packCost = parseFloat(newPart.cost_per_pack);
        const packSize = parseFloat(newPart.pack_size);
        if (!isNaN(packCost) && !isNaN(packSize) && packSize > 0) {
            // USD supplier: convert to CAD first, then divide by pack size
            // CAD supplier: divide by pack size directly
            const unitCost = isUsd ? (packCost * exchangeRate) / packSize : packCost / packSize;
            setNewPart(prev => ({ ...prev, cost: unitCost.toFixed(4) }));
        } else {
            setNewPart(prev => ({ ...prev, cost: "" }));
        }
    }, [newPart.is_pack, newPart.cost_per_pack, newPart.pack_size, newPart.supplier, suppliers, exchangeRate]);

    // Calculate sales price when cost or markup changes (non-assembly only)
    useEffect(() => {
        if (newPart.is_assembly) return;
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
    }, [newPart.cost, newPart.markup_percentage, newPart.is_assembly]);

    // Calculate NonSA price when sales price or category changes
    useEffect(() => {
        if (newPart.sales_price && newPart.category) {
            const category = categories.find(c => c.name === newPart.category);
            const salesPrice = parseFloat(newPart.sales_price);
            const nonsaMarkup = category?.nonsa_markup_percentage || 0;
            
            if (!isNaN(salesPrice)) {
                const nonsaPrice = salesPrice * (1 + nonsaMarkup / 100);
                setNewPart(prev => ({ ...prev, nonsa_price: nonsaPrice.toFixed(2) }));
            }
        }
    }, [newPart.sales_price, newPart.category, categories]);

    const handleFixSupplierName = async () => {
        setLoading(true);
        setError("");
        setSuccessMessage("Searching for parts from 'Automation direct'...");
        try {
            const partsToUpdate = await Part.filter({ supplier: "Automation direct" });

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
        setError("");

        // If editing an existing (non-assembly) part and the stock count was changed by
        // hand here, warn before saving — this bypasses PO receipts / builds / inventory
        // counts and gets logged to the audit trail under the current user's name.
        // (Assemblies are excluded: their "Assembled Stock" field always initializes to "0"
        // when the edit dialog opens regardless of the real value, so comparing against it
        // would falsely flag every assembly edit as a manual quantity change.)
        if (editingPart && !editingPart.is_assembly) {
            const oldQty = editingPart.quantity_in_inventory ?? 0;
            const newQty = newPart.quantity_in_inventory !== "" ? parseInt(newPart.quantity_in_inventory, 10) : 0;
            if (!isNaN(newQty) && newQty !== oldQty) {
                setPendingQuantityChange({
                    partId: editingPart.id,
                    partName: newPart.part_name,
                    oldQty,
                    newQty
                });
                setShowQuantityWarning(true);
                return;
            }
        }

        await performSavePart();
    };

    const performSavePart = async () => {
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
            const parsedMarkup = newPart.is_assembly ? null : (newPart.markup_percentage !== "" ? parseFloat(newPart.markup_percentage) : 50);
            const parsedSalesPrice = newPart.sales_price !== "" ? parseFloat(newPart.sales_price) : null;
            const parsedNonsaPrice = newPart.nonsa_price !== "" ? parseFloat(newPart.nonsa_price) : null;
            const parsedQuantity = newPart.quantity_in_inventory !== "" ? parseInt(newPart.quantity_in_inventory) : 0;
            const parsedReorderLevel = newPart.reorder_level !== "" ? parseInt(newPart.reorder_level) : 10;
            const parsedLaborCost = newPart.assembly_labor_cost !== "" ? parseFloat(newPart.assembly_labor_cost) : 0;
            const parsedPackSize = newPart.is_pack && newPart.pack_size !== "" ? parseFloat(newPart.pack_size) : null;
            const parsedCostPerPack = newPart.is_pack && newPart.cost_per_pack !== "" ? parseFloat(newPart.cost_per_pack) : null;

            const partData = {
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
                assembly_labor_cost: newPart.is_assembly ? parsedLaborCost : null,
                is_obsolete: newPart.is_obsolete,
                is_internal: newPart.is_internal || false,
                is_pack: newPart.is_pack || false,
                pack_size: parsedPackSize,
                cost_per_pack: parsedCostPerPack
            };

            let savedPartId;

            if (editingPart) {
                await Part.update(editingPart.id, partData);
                savedPartId = editingPart.id;

                // Update assembly components
                if (newPart.is_assembly) {
                    // Delete existing components
                    const existingComponents = await AssemblyComponent.filter({ assembly_part_id: editingPart.id });
                    await Promise.all(existingComponents.map(c => AssemblyComponent.delete(c.id)));
                    
                    // Create new components
                    if (assemblyComponents.length > 0) {
                        await AssemblyComponent.bulkCreate(
                            assemblyComponents.map(comp => ({
                                assembly_part_id: editingPart.id,
                                component_part_id: comp.component_part_id,
                                quantity_required: comp.quantity_required
                            }))
                        );
                    }
                }

                // Log manual inventory adjustment to the audit trail, if the stock count was hand-edited here
                if (pendingQuantityChange) {
                    try {
                        await invokeApi('inventoryAudit', {
                            part_id: pendingQuantityChange.partId,
                            change_type: 'adjustment',
                            quantity_before: pendingQuantityChange.oldQty,
                            quantity_change: pendingQuantityChange.newQty - pendingQuantityChange.oldQty,
                            quantity_after: pendingQuantityChange.newQty,
                            reference_type: 'manual_edit',
                            notes: 'Manually changed from the part detail/edit page (not a PO receipt, build, or inventory count).'
                        });
                    } catch (auditErr) {
                        console.error('Failed to log inventory audit record for manual edit:', auditErr);
                    }
                    setPendingQuantityChange(null);
                }

                setSuccessMessage("Part successfully updated!");
            } else {
                const newPartRecord = await Part.create(partData);
                savedPartId = newPartRecord.id;

                // Create assembly components
                if (newPart.is_assembly && assemblyComponents.length > 0) {
                    await AssemblyComponent.bulkCreate(
                        assemblyComponents.map(comp => ({
                            assembly_part_id: savedPartId,
                            component_part_id: comp.component_part_id,
                            quantity_required: comp.quantity_required
                        }))
                    );
                }

                setSuccessMessage("Part successfully created!");
            }
            
            setIsDialogOpen(false);
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
            assembly_labor_cost: part.assembly_labor_cost?.toString() || "",
            is_obsolete: part.is_obsolete || false,
            is_internal: part.is_internal || false,
            is_pack: part.is_pack || false,
            pack_size: part.pack_size?.toString() || "1",
            cost_per_pack: part.cost_per_pack?.toString() || ""
        });

        // Load assembly components if it's an assembly
        if (part.is_assembly) {
            try {
                const components = await AssemblyComponent.filter({ assembly_part_id: part.id });
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
                "quantity_in_inventory", "reorder_level", "category", "compatible_machine_types", "description", "is_assembly", "assembly_labor_cost" // Added is_assembly and assembly_labor_cost
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
                            case "assembly_labor_cost": // Added assembly_labor_cost
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
                            case "is_assembly": // Added is_assembly
                                partData[header] = value.toLowerCase() === 'true' || value === '1';
                                break;
                            default:
                                break;
                        }
                    });

                    const supplierNameFromCSV = partData.supplier;
                    const selectedSupplierFromCSV = suppliers.find(s => s.name === supplierNameFromCSV);

                    // Assembly parts don't need quantity, cost_usd, or cost validation here
                    if (!partData.is_assembly) {
                        if (!partData.part_name || !partData.part_number || partData.quantity_in_inventory === null || partData.quantity_in_inventory === "") {
                            newErrors.push(`Row ${i + 1} (Part Number: ${partData.part_number || 'N/A'}): Missing required fields (Part Name, Part Number, Quantity). Skipping.`);
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
                    } else { // For assemblies, only part name and number are strictly required
                        if (!partData.part_name || !partData.part_number) {
                            newErrors.push(`Row ${i + 1} (Part Number: ${partData.part_number || 'N/A'}): Missing required fields (Part Name, Part Number) for assembly. Skipping.`);
                            continue;
                        }
                    }
                    
                    if (selectedSupplierFromCSV?.is_usd && partData.cost_usd !== null && !partData.is_assembly) { // Only calculate for non-assembly USD parts
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
                        quantity_in_inventory: partData.is_assembly ? 0 : (partData.quantity_in_inventory ?? null), // Set to 0 for assemblies
                        reorder_level: partData.reorder_level ?? 10,
                        category: partData.category || (categories.length > 0 ? categories[0].name : "uncategorized"),
                        compatible_machine_types: partData.compatible_machine_types || [],
                        description: partData.description || "",
                        is_assembly: partData.is_assembly,
                        assembly_labor_cost: partData.is_assembly ? (partData.assembly_labor_cost ?? 0) : null // Only for assemblies
                    };
                    
                    const existingPart = existingPartsByNumber[partData.part_number];
                    if (existingPart) {
                        // Prevent updating 'is_assembly' via import for now, or require a clear strategy for components
                        if (existingPart.is_assembly !== finalPartData.is_assembly) {
                             newErrors.push(`Row ${i + 1} (Part Number: ${partData.part_number}): Cannot change 'is_assembly' status via import. Skipping update for this field.`);
                             delete finalPartData.is_assembly; // Remove the field to prevent it from being updated
                        }
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
                        await Part.bulkCreate(batch);
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

    const checkPartUsage = async (partId) => {
        const warnings = [];
        
        try {
            // Check if part is used in any assemblies as a component
            const assemblyUsage = await AssemblyComponent.filter({ component_part_id: partId });
            if (assemblyUsage.length > 0) {
                const assemblyNames = assemblyUsage.map(comp => {
                    const assembly = parts.find(p => p.id === comp.assembly_part_id);
                    return assembly ? assembly.part_name : 'Unknown Assembly';
                }).join(', ');
                warnings.push(`This part is used in ${assemblyUsage.length} assembly/assemblies: ${assemblyNames}`);
            }

            // Check if this part is an assembly with components
            const partBeingDeleted = parts.find(p => p.id === partId);
            if (partBeingDeleted?.is_assembly) {
                const components = await AssemblyComponent.filter({ assembly_part_id: partId });
                if (components.length > 0) {
                    warnings.push(`This assembly contains ${components.length} component(s) which will also be removed.`);
                }
            }

            // Check if part has transaction history
            const transactions = await Transaction.filter({ part_id: partId });
            if (transactions.length > 0) {
                warnings.push(`This part has ${transactions.length} transaction record(s) in the system.`);
            }

            // Check if part is in any active purchase orders
            const poItems = await PurchaseOrderItem.filter({ part_id: partId });
            if (poItems.length > 0) {
                warnings.push(`This part appears in ${poItems.length} purchase order item(s).`);
            }

        } catch (e) {
            console.error("Error checking part usage:", e);
        }

        return warnings;
    };

    const handleDeleteClick = async () => {
        if (!editingPart) return;
        
        const warnings = await checkPartUsage(editingPart.id);
        setDeleteWarnings(warnings);
        setPartToDelete(editingPart);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!partToDelete) return;

        try {
            // Delete assembly components if this is an assembly
            if (partToDelete.is_assembly) {
                const components = await AssemblyComponent.filter({ assembly_part_id: partToDelete.id });
                await Promise.all(components.map(c => AssemblyComponent.delete(c.id)));
            }

            // Delete the part
            await Part.delete(partToDelete.id);
            
            setSuccessMessage(`Part "${partToDelete.part_name}" deleted successfully!`);
            setIsDialogOpen(false); // Close edit dialog
            setIsDeleteDialogOpen(false); // Close delete confirmation dialog
            setEditingPart(null);
            setPartToDelete(null);
            setDeleteWarnings([]);
            
            await loadPartsAndCategories();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setError(`Failed to delete part: ${e.message || 'Unknown error'}`);
            console.error(e);
        }
    };

    const handleBuildAssembly = (part) => {
        setBuildingPart(part);
        setBuildQuantity(1);
        setBuildError("");
        setIsBuildDialogOpen(true);
    };

    const handleConfirmBuild = async () => {
        if (!buildingPart || buildQuantity < 1) return;
        
        setIsBuilding(true);
        setBuildError("");
        
        try {
            const qty = parseInt(buildQuantity);
            
            // Check if we have enough components
            if (buildingPart.can_build < qty) {
                throw new Error(`Cannot build ${qty} units. Only ${buildingPart.can_build} can be built from available components.`);
            }
            
            // Use the deductInventory backend function to avoid stale-read race conditions
            const response = await invokeApi('deductInventory', {
                parts: [{ part_id: buildingPart.id, quantity: qty }]
            });

            if (response.data?.error) {
                throw new Error(response.data.error);
            }

            // Add built assemblies to inventory (fresh read first)
            const freshAssembly = await Part.get(buildingPart.id);
            const newAssemblyStock = (freshAssembly?.quantity_in_inventory || 0) + qty;
            await Part.update(buildingPart.id, { quantity_in_inventory: newAssemblyStock });
            
            setSuccessMessage(`Successfully built ${qty} unit(s) of ${buildingPart.part_name}!`);
            setIsBuildDialogOpen(false);
            await loadPartsAndCategories();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (e) {
            setBuildError(e.message || "Failed to build assembly.");
        } finally {
            setIsBuilding(false);
        }
    };

    const handleAddToCart = (part) => {
        setCartItems(prevItems => {
            const existingIndex = prevItems.findIndex(item => item.partId === part.id);
            if (existingIndex >= 0) {
                // Remove from cart if already in
                return prevItems.filter(item => item.partId !== part.id);
            } else {
                // Add to cart
                return [...prevItems, { partId: part.id, quantity: 1 }];
            }
        });
    };

    const handleRemoveFromCart = (partId) => {
        setCartItems(prevItems => prevItems.filter(item => item.partId !== partId));
    };

    const handleUpdateCartQuantity = (partId, quantity) => {
        setCartItems(prevItems => 
            prevItems.map(item => 
                item.partId === partId ? { ...item, quantity } : item
            )
        );
    };

    const handleClearCart = () => {
        setCartItems([]);
        setIsCartOpen(false);
    };

    const handleToggleFavorite = async (part) => {
        const newFav = !part.is_favorite;
        // Optimistic update — no full reload needed
        setParts(prev => prev.map(p => p.id === part.id 
            ? { ...p, is_favorite: newFav, is_any_favorite: newFav || p.is_auto_favorite } 
            : p
        ));
        try {
            await Part.update(part.id, { is_favorite: newFav });
        } catch (e) {
            console.error("Failed to toggle favorite:", e);
            // Revert on failure
            setParts(prev => prev.map(p => p.id === part.id 
                ? { ...p, is_favorite: part.is_favorite, is_any_favorite: part.is_any_favorite } 
                : p
            ));
        }
    };

    const handlePrintAssemblyComponents = () => {
        if (!editingPart || !editingPart.is_assembly) return;
        setShowAssemblyPrint(true);
        setTimeout(() => {
            window.print();
            setShowAssemblyPrint(false);
        }, 100);
    };

    const getStockStatus = (part) => {
        // For assemblies, consider buildable quantity in addition to stock
        const effectiveStock = part.is_assembly 
            ? (part.quantity_in_inventory || 0) + (part.can_build || 0)
            : part.quantity_in_inventory;

        if (effectiveStock === 0) {
            if (part.on_order > 0) {
                return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Backordered</Badge>;
            }
            return <Badge variant="destructive">Out of Stock</Badge>;
        }
        if (part.reorder_level !== null && part.reorder_level !== undefined && part.reorder_level >= 0 && effectiveStock <= part.reorder_level) {
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
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button
                            variant="outline"
                            className="relative w-full sm:w-auto bg-blue-50 hover:bg-blue-100"
                            onClick={() => setIsCartOpen(true)}
                        >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Part Cart
                            {cartItems.length > 0 && (
                                <Badge className="ml-2 bg-blue-600">{cartItems.length}</Badge>
                            )}
                        </Button>
                        <div className="flex items-center space-x-2 border p-2 rounded-md bg-red-50">
                            <Checkbox id="showObsolete" checked={showObsolete} onCheckedChange={setShowObsolete} />
                            <Label htmlFor="showObsolete" className="cursor-pointer text-sm text-slate-600">Show Obsolete</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-2 rounded-md bg-yellow-50">
                            <Checkbox id="showFavoritesOnly" checked={showFavoritesOnly} onCheckedChange={(val) => {
                                setShowFavoritesOnly(val);
                                sessionStorage.setItem('parts_showFavoritesOnly', String(val));
                            }} />
                            <Label htmlFor="showFavoritesOnly" className="cursor-pointer text-sm text-yellow-700 flex items-center gap-1">
                                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                Favorites Only
                            </Label>
                        </div>

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
                                    assembly_labor_cost: "",
                                    is_internal: false,
                                    is_pack: false,
                                    pack_size: "1",
                                    cost_per_pack: ""
                                });
                                setError("");
                                setShowQuantityWarning(false);
                                setPendingQuantityChange(null);
                            } else if (!editingPart) {
                                if (categories.length > 0) {
                                    setNewPart(prev => ({ ...prev, category: categories[0].name }));
                                }
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Add Part</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingPart ? 'Edit Part' : 'Add New Part'}
                                    </DialogTitle>
                                </DialogHeader>
                                {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                                <form onSubmit={handleSavePart} className="space-y-4 pt-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1 flex items-center space-x-2 p-3 border rounded-lg bg-blue-50">
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
                                                Assembly/Kit
                                            </Label>
                                        </div>
                                        <div className="flex-1 flex items-center space-x-2 p-3 border rounded-lg bg-red-50">
                                            <Checkbox
                                                id="is_obsolete"
                                                checked={newPart.is_obsolete}
                                                onCheckedChange={(checked) => setNewPart({...newPart, is_obsolete: checked})}
                                            />
                                            <Label htmlFor="is_obsolete" className="cursor-pointer font-semibold text-red-700">
                                                Obsolete / Discontinued
                                            </Label>
                                        </div>
                                        <div className="flex-1 flex items-center space-x-2 p-3 border rounded-lg bg-orange-50">
                                            <Checkbox
                                                id="is_internal"
                                                checked={newPart.is_internal}
                                                onCheckedChange={(checked) => setNewPart({...newPart, is_internal: checked})}
                                            />
                                            <div>
                                                <Label htmlFor="is_internal" className="cursor-pointer font-semibold text-orange-700">
                                                    Internal Component
                                                </Label>
                                                <p className="text-xs text-orange-600 mt-0.5">Not sold directly — used as a step in producing another part</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex items-center space-x-2 p-3 border rounded-lg bg-purple-50">
                                            <Checkbox
                                                id="is_pack"
                                                checked={newPart.is_pack}
                                                onCheckedChange={(checked) => setNewPart({
                                                    ...newPart,
                                                    is_pack: checked,
                                                    pack_size: checked ? (newPart.pack_size || "2") : "1",
                                                    cost_per_pack: checked ? newPart.cost_per_pack : "",
                                                    cost: checked ? "" : newPart.cost
                                                })}
                                            />
                                            <div>
                                                <Label htmlFor="is_pack" className="cursor-pointer font-semibold text-purple-700">
                                                    Purchased in Pack
                                                </Label>
                                                <p className="text-xs text-purple-600 mt-0.5">Ordered in packs, sold as individual units</p>
                                            </div>
                                        </div>
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
                                                        {categories.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
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
                                                    {categories.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
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
                                            {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map((type) => (
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

                                    {!newPart.is_assembly && !newPart.is_pack && (
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

                                    {!newPart.is_assembly && newPart.is_pack && (() => {
                                        const packSupplierIsUsd = suppliers.find(s => s.name === newPart.supplier)?.is_usd;
                                        return (
                                        <div className="p-4 border rounded-lg bg-purple-50 space-y-3">
                                            <h4 className="font-semibold text-purple-800 text-sm">Pack Pricing</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label htmlFor="cost_per_pack">Cost per Pack ({packSupplierIsUsd ? 'USD' : 'CAD'}) *</Label>
                                                    <Input id="cost_per_pack" type="number" step="0.01" value={newPart.cost_per_pack}
                                                        onChange={(e) => setNewPart({...newPart, cost_per_pack: e.target.value})}
                                                        required placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="pack_size">Units per Pack *</Label>
                                                    <Input id="pack_size" type="number" min="2" step="1" value={newPart.pack_size}
                                                        onChange={(e) => setNewPart({...newPart, pack_size: e.target.value})}
                                                        required placeholder="e.g. 10"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label htmlFor="cost">Unit Cost (CAD) — Auto-calculated</Label>
                                                <Input id="cost" type="number" step="0.0001" value={newPart.cost} readOnly className="bg-white font-semibold" />
                                                <p className="text-xs text-purple-600 mt-1">
                                                    {packSupplierIsUsd
                                                        ? `= Cost per Pack (USD) × exchange rate (${exchangeRate}) ÷ Units per Pack`
                                                        : '= Cost per Pack ÷ Units per Pack'
                                                    }. Sales price is calculated from this unit cost using the markup below.
                                                </p>
                                            </div>
                                        </div>
                                        );
                                    })()}

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

                                    {!newPart.is_internal && (!newPart.is_assembly ? (
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
                                                <Label htmlFor="nonsa_price">NonSA Price (Auto-calculated)</Label>
                                                <Input id="nonsa_price" type="number" step="0.01" value={newPart.nonsa_price} readOnly className="bg-gray-100" />
                                                <p className="text-xs text-gray-500 mt-1">Based on category markup percentage</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="sales_price">Sales Price (Calculated)</Label>
                                                <Input id="sales_price" type="number" step="0.01" value={newPart.sales_price} readOnly className="bg-gray-100 font-semibold" />
                                                <p className="text-xs text-gray-500 mt-1">Sum of component sales prices × qty + labor cost</p>
                                            </div>
                                            <div>
                                                <Label htmlFor="nonsa_price">NonSA Price (Auto-calculated)</Label>
                                                <Input id="nonsa_price" type="number" step="0.01" value={newPart.nonsa_price} readOnly className="bg-gray-100" />
                                                <p className="text-xs text-gray-500 mt-1">Based on category markup percentage</p>
                                            </div>
                                        </div>
                                    ))}

                                    {!newPart.is_assembly && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="quantity_in_inventory">Current Stock *</Label>
                                                <Input id="quantity_in_inventory" type="number" value={newPart.quantity_in_inventory} onChange={(e) => setNewPart({...newPart, quantity_in_inventory: e.target.value})} required />
                                                {newPart.is_pack && <p className="text-xs text-purple-600 mt-1">Track in individual units</p>}
                                            </div>
                                            <div>
                                                <Label htmlFor="reorder_level">Reorder Level</Label>
                                                <Input id="reorder_level" type="number" value={newPart.reorder_level} onChange={(e) => setNewPart({...newPart, reorder_level: e.target.value})} />
                                                {newPart.is_pack && <p className="text-xs text-purple-600 mt-1">In individual units</p>}
                                            </div>
                                        </div>
                                    )}

                                    {newPart.is_assembly && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label htmlFor="quantity_in_inventory">Assembled Stock</Label>
                                                    <Input id="quantity_in_inventory" type="number" value={newPart.quantity_in_inventory} onChange={(e) => setNewPart({...newPart, quantity_in_inventory: e.target.value})} />
                                                </div>
                                                <div>
                                                    <Label htmlFor="reorder_level">Reorder Level</Label>
                                                    <Input id="reorder_level" type="number" value={newPart.reorder_level} onChange={(e) => setNewPart({...newPart, reorder_level: e.target.value})} />
                                                </div>
                                            </div>
                                            <div className="p-3 border rounded-lg bg-blue-50">
                                                <p className="text-xs text-gray-600">Track actual assembled units in stock. Use the "Build Assembly" button on the parts list to create assemblies from components.</p>
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea id="description" value={newPart.description} onChange={(e) => setNewPart({...newPart, description: e.target.value})} />
                                    </div>

                                    <div className="flex gap-2">
                                        <Button type="submit" disabled={isSubmitting} className="flex-1">
                                            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : (editingPart ? "Update Part" : "Save Part")}
                                        </Button>
                                        {editingPart && editingPart.is_assembly && assemblyComponents.length > 0 && (
                                            <Button 
                                                type="button"
                                                variant="outline" 
                                                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                                onClick={handlePrintAssemblyComponents}
                                            >
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {editingPart && (
                                        <Button 
                                            type="button"
                                            variant="outline" 
                                            className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={handleDeleteClick}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Part
                                        </Button>
                                    )}
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
                                {categories.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
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
                    <div className="flex items-center gap-2">
                         <Filter className="h-5 w-5 text-muted-foreground"/>
                         <Select value={machineTypeFilter} onValueChange={setMachineTypeFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Machine Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Machine Types</SelectItem>
                                {machineTypes.sort((a, b) => a.name.localeCompare(b.name)).map(mt => (
                                    <SelectItem key={mt.id} value={mt.name}>{mt.name}</SelectItem>
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
                                   <PartCard 
                                       key={part.id} 
                                       part={part} 
                                       onEdit={handleEditPart} 
                                       onBuild={handleBuildAssembly}
                                       onAddToCart={handleAddToCart}
                                       isInCart={cartItems.some(item => item.partId === part.id)}
                                       onToggleFavorite={handleToggleFavorite}
                                       isFavorite={part.is_any_favorite}
                                   />
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
                                            <TableHead className="w-12"></TableHead>
                                            <TableHead 
                                                className="cursor-pointer hover:bg-gray-100 select-none"
                                                onClick={() => {
                                                    if (sortColumn === 'part_name') {
                                                        setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                                    } else {
                                                        setSortColumn('part_name');
                                                        setSortDirection('desc');
                                                    }
                                                }}
                                            >
                                                Part Name {sortColumn === 'part_name' && (sortDirection === 'desc' ? '▼' : '▲')}
                                            </TableHead>
                                            <TableHead 
                                                className="cursor-pointer hover:bg-gray-100 select-none"
                                                onClick={() => {
                                                    if (sortColumn === 'part_number') {
                                                        setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                                    } else {
                                                        setSortColumn('part_number');
                                                        setSortDirection('desc');
                                                    }
                                                }}
                                            >
                                                Part Number {sortColumn === 'part_number' && (sortDirection === 'desc' ? '▼' : '▲')}
                                            </TableHead>
                                            <TableHead 
                                                className="cursor-pointer hover:bg-gray-100 select-none"
                                                onClick={() => {
                                                    if (sortColumn === 'supplier') {
                                                        setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                                    } else {
                                                        setSortColumn('supplier');
                                                        setSortDirection('desc');
                                                    }
                                                }}
                                            >
                                                Supplier {sortColumn === 'supplier' && (sortDirection === 'desc' ? '▼' : '▲')}
                                            </TableHead>
                                            <TableHead 
                                                className="cursor-pointer hover:bg-gray-100 select-none"
                                                onClick={() => {
                                                    if (sortColumn === 'category') {
                                                        setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                                    } else {
                                                        setSortColumn('category');
                                                        setSortDirection('desc');
                                                    }
                                                }}
                                            >
                                                Category {sortColumn === 'category' && (sortDirection === 'desc' ? '▼' : '▲')}
                                            </TableHead>
                                            <TableHead 
                                                className="text-right cursor-pointer hover:bg-gray-100 select-none"
                                                onClick={() => {
                                                    if (sortColumn === 'cost') {
                                                        setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                                    } else {
                                                        setSortColumn('cost');
                                                        setSortDirection('desc');
                                                    }
                                                }}
                                            >
                                                Cost (CAD) {sortColumn === 'cost' && (sortDirection === 'desc' ? '▼' : '▲')}
                                            </TableHead>
                                            <TableHead 
                                                className="text-right cursor-pointer hover:bg-gray-100 select-none"
                                                onClick={() => {
                                                    if (sortColumn === 'sales_price') {
                                                        setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                                    } else {
                                                        setSortColumn('sales_price');
                                                        setSortDirection('desc');
                                                    }
                                                }}
                                            >
                                                Sales Price {sortColumn === 'sales_price' && (sortDirection === 'desc' ? '▼' : '▲')}
                                            </TableHead>
                                            <TableHead 
                                                className="text-center cursor-pointer hover:bg-gray-100 select-none"
                                                onClick={() => {
                                                    if (sortColumn === 'quantity_in_inventory') {
                                                        setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                                                    } else {
                                                        setSortColumn('quantity_in_inventory');
                                                        setSortDirection('desc');
                                                    }
                                                }}
                                            >
                                                Stock {sortColumn === 'quantity_in_inventory' && (sortDirection === 'desc' ? '▼' : '▲')}
                                            </TableHead>
                                            <TableHead className="text-center">On Order</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredParts.length > 0 ? filteredParts.map(part => (
                                            <TableRow key={part.id}>
                                                <TableCell>
                                                   <div className="flex gap-1">
                                                       <Button 
                                                           variant="ghost" 
                                                           size="icon"
                                                           onClick={() => handleToggleFavorite(part)}
                                                           className={`h-8 w-8 ${part.is_any_favorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                                                           title={part.is_any_favorite ? 'Remove from favorites' : 'Add to favorites'}
                                                       >
                                                           <Star className={`h-4 w-4 ${part.is_any_favorite ? 'fill-yellow-500' : ''}`} />
                                                       </Button>
                                                       {!part.is_internal && (
                                                           <Checkbox 
                                                               checked={cartItems.some(item => item.partId === part.id)}
                                                               onCheckedChange={() => handleAddToCart(part)}
                                                               className="h-5 w-5"
                                                           />
                                                       )}
                                                   </div>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {part.part_name}
                                                    {part.is_assembly && <Badge className="ml-2" variant="secondary">Assembly</Badge>}
                                                    {part.is_internal && <Badge className="ml-2 bg-orange-100 text-orange-800" variant="secondary">Internal</Badge>}
                                                </TableCell>
                                                <TableCell>{part.part_number}</TableCell>
                                                <TableCell>{part.supplier || 'N/A'}</TableCell>
                                                <TableCell><Badge variant="outline">{part.category}</Badge></TableCell>
                                                <TableCell className="text-right">{part.is_internal ? <span className="text-orange-500 text-xs italic">Internal</span> : `$${part.cost?.toFixed(2) || '0.00'}`}</TableCell>
                                                <TableCell className="text-right font-semibold">{part.is_internal ? '—' : `$${part.sales_price?.toFixed(2) || '0.00'}`}</TableCell>
                                                <TableCell className="text-center">
                                                    {part.is_assembly ? (
                                                        <div className="space-y-1">
                                                            <div className="font-medium">{part.quantity_in_inventory}</div>
                                                            <div className="text-xs text-blue-600">+{part.can_build} buildable</div>
                                                        </div>
                                                    ) : (
                                                        part.quantity_in_inventory
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {part.on_order > 0 ? (
                                                        <span className="text-blue-600 font-medium">{part.on_order}</span>
                                                    ) : (
                                                        <span className="text-gray-400">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {part.is_obsolete ? <Badge variant="secondary" className="bg-red-100 text-red-800">Obsolete</Badge> : getStockStatus(part)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditPart(part)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        {part.is_assembly && part.can_build > 0 && (
                                                            <Button variant="ghost" size="sm" onClick={() => handleBuildAssembly(part)} title="Build Assembly">
                                                                <Wrench className="h-4 w-4 text-blue-600" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan="11" className="text-center py-12 text-gray-500">
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

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                            Delete Part: {partToDelete?.part_name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-3">
                                <p className="font-semibold">This action cannot be undone. This will permanently delete this part from your inventory.</p>
                                
                                {deleteWarnings.length > 0 && (
                                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                        <p className="font-semibold text-yellow-800 mb-2">⚠️ Warning:</p>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                                            {deleteWarnings.map((warning, index) => (
                                                <li key={index}>{warning}</li>
                                            ))}
                                        </ul>
                                        <p className="mt-3 text-sm text-yellow-800 font-medium">
                                            Transaction history and purchase orders will remain in the system for record-keeping, but this part will no longer be available for new orders or services.
                                        </p>
                                    </div>
                                )}

                                <p className="mt-4 text-sm text-gray-600">
                                    Are you sure you want to delete <span className="font-semibold">"{partToDelete?.part_name}" ({partToDelete?.part_number})</span>?
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setIsDeleteDialogOpen(false);
                            setPartToDelete(null);
                            setDeleteWarnings([]);
                        }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDeleteConfirm}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            Delete Part
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={isBuildDialogOpen} onOpenChange={setIsBuildDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-blue-500" />
                            Build Assembly: {buildingPart?.part_name}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-3 pt-2">
                                {buildError && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>{buildError}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="p-3 bg-gray-50 rounded-md space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Current Stock:</span>
                                        <span className="font-semibold">{buildingPart?.quantity_in_inventory || 0} units</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Can Build from Components:</span>
                                        <span className="font-semibold text-blue-600">{buildingPart?.can_build || 0} units</span>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="build_quantity">Quantity to Build</Label>
                                    <Input
                                        id="build_quantity"
                                        type="number"
                                        min="1"
                                        max={buildingPart?.can_build || 0}
                                        value={buildQuantity}
                                        onChange={(e) => setBuildQuantity(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>

                                <p className="text-sm text-gray-600">
                                    This will deduct the required components from inventory and add {buildQuantity} assembled unit(s) to stock.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setIsBuildDialogOpen(false);
                            setBuildingPart(null);
                            setBuildQuantity(1);
                            setBuildError("");
                        }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirmBuild}
                            disabled={isBuilding || buildQuantity < 1 || buildQuantity > (buildingPart?.can_build || 0)}
                            className="bg-blue-600 hover:bg-blue-700 focus:ring-blue-600"
                        >
                            {isBuilding ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Building...
                                </>
                            ) : (
                                <>Build Assembly</>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={showQuantityWarning} onOpenChange={(open) => {
                    if (!open) {
                        setShowQuantityWarning(false);
                        setPendingQuantityChange(null);
                    }
                }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="h-5 w-5" />
                                Manual Inventory Change
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-700">
                                        You're changing the stock count for{' '}
                                        <span className="font-semibold">{pendingQuantityChange?.partName}</span> from{' '}
                                        <span className="font-semibold">{pendingQuantityChange?.oldQty}</span> to{' '}
                                        <span className="font-semibold">{pendingQuantityChange?.newQty}</span> directly on this page.
                                    </p>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                        <p className="font-semibold text-amber-800 text-sm">
                                            You should not normally change stock counts here.
                                        </p>
                                        <p className="text-amber-800 mt-1 text-sm">
                                            Inventory counts should come from Purchase Order receipts, Builds, or an Inventory Count instead — those keep a proper record of why the count changed.
                                        </p>
                                    </div>
                                    <p className="text-sm text-gray-700">
                                        If you continue, this change will be recorded in the inventory audit log{user?.full_name || user?.email ? <> as made by <span className="font-semibold">{user.full_name || user.email}</span></> : null}.
                                    </p>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {
                                setShowQuantityWarning(false);
                                setPendingQuantityChange(null);
                            }}>
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async () => {
                                    setShowQuantityWarning(false);
                                    await performSavePart();
                                }}
                                className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
                            >
                                Yes, Make This Change
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <PartsCartModal
                    isOpen={isCartOpen}
                    onOpenChange={setIsCartOpen}
                    cartItems={cartItems}
                    onRemoveItem={handleRemoveFromCart}
                    onUpdateQuantity={handleUpdateCartQuantity}
                    onClearCart={handleClearCart}
                    parts={parts}
                />

                {showAssemblyPrint && editingPart && (
                    <AssemblyPrintLayout
                        assemblyPart={editingPart}
                        components={assemblyComponents}
                        parts={parts}
                    />
                )}
                </Card>
                );
                }