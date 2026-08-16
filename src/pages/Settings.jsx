import React, { useState, useEffect } from 'react';
import { Category, Setting } from '@/api/entities';
import { clearTimezoneCache } from '@/components/utils/timezoneUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Settings as SettingsIcon, Plus, X, GripVertical, ArrowUpDown, DollarSign, Package, Star, Grid, Clock } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

const SORT_OPTIONS = {
    parts: [
        { label: 'Part Name (A-Z)', value: 'part_name_asc' },
        { label: 'Part Name (Z-A)', value: 'part_name_desc' },
        { label: 'Part Number (A-Z)', value: 'part_number_asc' },
        { label: 'Part Number (Z-A)', value: 'part_number_desc' },
        { label: 'Category (A-Z)', value: 'category_asc' },
        { label: 'Stock (Low to High)', value: 'quantity_in_inventory_asc' },
        { label: 'Stock (High to Low)', value: 'quantity_in_inventory_desc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ],
    customers: [
        { label: 'Company Name (A-Z)', value: 'company_name_asc' },
        { label: 'Company Name (Z-A)', value: 'company_name_desc' },
        { label: 'Identifier (A-Z)', value: 'customer_identifier_asc' },
        { label: 'Contact Person (A-Z)', value: 'contact_person_asc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ],
    technicians: [
        { label: 'Name (A-Z)', value: 'full_name_asc' },
        { label: 'Name (Z-A)', value: 'full_name_desc' },
        { label: 'Code (A-Z)', value: 'technician_code_asc' },
        { label: 'Department (A-Z)', value: 'department_asc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ],
    tickets: [
        { label: 'Ticket Number (New to Old)', value: 'ticket_number_desc' },
        { label: 'Ticket Number (Old to New)', value: 'ticket_number_asc' },
        { label: 'Subject (A-Z)', value: 'subject_asc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' },
        { label: 'Status', value: 'status_asc' },
        { label: 'Urgency (High to Low)', value: 'urgency_desc' }
    ],
    categories: [
        { label: 'Name (A-Z)', value: 'name_asc' },
        { label: 'Name (Z-A)', value: 'name_desc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ],
    machines: [
        { label: 'Customer (A-Z)', value: 'customer_name_asc' },
        { label: 'Customer (Z-A)', value: 'customer_name_desc' },
        { label: 'Model (A-Z)', value: 'model_asc' },
        { label: 'Model (Z-A)', value: 'model_desc' },
        { label: 'Serial Number (A-Z)', value: 'serial_number_asc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ],
    suppliers: [
        { label: 'Name (A-Z)', value: 'name_asc' },
        { label: 'Name (Z-A)', value: 'name_desc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ],
    purchaseOrders: [
        { label: 'PO Number (New to Old)', value: 'po_number_desc' },
        { label: 'PO Number (Old to New)', value: 'po_number_asc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ],
    maintenanceChecklists: [
        { label: 'Checklist Number (New to Old)', value: 'checklist_number_desc' },
        { label: 'Checklist Number (Old to New)', value: 'checklist_number_asc' },
        { label: 'Newest First', value: 'created_date_desc' },
        { label: 'Oldest First', value: 'created_date_asc' }
    ]
};

export default function SettingsPage() {
    const [exchangeRate, setExchangeRate] = useState('');
    const [settingId, setSettingId] = useState(null);
    const [categories, setCategories] = useState([]);
    const [paymentTypes, setPaymentTypes] = useState([]);
    const [shippingMethods, setShippingMethods] = useState([]);
    const [sortSettings, setSortSettings] = useState({});
    const [partsDefaultFavorites, setPartsDefaultFavorites] = useState(false);
    const [partsDefaultListView, setPartsDefaultListView] = useState(false);
    const [techHideInactive, setTechHideInactive] = useState(true);
    const [techHideInactiveFromLists, setTechHideInactiveFromLists] = useState(true);
    const [timezone, setTimezone] = useState('America/Halifax');
    const [newPaymentType, setNewPaymentType] = useState('');
    const [newShippingMethod, setNewShippingMethod] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState({ message: '', type: '' });

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const [rateSetting, categoryData, paymentTypesSetting, shippingMethodsSetting, sortSettingsData, partsViewSettings, timezoneSetting, techDisplaySettings] = await Promise.all([
                    Setting.filter({ key: 'usd_cad_exchange_rate' }),
                    Category.list(),
                    Setting.filter({ key: 'payment_types' }),
                    Setting.filter({ key: 'shipping_methods' }),
                    Setting.filter({ key: 'default_sort_settings' }),
                    Setting.filter({ key: 'parts_view_defaults' }),
                    Setting.filter({ key: 'timezone' }),
                    Setting.filter({ key: 'technician_display_defaults' })
                ]);
                
                if (rateSetting && rateSetting.length > 0) {
                    setExchangeRate(rateSetting[0].value);
                    setSettingId(rateSetting[0].id);
                } else {
                    const newSetting = await Setting.create({ key: 'usd_cad_exchange_rate', value: '1.35' });
                    setExchangeRate(newSetting.value);
                    setSettingId(newSetting.id);
                    setStatus({ message: 'Default exchange rate setting created.', type: 'info' });
                }
                
                setCategories(categoryData || []);
                
                // Load payment types
                if (paymentTypesSetting && paymentTypesSetting.length > 0) {
                    setPaymentTypes(JSON.parse(paymentTypesSetting[0].value));
                } else {
                    const defaultTypes = ["Credit Card", "Account", "COD", "Net 30", "Online"];
                    await Setting.create({ key: 'payment_types', value: JSON.stringify(defaultTypes) });
                    setPaymentTypes(defaultTypes);
                }
                
                // Load shipping methods
                if (shippingMethodsSetting && shippingMethodsSetting.length > 0) {
                    setShippingMethods(JSON.parse(shippingMethodsSetting[0].value));
                } else {
                    const defaultMethods = ["Express", "Air", "Ground", "Sea"];
                    await Setting.create({ key: 'shipping_methods', value: JSON.stringify(defaultMethods) });
                    setShippingMethods(defaultMethods);
                }
                
                // Load sort settings
                if (sortSettingsData && sortSettingsData.length > 0) {
                    setSortSettings(JSON.parse(sortSettingsData[0].value));
                } else {
                    const defaultSorts = {
                        parts: 'part_name_asc',
                        customers: 'company_name_asc',
                        technicians: 'full_name_asc',
                        tickets: 'created_date_desc',
                        categories: 'name_asc',
                        machines: 'model_asc',
                        suppliers: 'name_asc',
                        purchaseOrders: 'created_date_desc',
                        maintenanceChecklists: 'created_date_desc'
                    };
                    await Setting.create({ key: 'default_sort_settings', value: JSON.stringify(defaultSorts) });
                    setSortSettings(defaultSorts);
                }
                
                // Load parts view defaults
                if (partsViewSettings && partsViewSettings.length > 0) {
                    const settings = JSON.parse(partsViewSettings[0].value);
                    setPartsDefaultFavorites(settings.showFavoritesOnly || false);
                    setPartsDefaultListView(settings.isListView || false);
                } else {
                    const defaults = { showFavoritesOnly: false, isListView: false };
                    await Setting.create({ key: 'parts_view_defaults', value: JSON.stringify(defaults) });
                }
                
                // Load technician display defaults
                if (techDisplaySettings && techDisplaySettings.length > 0) {
                    const settings = JSON.parse(techDisplaySettings[0].value);
                    setTechHideInactive(settings.hideInactive !== false);
                    setTechHideInactiveFromLists(settings.hideInactiveFromLists !== false);
                } else {
                    const defaults = { hideInactive: true, hideInactiveFromLists: true };
                    await Setting.create({ key: 'technician_display_defaults', value: JSON.stringify(defaults) });
                }

                // Load timezone
                if (timezoneSetting && timezoneSetting.length > 0) {
                    setTimezone(timezoneSetting[0].value);
                } else {
                    await Setting.create({ key: 'timezone', value: 'America/Halifax' });
                    setTimezone('America/Halifax');
                }
            } catch (e) {
                setStatus({ message: 'Failed to load settings.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setStatus({ message: '', type: '' });
        if (!exchangeRate || isNaN(parseFloat(exchangeRate))) {
            setStatus({ message: 'Please enter a valid number for the exchange rate.', type: 'error' });
            setIsSaving(false);
            return;
        }

        try {
            await Setting.update(settingId, { value: exchangeRate });
            setStatus({ message: 'Exchange rate updated successfully!', type: 'success' });
        } catch (e) {
            setStatus({ message: `Failed to save: ${e.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setStatus({ message: '', type: '' }), 4000);
        }
    };

    const handleCategoryMarkupChange = (categoryId, value) => {
        setCategories(prev => prev.map(cat => 
            cat.id === categoryId ? { ...cat, nonsa_markup_percentage: parseFloat(value) || 0 } : cat
        ));
    };

    const handleSaveCategoryMarkups = async () => {
        setIsSaving(true);
        setStatus({ message: '', type: '' });
        
        try {
            await Promise.all(
                categories.map(cat => 
                    Category.update(cat.id, { nonsa_markup_percentage: cat.nonsa_markup_percentage || 0 })
                )
            );
            setStatus({ message: 'NonSA markup percentages updated successfully!', type: 'success' });
        } catch (e) {
            setStatus({ message: `Failed to save: ${e.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setStatus({ message: '', type: '' }), 4000);
        }
    };

    const handleAddPaymentType = async () => {
        if (!newPaymentType.trim()) return;
        const updated = [...paymentTypes, newPaymentType.trim()];
        try {
            const setting = await Setting.filter({ key: 'payment_types' });
            await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            setPaymentTypes(updated);
            setNewPaymentType('');
            setStatus({ message: 'Payment type added successfully!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to add payment type: ${e.message}`, type: 'error' });
        }
    };

    const handleRemovePaymentType = async (type) => {
        const updated = paymentTypes.filter(t => t !== type);
        try {
            const setting = await Setting.filter({ key: 'payment_types' });
            await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            setPaymentTypes(updated);
            setStatus({ message: 'Payment type removed successfully!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to remove payment type: ${e.message}`, type: 'error' });
        }
    };

    const handleAddShippingMethod = async () => {
        if (!newShippingMethod.trim()) return;
        const updated = [...shippingMethods, newShippingMethod.trim()];
        try {
            const setting = await Setting.filter({ key: 'shipping_methods' });
            await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            setShippingMethods(updated);
            setNewShippingMethod('');
            setStatus({ message: 'Shipping method added successfully!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to add shipping method: ${e.message}`, type: 'error' });
        }
    };

    const handleRemoveShippingMethod = async (method) => {
        const updated = shippingMethods.filter(m => m !== method);
        try {
            const setting = await Setting.filter({ key: 'shipping_methods' });
            await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            setShippingMethods(updated);
            setStatus({ message: 'Shipping method removed successfully!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to remove shipping method: ${e.message}`, type: 'error' });
        }
    };

    const handleDragEndPaymentTypes = async (result) => {
        if (!result.destination) return;
        const items = Array.from(paymentTypes);
        const [reordered] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reordered);
        setPaymentTypes(items);
        try {
            const setting = await Setting.filter({ key: 'payment_types' });
            await Setting.update(setting[0].id, { value: JSON.stringify(items) });
        } catch (e) {
            setStatus({ message: `Failed to save order: ${e.message}`, type: 'error' });
        }
    };

    const handleDragEndShippingMethods = async (result) => {
        if (!result.destination) return;
        const items = Array.from(shippingMethods);
        const [reordered] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reordered);
        setShippingMethods(items);
        try {
            const setting = await Setting.filter({ key: 'shipping_methods' });
            await Setting.update(setting[0].id, { value: JSON.stringify(items) });
        } catch (e) {
            setStatus({ message: `Failed to save order: ${e.message}`, type: 'error' });
        }
    };

    const handleSortChange = async (listType, value) => {
        const updated = { ...sortSettings, [listType]: value };
        setSortSettings(updated);
        try {
            const setting = await Setting.filter({ key: 'default_sort_settings' });
            await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            setStatus({ message: 'Sort preference saved!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to save sort preference: ${e.message}`, type: 'error' });
        }
    };

    const handlePartsSortChange = async (level, value) => {
        const current = (typeof sortSettings.parts === 'object' && sortSettings.parts !== null)
            ? sortSettings.parts
            : { primary: sortSettings.parts || 'part_name_asc', secondary: 'none' };
        const updated = { ...sortSettings, parts: { ...current, [level]: value } };
        setSortSettings(updated);
        try {
            const setting = await Setting.filter({ key: 'default_sort_settings' });
            await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            setStatus({ message: 'Sort preference saved!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to save sort preference: ${e.message}`, type: 'error' });
        }
    };

    const getPartsSortValue = (level) => {
        const s = sortSettings.parts;
        if (s && typeof s === 'object') return s[level] || (level === 'primary' ? 'part_name_asc' : 'none');
        // legacy: plain string stored — treat as primary
        return level === 'primary' ? (s || 'part_name_asc') : 'none';
    };

    const handlePartsViewDefaultChange = async (field, value) => {
        const updated = {
            showFavoritesOnly: field === 'favorites' ? value : partsDefaultFavorites,
            isListView: field === 'listView' ? value : partsDefaultListView
        };
        
        if (field === 'favorites') setPartsDefaultFavorites(value);
        if (field === 'listView') setPartsDefaultListView(value);
        
        try {
            const setting = await Setting.filter({ key: 'parts_view_defaults' });
            if (setting && setting.length > 0) {
                await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            } else {
                await Setting.create({ key: 'parts_view_defaults', value: JSON.stringify(updated) });
            }
            setStatus({ message: 'Parts view preference saved!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to save preference: ${e.message}`, type: 'error' });
        }
    };

    const handleTechDisplayChange = async (field, value) => {
        const updated = {
            hideInactive: field === 'hideInactive' ? value : techHideInactive,
            hideInactiveFromLists: field === 'hideInactiveFromLists' ? value : techHideInactiveFromLists,
        };
        if (field === 'hideInactive') setTechHideInactive(value);
        if (field === 'hideInactiveFromLists') setTechHideInactiveFromLists(value);
        try {
            const setting = await Setting.filter({ key: 'technician_display_defaults' });
            if (setting && setting.length > 0) {
                await Setting.update(setting[0].id, { value: JSON.stringify(updated) });
            } else {
                await Setting.create({ key: 'technician_display_defaults', value: JSON.stringify(updated) });
            }
            setStatus({ message: 'Technician display preference saved!', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 3000);
        } catch (e) {
            setStatus({ message: `Failed to save preference: ${e.message}`, type: 'error' });
        }
    };

    const handleTimezoneChange = async (value) => {
        setTimezone(value);
        try {
            const setting = await Setting.filter({ key: 'timezone' });
            if (setting && setting.length > 0) {
                await Setting.update(setting[0].id, { value });
            } else {
                await Setting.create({ key: 'timezone', value });
            }
            clearTimezoneCache();
        setStatus({ message: 'Timezone preference saved! Reload the page to see changes.', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: '' }), 5000);
        } catch (e) {
            setStatus({ message: `Failed to save timezone: ${e.message}`, type: 'error' });
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    <SettingsIcon className="mr-3 h-8 w-8" />
                    Application Settings
                </h1>
                <p className="text-gray-500 mt-2">Manage global settings and preferences for your application.</p>
            </div>

            {status.message && (
                <Alert variant={status.type === 'error' ? 'destructive' : 'default'} 
                       className={status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}>
                    {status.type === 'success' && <CheckCircle className="h-4 w-4" />}
                    {status.type === 'error' && <AlertTriangle className="h-4 w-4" />}
                    <AlertDescription>{status.message}</AlertDescription>
                </Alert>
            )}

            {isLoading ? (
                <Card>
                    <CardContent className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <span className="ml-3">Loading settings...</span>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="pricing" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-6">
                        <TabsTrigger value="pricing" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Pricing & Currency
                        </TabsTrigger>
                        <TabsTrigger value="orders" className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Order Options
                        </TabsTrigger>
                        <TabsTrigger value="display" className="flex items-center gap-2">
                            <ArrowUpDown className="h-4 w-4" />
                            Display Preferences
                        </TabsTrigger>
                        <TabsTrigger value="regional" className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Regional Settings
                        </TabsTrigger>
                    </TabsList>

                    {/* Pricing & Currency Tab */}
                    <TabsContent value="pricing" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">Currency Exchange</CardTitle>
                                <CardDescription>Set the exchange rate for USD to CAD conversion</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="exchange-rate">USD to CAD Exchange Rate</Label>
                                    <p className="text-sm text-gray-500">
                                        This rate is used to calculate the Canadian cost for parts from USD suppliers.
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            id="exchange-rate"
                                            type="number"
                                            step="0.0001"
                                            value={exchangeRate}
                                            onChange={(e) => setExchangeRate(e.target.value)}
                                            className="w-48"
                                            placeholder="e.g., 1.35"
                                        />
                                        <Button onClick={handleSave} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {categories.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-xl">NonSA Pricing Markup</CardTitle>
                                    <CardDescription>Configure markup percentages by category for NonSA customers</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {categories.map(cat => (
                                            <div key={cat.id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                <Label className="font-medium flex-1">{cat.name}</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        value={cat.nonsa_markup_percentage || 0}
                                                        onChange={(e) => handleCategoryMarkupChange(cat.id, e.target.value)}
                                                        className="w-24 text-right"
                                                        placeholder="0"
                                                    />
                                                    <span className="text-gray-600 font-medium">%</span>
                                                </div>
                                            </div>
                                        ))}
                                        <Button onClick={handleSaveCategoryMarkups} disabled={isSaving} className="w-full mt-4">
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Save Category Markups
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Order Options Tab */}
                    <TabsContent value="orders" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">Payment Types</CardTitle>
                                <CardDescription>Manage payment options for purchase orders. Drag to reorder.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DragDropContext onDragEnd={handleDragEndPaymentTypes}>
                                    <Droppable droppableId="payment-types">
                                        {(provided) => (
                                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 mb-4">
                                                {paymentTypes.map((type, idx) => (
                                                    <Draggable key={type} draggableId={type} index={idx}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${snapshot.isDragging ? 'shadow-lg bg-white' : ''}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div {...provided.dragHandleProps}>
                                                                        <GripVertical className="h-5 w-5 text-gray-400" />
                                                                    </div>
                                                                    <span className="font-medium">{type}</span>
                                                                </div>
                                                                <Button variant="ghost" size="icon" onClick={() => handleRemovePaymentType(type)}>
                                                                    <X className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Add new payment type..." 
                                        value={newPaymentType}
                                        onChange={(e) => setNewPaymentType(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddPaymentType()}
                                    />
                                    <Button onClick={handleAddPaymentType} size="icon">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">Shipping Methods</CardTitle>
                                <CardDescription>Manage shipping options for orders. Drag to reorder.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DragDropContext onDragEnd={handleDragEndShippingMethods}>
                                    <Droppable droppableId="shipping-methods">
                                        {(provided) => (
                                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 mb-4">
                                                {shippingMethods.map((method, idx) => (
                                                    <Draggable key={method} draggableId={method} index={idx}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${snapshot.isDragging ? 'shadow-lg bg-white' : ''}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div {...provided.dragHandleProps}>
                                                                        <GripVertical className="h-5 w-5 text-gray-400" />
                                                                    </div>
                                                                    <span className="font-medium">{method}</span>
                                                                </div>
                                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveShippingMethod(method)}>
                                                                    <X className="h-4 w-4 text-red-500" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Add new shipping method..." 
                                        value={newShippingMethod}
                                        onChange={(e) => setNewShippingMethod(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddShippingMethod()}
                                    />
                                    <Button onClick={handleAddShippingMethod} size="icon">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Display Preferences Tab */}
                    <TabsContent value="display" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">Default Sort Order</CardTitle>
                                <CardDescription>Configure how lists are sorted by default throughout the application</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Parts — special two-level sort */}
                                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg md:col-span-2">
                                        <Label className="font-semibold text-base">Parts</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-500 font-medium">Primary Sort</Label>
                                                <Select
                                                    value={getPartsSortValue('primary')}
                                                    onValueChange={(val) => handlePartsSortChange('primary', val)}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {SORT_OPTIONS.parts.map(option => (
                                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs text-gray-500 font-medium">Secondary Sort <span className="text-gray-400">(tiebreaker)</span></Label>
                                                <Select
                                                    value={getPartsSortValue('secondary')}
                                                    onValueChange={(val) => handlePartsSortChange('secondary', val)}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">— None —</SelectItem>
                                                        {SORT_OPTIONS.parts.map(option => (
                                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* All other list types — single sort */}
                                    {Object.keys(SORT_OPTIONS).filter(t => t !== 'parts').map(listType => (
                                        <div key={listType} className="space-y-2 p-4 bg-gray-50 rounded-lg">
                                            <Label className="capitalize font-semibold text-base">{listType}</Label>
                                            <Select 
                                                value={typeof sortSettings[listType] === 'string' ? sortSettings[listType] : SORT_OPTIONS[listType][0].value}
                                                onValueChange={(val) => handleSortChange(listType, val)}
                                            >
                                               <SelectTrigger><SelectValue /></SelectTrigger>
                                               <SelectContent>
                                                   {SORT_OPTIONS[listType].map(option => (
                                                       <SelectItem key={option.value} value={option.value}>
                                                           {option.label}
                                                       </SelectItem>
                                                   ))}
                                               </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">Parts Page Defaults</CardTitle>
                                <CardDescription>Configure default view options for the Parts page</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <Checkbox 
                                        id="default-favorites"
                                        checked={partsDefaultFavorites}
                                        onCheckedChange={(checked) => handlePartsViewDefaultChange('favorites', checked)}
                                    />
                                    <Label htmlFor="default-favorites" className="cursor-pointer flex items-center gap-2 text-yellow-700 font-medium">
                                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                        Show Favorites by Default
                                    </Label>
                                </div>
                                
                                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <Checkbox 
                                        id="default-list-view"
                                        checked={partsDefaultListView}
                                        onCheckedChange={(checked) => handlePartsViewDefaultChange('listView', checked)}
                                    />
                                    <Label htmlFor="default-list-view" className="cursor-pointer flex items-center gap-2 text-slate-700 font-medium">
                                        <Grid className="h-4 w-4" />
                                        Use List View by Default
                                    </Label>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">Technicians</CardTitle>
                                <CardDescription>Configure how inactive technicians are shown throughout the application</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <Checkbox
                                        id="tech-hide-inactive"
                                        checked={techHideInactive}
                                        onCheckedChange={(checked) => handleTechDisplayChange('hideInactive', checked)}
                                    />
                                    <Label htmlFor="tech-hide-inactive" className="cursor-pointer text-slate-700 font-medium">
                                        Hide Inactive Technicians on the Technicians Page
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <Checkbox
                                        id="tech-hide-inactive-lists"
                                        checked={techHideInactiveFromLists}
                                        onCheckedChange={(checked) => handleTechDisplayChange('hideInactiveFromLists', checked)}
                                    />
                                    <Label htmlFor="tech-hide-inactive-lists" className="cursor-pointer text-slate-700 font-medium">
                                        Hide Inactive Technicians from All Lists & Reports
                                    </Label>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Regional Settings Tab */}
                    <TabsContent value="regional" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">Timezone</CardTitle>
                                <CardDescription>Set your local timezone for accurate date and time display</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="timezone">Application Timezone</Label>
                                    <p className="text-sm text-gray-500">
                                        All dates and times will be displayed in this timezone.
                                    </p>
                                    <Select value={timezone} onValueChange={handleTimezoneChange}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="America/St_Johns">Newfoundland Time (NST/NDT)</SelectItem>
                                            <SelectItem value="America/Halifax">Atlantic Time (AST/ADT)</SelectItem>
                                            <SelectItem value="America/Toronto">Eastern Time (EST/EDT)</SelectItem>
                                            <SelectItem value="America/Winnipeg">Central Time (CST/CDT)</SelectItem>
                                            <SelectItem value="America/Edmonton">Mountain Time (MST/MDT)</SelectItem>
                                            <SelectItem value="America/Vancouver">Pacific Time (PST/PDT)</SelectItem>
                                            <SelectItem value="America/New_York">US Eastern Time</SelectItem>
                                            <SelectItem value="America/Chicago">US Central Time</SelectItem>
                                            <SelectItem value="America/Denver">US Mountain Time</SelectItem>
                                            <SelectItem value="America/Los_Angeles">US Pacific Time</SelectItem>
                                            <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                                            <SelectItem value="Europe/Paris">Central European Time</SelectItem>
                                            <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                                            <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                                            <SelectItem value="UTC">UTC</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                                            </Tabs>
                                            )}
                                            </div>
                                            );
                                            }