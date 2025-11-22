import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, Wrench, Package, FileText,
  ShoppingCart, BarChart3, Settings, LogOut, Menu, X,
  ClipboardList, DollarSign, Truck, User, Crown, Sparkles, CheckSquare, BookOpen
} from 'lucide-react';
import { COMPANY_LOGO_URL } from '@/components/constants';
import TrialBanner from '@/components/TrialBanner';
import TrialCheck from '@/components/TrialCheck';

const iconMap = {
    LayoutDashboard, Users, Wrench, Package, FileText,
    ShoppingCart, BarChart3, Settings, ClipboardList,
    DollarSign, Truck, User, Crown, Sparkles, CheckSquare, BookOpen
};

// Default navigation config
const defaultNavigationConfig = {
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
};

export default function Layout({ children, currentPageName }) {
    console.log('🎯 Layout rendering for page:', currentPageName);
    
    // CRITICAL: Pages that should COMPLETELY bypass all layout and checks
    const publicPages = ['AcceptInvitation', 'InitializeTrial'];
    if (publicPages.includes(currentPageName)) {
        console.log('✅ Public page detected in Layout, rendering children only');
        return <>{children}</>;
    }

    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    const [user, setUser] = React.useState(null);
    const [navigationConfig, setNavigationConfig] = React.useState(defaultNavigationConfig);

    React.useEffect(() => {
        loadUser();
        loadNavigationConfig();
    }, []);

    const loadUser = async () => {
        try {
            const userData = await base44.auth.me();
            setUser(userData);
        } catch (error) {
            console.error('Error loading user:', error);
        }
    };

    const loadNavigationConfig = async () => {
        try {
            const filter = await withTenantFilter({ key: 'navigation_config' });
            const settings = await base44.entities.Setting.filter(filter);
            
            if (settings.length > 0) {
                const config = JSON.parse(settings[0].value);
                setNavigationConfig(config);
            }
        } catch (error) {
            console.error('Error loading navigation config:', error);
            // Keep default config on error
        }
    };

    const handleLogout = async () => {
        await base44.auth.logout();
    };

    const isAdmin = user?.role === 'admin' || user?.is_tenant_owner === true;
    const isTrial = user?.subscription_status === 'trial';
    const isSuperAdmin = user?.email === 'discgoguy@gmail.com';

    // Render navigation items from config
    const renderNavigationItems = (section) => {
        if (!section.visible) return null;

        const items = section.items
            .filter(item => item.visible)
            .map(item => {
                const Icon = iconMap[item.icon];
                const isActive = currentPageName === item.page;
                
                return (
                    <Link
                        key={item.id}
                        to={createPageUrl(item.page)}
                        className={`
                            flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                            ${isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            }
                        `}
                        onClick={() => setSidebarOpen(false)}
                    >
                        {Icon && <Icon className="w-5 h-5 mr-3" />}
                        {item.name}
                    </Link>
                );
            });

        return items;
    };

    return (
        <TrialCheck>
            <div className="min-h-screen bg-gray-50">
                <TrialBanner />

                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                <div className={`
                    fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0
                `}>
                    <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
                        <img src={COMPANY_LOGO_URL} alt="FieldCalls" className="h-8" />
                        <button
                            className="lg:hidden text-gray-500 hover:text-gray-700"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                        {navigationConfig.sections.map((section, index) => {
                            // Filter sections based on permissions
                            if (section.type === 'admin' && !isAdmin) return null;
                            if (section.type === 'super_admin' && !isSuperAdmin) return null;
                            
                            const items = renderNavigationItems(section);
                            if (!items || items.length === 0) return null;

                            return (
                                <React.Fragment key={section.id}>
                                    {index > 0 && section.visible && (
                                        <div className="pt-4 mt-4 border-t border-gray-200">
                                            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                                {section.name}
                                            </p>
                                        </div>
                                    )}
                                    {items}
                                </React.Fragment>
                            );
                        })}

                        {/* Upgrade link for trial users */}
                        {isTrial && (
                            <Link
                                to={createPageUrl('Upgrade')}
                                className={`
                                    flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                    ${currentPageName === 'Upgrade'
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }
                                    mt-4 pt-4 border-t border-gray-200
                                `}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Crown className="w-5 h-5 mr-3 text-yellow-500" />
                                Upgrade
                            </Link>
                        )}

                        {/* Super Admin section */}
                        {isSuperAdmin && (
                            <>
                                <div className="pt-4 mt-4 border-t border-gray-200">
                                    <p className="px-3 text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
                                        Super Admin
                                    </p>
                                </div>
                                <Link
                                    to={createPageUrl('TenantManagement')}
                                    className={`
                                        flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                        ${currentPageName === 'TenantManagement'
                                            ? 'bg-red-50 text-red-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }
                                    `}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <Crown className="w-5 h-5 mr-3 text-red-600" />
                                    Tenant Management
                                </Link>
                            </>
                        )}
                    </nav>

                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center min-w-0">
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-medium text-blue-600">
                                        {user?.full_name?.[0] || user?.email?.[0] || 'U'}
                                    </span>
                                </div>
                                <div className="ml-3 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">
                                        {user?.full_name || user?.email}
                                    </p>
                                    <p className="text-xs text-gray-500 capitalize">
                                        {user?.role || 'User'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                className="flex-shrink-0"
                            >
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="lg:pl-64">
                    <div className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 lg:hidden">
                        <button
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <img src={COMPANY_LOGO_URL} alt="FieldCalls" className="h-6" />
                        <div className="w-6" />
                    </div>

                    <main className="p-6">
                        {children}
                    </main>
                </div>
            </div>
        </TrialCheck>
    );
}