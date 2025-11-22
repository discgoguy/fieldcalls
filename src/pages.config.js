import OnSiteService from './pages/OnSiteService';
import PartsOrder from './pages/PartsOrder';
import Customers from './pages/Customers';
import Transactions from './pages/Transactions';
import Parts from './pages/Parts';
import Overview from './pages/Overview';
import Categories from './pages/Categories';
import MachineTypes from './pages/MachineTypes';
import ImportMachines from './pages/ImportMachines';
import ImportParts from './pages/ImportParts';
import Users from './pages/Users';
import Technicians from './pages/Technicians';
import BackupRestore from './pages/BackupRestore';
import Tickets from './pages/Tickets';
import PastOrders from './pages/PastOrders';
import Export from './pages/Export';
import Quotes from './pages/Quotes';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import MaintenanceTemplates from './pages/MaintenanceTemplates';
import MaintenanceChecklists from './pages/MaintenanceChecklists';
import Home from './pages/Home';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';
import Upgrade from './pages/Upgrade';
import InitializeTrial from './pages/InitializeTrial';
import SetupWizard from './pages/SetupWizard';
import TenantManagement from './pages/TenantManagement';
import Machines from './pages/Machines';
import AcceptInvitation from './pages/AcceptInvitation';
import Tutorial from './pages/Tutorial';
import Layout from './Layout.jsx';


export const PAGES = {
    "OnSiteService": OnSiteService,
    "PartsOrder": PartsOrder,
    "Customers": Customers,
    "Transactions": Transactions,
    "Parts": Parts,
    "Overview": Overview,
    "Categories": Categories,
    "MachineTypes": MachineTypes,
    "ImportMachines": ImportMachines,
    "ImportParts": ImportParts,
    "Users": Users,
    "Technicians": Technicians,
    "BackupRestore": BackupRestore,
    "Tickets": Tickets,
    "PastOrders": PastOrders,
    "Export": Export,
    "Quotes": Quotes,
    "Suppliers": Suppliers,
    "PurchaseOrders": PurchaseOrders,
    "Reports": Reports,
    "Settings": Settings,
    "MaintenanceTemplates": MaintenanceTemplates,
    "MaintenanceChecklists": MaintenanceChecklists,
    "Home": Home,
    "Features": Features,
    "Pricing": Pricing,
    "Contact": Contact,
    "Upgrade": Upgrade,
    "InitializeTrial": InitializeTrial,
    "SetupWizard": SetupWizard,
    "TenantManagement": TenantManagement,
    "Machines": Machines,
    "AcceptInvitation": AcceptInvitation,
    "Tutorial": Tutorial,
}

export const pagesConfig = {
    mainPage: "Overview",
    Pages: PAGES,
    Layout: Layout,
};