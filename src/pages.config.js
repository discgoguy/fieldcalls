import BackupRestore from './pages/BackupRestore';
import Categories from './pages/Categories';
import CRMDashboard from './pages/CRMDashboard';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Deals from './pages/Deals';
import DealDetail from './pages/DealDetail';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import SourcesCampaigns from './pages/SourcesCampaigns';
import Tasks from './pages/Tasks';
import CustomerPortal from './pages/CustomerPortal';
import CustomerPortalTutorial from './pages/CustomerPortalTutorial';
import Customers from './pages/Customers';
import Export from './pages/Export';
import Home from './pages/Home';
import ImportMachines from './pages/ImportMachines';
import ImportParts from './pages/ImportParts';
import InternalPartMovements from './pages/InternalPartMovements';
import KnowledgeBase from './pages/KnowledgeBase';
import MachineTypes from './pages/MachineTypes';
import Machines from './pages/Machines';
import MaintenanceChecklists from './pages/MaintenanceChecklists';
import MaintenanceTemplates from './pages/MaintenanceTemplates';
import OnSiteService from './pages/OnSiteService';
import Overview from './pages/Overview';
import Parts from './pages/Parts';
import InventoryAudit from './pages/InventoryAudit';
import InventoryCount from './pages/InventoryCount';
import RoleManager from './pages/RoleManager';
import Calendar from './pages/Calendar';
import PartsOrder from './pages/PartsOrder';
import PastOrders from './pages/PastOrders';
import PortalHistory from './pages/PortalHistory';
import PortalInventory from './pages/PortalInventory';
import PortalParts from './pages/PortalParts';
import PortalTickets from './pages/PortalTickets';
import PurchaseOrders from './pages/PurchaseOrders';
import Quotes from './pages/Quotes';
import Reports from './pages/Reports';
import ServiceContacts from './pages/ServiceContacts';
import Settings from './pages/Settings';
import Suppliers from './pages/Suppliers';
import Technicians from './pages/Technicians';
import TimeCard from './pages/TimeCard';
import Tickets from './pages/Tickets';
import Transactions from './pages/Transactions';
import Users from './pages/Users';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BackupRestore": BackupRestore,
    "Categories": Categories,
    "CRMDashboard": CRMDashboard,
    "Companies": Companies,
    "CompanyDetail": CompanyDetail,
    "Contacts": Contacts,
    "ContactDetail": ContactDetail,
    "Deals": Deals,
    "DealDetail": DealDetail,
    "Leads": Leads,
    "LeadDetail": LeadDetail,
    "SourcesCampaigns": SourcesCampaigns,
    "Tasks": Tasks,
    "CustomerPortal": CustomerPortal,
    "CustomerPortalTutorial": CustomerPortalTutorial,
    "Customers": Customers,
    "Export": Export,
    "Home": Home,
    "ImportMachines": ImportMachines,
    "ImportParts": ImportParts,
    "InternalPartMovements": InternalPartMovements,
    "KnowledgeBase": KnowledgeBase,
    "MachineTypes": MachineTypes,
    "Machines": Machines,
    "MaintenanceChecklists": MaintenanceChecklists,
    "MaintenanceTemplates": MaintenanceTemplates,
    "OnSiteService": OnSiteService,
    "Overview": Overview,
    "Parts": Parts,
    "PartsOrder": PartsOrder,
    "InventoryAudit": InventoryAudit,
    "InventoryCount": InventoryCount,
    "RoleManager": RoleManager,
    "Calendar": Calendar,
    "PastOrders": PastOrders,
    "PortalHistory": PortalHistory,
    "PortalInventory": PortalInventory,
    "PortalParts": PortalParts,
    "PortalTickets": PortalTickets,
    "PurchaseOrders": PurchaseOrders,
    "Quotes": Quotes,
    "Reports": Reports,
    "ServiceContacts": ServiceContacts,
    "Settings": Settings,
    "Suppliers": Suppliers,
    "Technicians": Technicians,
    "TimeCard": TimeCard,
    "Tickets": Tickets,
    "Transactions": Transactions,
    "Users": Users,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};