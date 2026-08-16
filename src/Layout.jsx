import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { pagesConfig } from '@/pages.config';
import { usePermissions } from '@/lib/usePermissions';
import { COMPANY_LOGO_URL } from '@/components/constants';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Box,
  Building,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Contact,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Monitor,
  Package,
  Search,
  Settings,
  Shapes,
  Shield,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

// Fallback title for a routed page with no nav entry of its own (the detail pages).
// Page keys are CamelCase ("CompanyDetail"), so space them out; handles acronym runs
// (CRM|IoT) too.
const prettyPageName = (name) => (name || '')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2');

export default function Layout({ children, currentPageName }) {
  const { canAccessPage } = usePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
        setCurrentUser(user);
      } catch {
        // Not logged in
      }
    };
    loadUser();
  }, []);

  const internalNavigation = [
    { name: 'Overview', href: createPageUrl('Overview'), icon: LayoutDashboard },
    { subheader: 'Support and Service' },
    { name: 'Tickets', href: createPageUrl('Tickets'), icon: ClipboardCheck },
    { name: 'On-Site Service', href: createPageUrl('OnSiteService'), icon: Wrench },
    { name: 'Parts Order', href: createPageUrl('PartsOrder'), icon: Package },
    { name: 'Purchase Orders', href: createPageUrl('PurchaseOrders'), icon: ShoppingCart },
    { name: 'Quotes', href: createPageUrl('Quotes'), icon: FileText },
    { name: 'Maintenance', href: createPageUrl('MaintenanceChecklists'), icon: ClipboardList },
    { subheader: 'CRM', roles: ['admin', 'sales'] },
    { name: 'Dashboard', href: createPageUrl('CRMDashboard'), icon: LayoutDashboard, roles: ['admin', 'sales'] },
    { name: 'Companies', href: createPageUrl('Companies'), icon: Building2, roles: ['admin', 'sales'] },
    { name: 'Contacts', href: createPageUrl('Contacts'), icon: Contact, roles: ['admin', 'sales'] },
    { name: 'Deals', href: createPageUrl('Deals'), icon: TrendingUp, roles: ['admin', 'sales'] },
    { name: 'Leads', href: createPageUrl('Leads'), icon: UserPlus, roles: ['admin', 'sales'] },
    { name: 'Sources & Campaigns', href: createPageUrl('SourcesCampaigns'), icon: Megaphone, roles: ['admin', 'sales'] },
    { name: 'Tasks', href: createPageUrl('Tasks'), icon: CheckSquare, roles: ['admin', 'sales'] },
    { subheader: 'Data Management' },
    { name: 'Transactions', href: createPageUrl('Transactions'), icon: ClipboardList },
    { name: 'Parts List', href: createPageUrl('Parts'), icon: Search },
    { name: 'Calendar', href: createPageUrl('Calendar'), icon: CalendarDays },
    { name: 'Borrowed Parts', href: createPageUrl('InternalPartMovements'), icon: ArrowLeftRight },
    { name: 'Customers', href: createPageUrl('Customers'), icon: Users },
    { name: 'Machines', href: createPageUrl('Machines'), icon: Monitor },
    { name: 'Suppliers', href: createPageUrl('Suppliers'), icon: Building },
    { name: 'Categories', href: createPageUrl('Categories'), icon: Shapes },
    { name: 'Technicians', href: createPageUrl('Technicians'), icon: UserCheck },
    { name: 'Time Card', href: createPageUrl('TimeCard'), icon: Clock },
    { subheader: 'Support' },
    { name: 'Knowledge Base', href: createPageUrl('KnowledgeBase'), icon: BookOpen },
    { subheader: 'Utilities' },
    { name: 'Reports', href: createPageUrl('Reports'), icon: BarChart3 },
    { name: 'Inventory Audit', href: createPageUrl('InventoryAudit'), icon: ClipboardList },
    { name: 'Inventory Count', href: createPageUrl('InventoryCount'), icon: ClipboardCheck },
    { name: 'Role Manager', href: createPageUrl('RoleManager'), icon: Shield },
    { name: 'Backup / Restore', href: createPageUrl('BackupRestore'), icon: History },
    { name: 'Export', href: createPageUrl('Export'), icon: FileText },
    { name: 'Settings', href: createPageUrl('Settings'), icon: Settings },
  ];

  const customerNavigation = [
    { name: 'Dashboard', href: createPageUrl('CustomerPortal'), icon: LayoutDashboard },
    { name: 'My Tickets', href: createPageUrl('PortalTickets'), icon: ClipboardCheck },
    { name: 'Parts Catalog', href: createPageUrl('PortalParts'), icon: Package },
    { name: 'My Inventory', href: createPageUrl('PortalInventory'), icon: Box },
    { name: 'In-House Service', href: createPageUrl('PortalInventory') + '?action=log', icon: Wrench },
    { name: 'Service History', href: createPageUrl('PortalHistory'), icon: History },
    { subheader: 'Support' },
    { name: 'Portal Tutorial', href: createPageUrl('CustomerPortalTutorial'), icon: BookOpen },
    { name: 'Knowledge Base', href: createPageUrl('KnowledgeBase'), icon: BookOpen },
    { name: 'Service Contacts', href: createPageUrl('ServiceContacts'), icon: Contact },
    ];

  const navigation = currentUser?.is_customer
    ? customerNavigation
    : internalNavigation.filter(item => {
        // Section gated to specific base roles (CRM → admin/sales), regardless
        // of Role Manager settings. Keyed off the profile role, not isAdmin.
        if (item.roles && !item.roles.includes(currentUser?.role)) return false;
        if (item.subheader) return true; // always show section headers
        if (!item.href) return true;
        // Extract page name from href
        const pageName = Object.keys(pagesConfig.Pages).find(key => 
          createPageUrl(key) === item.href
        );
        if (!pageName) return true; // keep if we can't determine page
        return canAccessPage(pageName);
      });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Nav items store their target as an href, so compare in that space rather than
  // reversing it back to a page key (createPageUrl is lossy: 'CRMDashboard' and
  // 'crmoverview' both give '/crmoverview').
  const currentUrl = createPageUrl(currentPageName || '');

  // The mobile bar reuses the sidebar's own label, so the two can never disagree about
  // what a page is called (no second name → title map to keep in sync). Detail pages
  // have no nav entry, so they fall back to their spaced-out page key.
  const currentPageTitle =
    navigation.find((i) => i.href === currentUrl)?.name || prettyPageName(currentPageName);

  // Detail pages have no nav entry of their own; highlight their parent section.
  const detailPageParents = {
    CompanyDetail: 'Companies',
    ContactDetail: 'Contacts',
    DealDetail: 'Deals',
    LeadDetail: 'Leads',
  };

  const NavItem = ({ item }) => {
    if (item.subheader) {
      return <h3 className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.subheader}</h3>;
    }
    // Match on href, the same way the permission filter above resolves an item to its
    // page. The label is display copy and doesn't have to spell the page key: deriving
    // the key from it (name.replace(/[^a-zA-Z]/g, '')) silently dropped the highlight
    // whenever a label was reworded, e.g. "Dashboard" for page `CRMDashboard`.
    const parent = detailPageParents[currentPageName];
    const isActive = item.href === currentUrl
      || (!!parent && item.href === createPageUrl(parent));
    const Icon = item.icon;
    return (
      <Link
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
          isActive
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-gray-400'}`} />
        <span>{item.name}</span>
      </Link>
    );
  };
  
  return (
    <>
      <style>{`
        @media print {
          aside, header, .print-hide, button:not(.print-container button), .no-print {
            display: none !important;
          }
          .print-container {
            display: block !important;
            visibility: visible !important;
          }
          body, main, .flex-1 {
             background-color: white !important;
             margin: 0 !important;
             padding: 0 !important;
             width: 100% !important;
             height: auto !important;
             overflow: visible !important;
          }
          .print-area {
             width: 100% !important;
             max-width: none !important;
             position: absolute !important;
             top: 0 !important;
             left: 0 !important;
          }
        }
      `}</style>
      <div className="flex h-screen bg-gray-100 font-sans">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
        )}

        {/* Sidebar */}
        <aside className={`fixed lg:relative inset-y-0 left-0 bg-white shadow-xl w-64 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-30 flex flex-col`}>
          <div className="flex items-center justify-center p-4 h-16 border-b">
            <img src={COMPANY_LOGO_URL} alt="FieldCalls" className="h-10" />
          </div>
          
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item, index) => <NavItem key={item.name || `sub_${index}`} item={item} />)}
          </nav>

          <div className="p-2 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start text-left h-auto py-2">
                  <div className="flex items-center w-full">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                      <span className="text-sm font-semibold text-gray-600">
                        {currentUser?.full_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-sm font-semibold text-gray-800 truncate">{currentUser?.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mb-2" align="start" side="top">
                {currentUser?.role === 'admin' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('Users')} className="w-full cursor-pointer flex items-center">
                        <Shield className="w-4 h-4 mr-2" />
                        User Management
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="lg:hidden bg-white shadow-sm h-16 flex items-center justify-between px-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </Button>
            <span className="text-lg font-semibold">{currentPageTitle}</span>
            <div className="w-8"></div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}