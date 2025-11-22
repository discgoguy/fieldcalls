import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Settings as SettingsIcon, CheckCircle, AlertTriangle, Upload, Image as ImageIcon, DollarSign, Menu } from 'lucide-react';
import NavigationEditor from '../components/settings/NavigationEditor';

// Default navigation configuration
const getDefaultNavigationConfig = () => ({
    sections: [
        {
            id: 'main',
            name: 'Main Navigation',
            type: 'main',
            visible: true,
            items: [
                { id: 'overview', name: 'Overview', page: 'Overview', icon: 'LayoutDashboard', visible: true },
                { id: 'tutorial', name: 'Tutorial', page: 'Tutorial', icon: 'BookOpen', visible: true },
                { id: 'customers', name: 'Customers', page: 'Customers', icon: 'Users', visible: true },
                { id: 'machines', name: 'Machines', page: 'Machines', icon: 'Settings', visible: true },
                { id: 'parts', name: 'Parts', page: 'Parts', icon: 'Package', visible: true },
                { id: 'transactions', name: 'Transactions', page: 'Transactions', icon: 'FileText', visible: true },
                { id: 'tickets', name: 'Tickets', page: 'Tickets', icon: 'CheckSquare', visible: true },
                { id: 'onsite', name: 'On-Site Service', page: 'OnSiteService', icon: 'Wrench', visible: true },
                { id: 'partsorder', name: 'Parts Order', page: 'PartsOrder', icon: 'ShoppingCart', visible: true },
                { id: 'quotes', name: 'Quotes', page: 'Quotes', icon: 'DollarSign', visible: true },
                { id: 'purchaseorders', name: 'Purchase Orders', page: 'PurchaseOrders', icon: 'Truck', visible: true },
                { id: 'maintenance', name: 'Maintenance', page: 'MaintenanceChecklists', icon: 'ClipboardList', visible: true },
                { id: 'reports', name: 'Reports', page: 'Reports', icon: 'BarChart3', visible: true },
            ]
        },
        {
            id: 'admin',
            name: 'Administration',
            type: 'admin',
            visible: true,
            items: [
                { id: 'setupwizard', name: 'Setup Wizard', page: 'SetupWizard', icon: 'Sparkles', visible: true },
                { id: 'categories', name: 'Categories', page: 'Categories', icon: 'Package', visible: true },
                { id: 'machinetypes', name: 'Machine Types', page: 'MachineTypes', icon: 'Settings', visible: true },
                { id: 'suppliers', name: 'Suppliers', page: 'Suppliers', icon: 'Truck', visible: true },
                { id: 'technicians', name: 'Technicians', page: 'Technicians', icon: 'Wrench', visible: true },
                { id: 'users', name: 'Users', page: 'Users', icon: 'Users', visible: true },
                { id: 'settings', name: 'Settings', page: 'Settings', icon: 'Settings', visible: true },
            ]
        }
    ]
});

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [companyPhone, setCompanyPhone] = useState('');
    const [companyWebsite, setCompanyWebsite] = useState('');
    const [companyLogo, setCompanyLogo] = useState('');
    const [exchangeRate, setExchangeRate] = useState('');
    const [navigationConfig, setNavigationConfig] = useState(getDefaultNavigationConfig());

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const filter = await withTenantFilter();
            const settings = await base44.entities.Setting.filter(filter);

            settings.forEach(setting => {
                switch (setting.key) {
                    case 'company_name':
                        setCompanyName(setting.value);
                        break;
                    case 'company_address':
                        setCompanyAddress(setting.value);
                        break;
                    case 'company_phone':
                        setCompanyPhone(setting.value);
                        break;
                    case 'company_website':
                        setCompanyWebsite(setting.value);
                        break;
                    case 'company_logo':
                        setCompanyLogo(setting.value);
                        setLogoPreview(setting.value);
                        break;
                    case 'usd_to_cad_rate':
                        setExchangeRate(setting.value);
                        break;
                    case 'navigation_config':
                        try {
                            const config = JSON.parse(setting.value);
                            setNavigationConfig(config);
                        } catch (e) {
                            console.error('Failed to parse navigation config:', e);
                        }
                        break;
                }
            });
        } catch (err) {
            setError('Failed to load settings');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadLogo = async () => {
        if (!logoFile) return companyLogo;

        setUploadingLogo(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file: logoFile });
            setCompanyLogo(file_url);
            setLogoFile(null);
            return file_url;
        } catch (err) {
            throw new Error('Failed to upload logo: ' + err.message);
        } finally {
            setUploadingLogo(false);
        }
    };

    const saveSetting = async (key, value) => {
        const filter = await withTenantFilter({ key });
        const existing = await base44.entities.Setting.filter(filter);

        if (existing.length > 0) {
            await base44.entities.Setting.update(existing[0].id, { value });
        } else {
            const tenantFilter = await withTenantFilter();
            await base44.entities.Setting.create({
                key,
                value,
                tenant_id: tenantFilter.tenant_id
            });
        }
    };

    const handleSaveCompanyInfo = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            let logoUrl = companyLogo;
            if (logoFile) {
                logoUrl = await uploadLogo();
            }

            await Promise.all([
                saveSetting('company_name', companyName),
                saveSetting('company_address', companyAddress),
                saveSetting('company_phone', companyPhone),
                saveSetting('company_website', companyWebsite),
                saveSetting('company_logo', logoUrl)
            ]);

            setSuccess('Company information saved successfully!');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveExchangeRate = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await saveSetting('usd_to_cad_rate', exchangeRate);
            setSuccess('Exchange rate saved successfully!');
            setTimeout(() => setSuccess(''), 4000);
        } catch (err) {
            setError('Failed to save exchange rate');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNavigation = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await saveSetting('navigation_config', JSON.stringify(navigationConfig));
            setSuccess('Navigation settings saved! Please refresh the page to see changes.');
            setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
            setError('Failed to save navigation settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <SettingsIcon className="mr-3 h-8 w-8" />
                    Settings
                </h1>
            </div>

            {success && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Success</AlertTitle>
                    <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="company" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="company">Company Info</TabsTrigger>
                    <TabsTrigger value="currency">Currency</TabsTrigger>
                    <TabsTrigger value="navigation">Navigation</TabsTrigger>
                </TabsList>

                <TabsContent value="company" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Company Information</CardTitle>
                            <CardDescription>
                                This information will appear on printed documents like quotes, invoices, and packing lists.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="company_name">Company Name</Label>
                                <Input
                                    id="company_name"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Your Company Name"
                                />
                            </div>

                            <div>
                                <Label htmlFor="company_address">Address</Label>
                                <Textarea
                                    id="company_address"
                                    value={companyAddress}
                                    onChange={(e) => setCompanyAddress(e.target.value)}
                                    placeholder="Street Address&#10;City, Province&#10;Postal Code"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="company_phone">Phone Number</Label>
                                    <Input
                                        id="company_phone"
                                        value={companyPhone}
                                        onChange={(e) => setCompanyPhone(e.target.value)}
                                        placeholder="(123) 456-7890"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="company_website">Website</Label>
                                    <Input
                                        id="company_website"
                                        value={companyWebsite}
                                        onChange={(e) => setCompanyWebsite(e.target.value)}
                                        placeholder="www.yourcompany.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="company_logo">Company Logo</Label>
                                <div className="mt-2 space-y-3">
                                    {logoPreview && (
                                        <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
                                            <img
                                                src={logoPreview}
                                                alt="Company Logo Preview"
                                                className="max-h-24 object-contain"
                                            />
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="company_logo"
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoChange}
                                            className="flex-1"
                                        />
                                        {logoFile && (
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setLogoFile(null);
                                                    setLogoPreview(companyLogo);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        Recommended: 200x80px PNG or JPG with transparent background
                                    </p>
                                </div>
                            </div>

                            <Button 
                                onClick={handleSaveCompanyInfo} 
                                disabled={saving || uploadingLogo}
                                className="w-full md:w-auto"
                            >
                                {saving || uploadingLogo ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Company Information'
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="currency" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5" />
                                <CardTitle>Currency Exchange</CardTitle>
                            </div>
                            <CardDescription>
                                Set the USD to CAD exchange rate for calculating costs from US-based suppliers.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="exchange_rate">USD to CAD Exchange Rate</Label>
                                <Input
                                    id="exchange_rate"
                                    type="number"
                                    step="0.0001"
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(e.target.value)}
                                    placeholder="1.35"
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    Example: If 1 USD = 1.35 CAD, enter 1.35
                                </p>
                            </div>

                            <Button 
                                onClick={handleSaveExchangeRate} 
                                disabled={saving}
                                className="w-full md:w-auto"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Exchange Rate'
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="navigation" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Menu className="h-5 w-5" />
                                <CardTitle>Navigation Menu Customization</CardTitle>
                            </div>
                            <CardDescription>
                                Customize your sidebar navigation by reordering items, showing/hiding links, and organizing with section headers.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <NavigationEditor 
                                config={navigationConfig}
                                onChange={setNavigationConfig}
                            />

                            <div className="pt-4 border-t">
                                <Button 
                                    onClick={handleSaveNavigation} 
                                    disabled={saving}
                                    className="w-full md:w-auto"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Navigation Settings'
                                    )}
                                </Button>
                                <p className="text-sm text-gray-500 mt-2">
                                    Note: You'll need to refresh the page to see navigation changes take effect.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}