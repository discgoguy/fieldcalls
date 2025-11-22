import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { withTenantFilter } from '@/components/utils/tenant';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    BookOpen, CheckCircle, Circle, ChevronRight, Play, 
    Settings, Users, Building2, Package, Wrench, FileText,
    ShoppingCart, ClipboardList, BarChart3, Sparkles, User,
    Truck, DollarSign, CheckSquare
} from 'lucide-react';

const tutorialSections = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: Sparkles,
        description: 'Initial setup and company configuration',
        steps: [
            {
                id: 'company-info',
                title: 'Set Up Company Information',
                description: 'Add your company details and logo for professional documents',
                page: 'Settings',
                instructions: [
                    'Navigate to Settings from the admin menu',
                    'Fill in your company name, address, and phone number',
                    'Upload your company logo (recommended: 200x80px)',
                    'Click "Save All Settings"'
                ],
                tips: 'Your company information will appear on all printed documents like quotes, invoices, and packing lists.'
            },
            {
                id: 'exchange-rate',
                title: 'Configure Exchange Rate',
                description: 'Set the USD to CAD conversion rate for suppliers',
                page: 'Settings',
                instructions: [
                    'In Settings, find the "Currency Exchange" section',
                    'Enter the current USD to CAD exchange rate',
                    'This helps calculate costs for US-based suppliers'
                ]
            },
            {
                id: 'invite-team',
                title: 'Invite Your Team',
                description: 'Add team members to collaborate',
                page: 'Users',
                instructions: [
                    'Go to Users page from the admin menu',
                    'Click "Invite New User"',
                    'Enter their email, full name, and select their role (User or Admin)',
                    'They\'ll receive an invitation email to join'
                ],
                tips: 'Admins can manage settings and users, while regular users can access operational features.'
            }
        ]
    },
    {
        id: 'master-data',
        title: 'Master Data Setup',
        icon: Building2,
        description: 'Configure your business data foundation',
        steps: [
            {
                id: 'categories',
                title: 'Create Part Categories',
                description: 'Organize your inventory with categories',
                page: 'Categories',
                instructions: [
                    'Navigate to Categories from the admin menu',
                    'Click "Add Category"',
                    'Enter category names like "Electrical", "Mechanical", "Consumables"',
                    'Categories help organize and filter parts'
                ]
            },
            {
                id: 'machine-types',
                title: 'Define Machine Types',
                description: 'Set up the types of equipment you service',
                page: 'MachineTypes',
                instructions: [
                    'Go to Machine Types from the admin menu',
                    'Click "Add Machine Type"',
                    'Enter machine type names (e.g., "CNC Mill", "Lathe", "Press")',
                    'Add descriptions for each type'
                ]
            },
            {
                id: 'suppliers',
                title: 'Add Your Suppliers',
                description: 'Track who you buy parts from',
                page: 'Suppliers',
                instructions: [
                    'Navigate to Suppliers',
                    'Click "Add Supplier"',
                    'Enter supplier name, contact info, and sales rep',
                    'Mark if they sell in USD for automatic currency conversion'
                ]
            },
            {
                id: 'technicians',
                title: 'Register Technicians',
                description: 'Add your field service technicians',
                page: 'Technicians',
                instructions: [
                    'Go to Technicians page',
                    'Click "Add Technician"',
                    'Enter full name and unique technician code',
                    'Add specialties and notes',
                    'Technicians can be assigned to service calls and tickets'
                ]
            }
        ]
    },
    {
        id: 'inventory',
        title: 'Inventory Management',
        icon: Package,
        description: 'Set up your parts inventory',
        steps: [
            {
                id: 'add-parts',
                title: 'Add Parts to Inventory',
                description: 'Create your parts catalog',
                page: 'Parts',
                instructions: [
                    'Navigate to Parts page',
                    'Click "Add Part"',
                    'Enter part name, part number, and supplier',
                    'Set cost, markup %, and sales price',
                    'Enter current quantity and reorder level',
                    'Select category and compatible machine types'
                ],
                tips: 'The reorder level helps you track when to purchase more stock.'
            },
            {
                id: 'assemblies',
                title: 'Create Part Assemblies (Kits)',
                description: 'Build kits from multiple parts',
                page: 'Parts',
                instructions: [
                    'When adding/editing a part, check "This is an assembly/kit"',
                    'Add component parts and their quantities',
                    'Set assembly labor cost',
                    'When this kit is used, all components are automatically deducted'
                ]
            }
        ]
    },
    {
        id: 'customers',
        title: 'Customer Setup',
        icon: Users,
        description: 'Manage your customer base',
        steps: [
            {
                id: 'add-customers',
                title: 'Add Customers',
                description: 'Create customer records',
                page: 'Customers',
                instructions: [
                    'Go to Customers page',
                    'Click "Add Customer"',
                    'Enter company name, contact person, and contact details',
                    'Add complete address information',
                    'Include any relevant notes'
                ]
            },
            {
                id: 'add-machines',
                title: 'Register Customer Machines',
                description: 'Track equipment at customer sites',
                page: 'Machines',
                instructions: [
                    'Navigate to Machines page',
                    'Click "Add Machine"',
                    'Select the customer',
                    'Enter serial number, model, and machine type',
                    'Add installation date and warranty info',
                    'Include maintenance notes'
                ],
                tips: 'Machines are linked to customers and can be referenced in service calls and maintenance.'
            }
        ]
    },
    {
        id: 'ticketing',
        title: 'Support Tickets',
        icon: CheckSquare,
        description: 'Handle customer requests',
        steps: [
            {
                id: 'create-ticket',
                title: 'Create Support Tickets',
                description: 'Log customer issues and requests',
                page: 'Tickets',
                instructions: [
                    'Go to Tickets page',
                    'Click "New Ticket"',
                    'Select customer and ticket type',
                    'Enter subject and detailed description',
                    'Set urgency level',
                    'Assign a technician (optional)',
                    'Customer Service team is automatically notified'
                ]
            },
            {
                id: 'convert-ticket',
                title: 'Convert Tickets to Work',
                description: 'Turn tickets into service calls or orders',
                page: 'Tickets',
                instructions: [
                    'Open a ticket from the Tickets page',
                    'Click "Convert to Service" for on-site work',
                    'Or click "Convert to Order" for parts orders',
                    'The form will be pre-filled with ticket details',
                    'Complete and submit to resolve the ticket'
                ]
            }
        ]
    },
    {
        id: 'quoting',
        title: 'Quotes & Sales',
        icon: DollarSign,
        description: 'Create professional quotes',
        steps: [
            {
                id: 'create-quote',
                title: 'Generate Customer Quotes',
                description: 'Prepare pricing proposals',
                page: 'Quotes',
                instructions: [
                    'Navigate to Quotes page',
                    'Click "New Quote"',
                    'Select customer and enter subject',
                    'Add line items (parts, services, or custom)',
                    'Set quantities and prices',
                    'Enter tax rate and valid-until date',
                    'Add notes and terms & conditions',
                    'Print or export the quote'
                ]
            },
            {
                id: 'quote-workflow',
                title: 'Manage Quote Status',
                description: 'Track quote through approval',
                page: 'Quotes',
                instructions: [
                    'Quotes start as "Draft"',
                    'Change status to "Sent" when delivered to customer',
                    'Mark as "Accepted" to create a ticket or work order',
                    'Or mark as "Declined" or "Expired" to archive'
                ]
            }
        ]
    },
    {
        id: 'service-calls',
        title: 'Service Operations',
        icon: Wrench,
        description: 'Log field service work',
        steps: [
            {
                id: 'onsite-service',
                title: 'Log On-Site Service Calls',
                description: 'Record field service work',
                page: 'OnSiteService',
                instructions: [
                    'Go to On-Site Service page',
                    'Select customer and date',
                    'Select technicians and log their hours (travel & on-site)',
                    'Enter expenses (km, food, hotel, tolls)',
                    'Add parts used and select machines',
                    'Parts are automatically deducted from inventory',
                    'Add service notes',
                    'Submit to create transaction records'
                ],
                tips: 'Each technician can have different hours, and expenses are tracked per service call.'
            },
            {
                id: 'parts-orders',
                title: 'Create Parts Orders',
                description: 'Ship parts to customers',
                page: 'PartsOrder',
                instructions: [
                    'Navigate to Parts Order page',
                    'Select customer and date',
                    'Add parts and quantities',
                    'Link parts to specific machines (optional)',
                    'Enter shipping method, tracking, and cost',
                    'Add optional PO number and technician',
                    'Submit to create order and print packing list'
                ]
            }
        ]
    },
    {
        id: 'maintenance',
        title: 'Maintenance Checklists',
        icon: ClipboardList,
        description: 'Preventive maintenance workflows',
        steps: [
            {
                id: 'maintenance-templates',
                title: 'Create Maintenance Templates',
                description: 'Build reusable checklists',
                page: 'MaintenanceTemplates',
                instructions: [
                    'Go to Maintenance Templates (admin menu)',
                    'Click "Create Template"',
                    'Select machine type',
                    'Add sections (e.g., "Hydraulic System", "Electrical")',
                    'Add tasks to each section',
                    'Choose task type: checkbox, multiple choice, or text',
                    'Link parts that trigger based on responses',
                    'Save template for reuse'
                ]
            },
            {
                id: 'create-checklist',
                title: 'Generate Maintenance Checklists',
                description: 'Create service visit checklists',
                page: 'MaintenanceChecklists',
                instructions: [
                    'Navigate to Maintenance page',
                    'Click "New Checklist"',
                    'Select customer and visit date',
                    'Choose machines to service',
                    'Assign technicians',
                    'Templates auto-populate based on machine types',
                    'Print checklist for field use',
                    'Complete tasks and add notes',
                    'Convert completed checklist to service call'
                ]
            }
        ]
    },
    {
        id: 'purchasing',
        title: 'Purchase Orders',
        icon: Truck,
        description: 'Order inventory from suppliers',
        steps: [
            {
                id: 'create-po',
                title: 'Create Purchase Orders',
                description: 'Order parts from suppliers',
                page: 'PurchaseOrders',
                instructions: [
                    'Go to Purchase Orders page',
                    'Click "New Purchase Order"',
                    'Select supplier',
                    'Choose payment type and shipping method',
                    'Add parts to order',
                    'Quantities and costs are pre-filled from part data',
                    'USD prices auto-convert using exchange rate',
                    'Review totals and approve',
                    'Print PO to send to supplier'
                ]
            },
            {
                id: 'receive-po',
                title: 'Receive Purchase Orders',
                description: 'Update inventory when parts arrive',
                page: 'PurchaseOrders',
                instructions: [
                    'Open a purchase order',
                    'Click "Receive Items"',
                    'Enter quantities received for each line item',
                    'Inventory is automatically updated',
                    'PO status changes to "Complete" when fully received'
                ]
            }
        ]
    },
    {
        id: 'reporting',
        title: 'Reports & Analytics',
        icon: BarChart3,
        description: 'Track business performance',
        steps: [
            {
                id: 'view-reports',
                title: 'Access Business Reports',
                description: 'Analyze your operations',
                page: 'Reports',
                instructions: [
                    'Navigate to Reports page',
                    'Choose from available reports:',
                    '  • Customer Value Analysis',
                    '  • Technician Performance',
                    '  • Top Parts Usage',
                    '  • Service History',
                    '  • Machine Parts Analysis',
                    '  • Inventory Value',
                    'Apply date range filters',
                    'Export data as needed'
                ]
            },
            {
                id: 'transactions',
                title: 'Review All Transactions',
                description: 'Audit trail of all activities',
                page: 'Transactions',
                instructions: [
                    'Go to Transactions page',
                    'View all service calls, parts orders, and expenses',
                    'Filter by type, customer, date range, or technician',
                    'Export data for accounting or analysis',
                    'Each transaction links back to source documents'
                ]
            }
        ]
    }
];

export default function Tutorial() {
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [expandedSection, setExpandedSection] = useState('getting-started');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProgress();
    }, []);

    const loadProgress = async () => {
        try {
            const filter = await withTenantFilter({ key: 'tutorial_progress' });
            const settings = await base44.entities.Setting.filter(filter);
            
            if (settings.length > 0) {
                const progress = JSON.parse(settings[0].value || '[]');
                setCompletedSteps(new Set(progress));
            }
        } catch (error) {
            console.error('Failed to load tutorial progress:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleStepComplete = async (stepId) => {
        const newCompleted = new Set(completedSteps);
        
        if (newCompleted.has(stepId)) {
            newCompleted.delete(stepId);
        } else {
            newCompleted.add(stepId);
        }
        
        setCompletedSteps(newCompleted);
        
        // Save progress
        try {
            const filter = await withTenantFilter({ key: 'tutorial_progress' });
            const settings = await base44.entities.Setting.filter(filter);
            const progress = Array.from(newCompleted);
            
            if (settings.length > 0) {
                await base44.entities.Setting.update(settings[0].id, { 
                    value: JSON.stringify(progress) 
                });
            } else {
                const settingData = { 
                    key: 'tutorial_progress', 
                    value: JSON.stringify(progress) 
                };
                const filter = await withTenantFilter();
                await base44.entities.Setting.create({ ...settingData, tenant_id: filter.tenant_id });
            }
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    };

    const getSectionProgress = (section) => {
        const total = section.steps.length;
        const completed = section.steps.filter(step => completedSteps.has(step.id)).length;
        return { completed, total, percentage: Math.round((completed / total) * 100) };
    };

    const getTotalProgress = () => {
        const totalSteps = tutorialSections.reduce((sum, section) => sum + section.steps.length, 0);
        const completedCount = completedSteps.size;
        return { completed: completedCount, total: totalSteps, percentage: Math.round((completedCount / totalSteps) * 100) };
    };

    const navigateToPage = (pageName) => {
        window.location.href = createPageUrl(pageName);
    };

    const totalProgress = getTotalProgress();

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                        <BookOpen className="mr-3 h-8 w-8 text-blue-600" />
                        FieldCalls Tutorial
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Learn how to set up and use all features of FieldCalls
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">{totalProgress.percentage}%</div>
                    <div className="text-sm text-gray-600">
                        {totalProgress.completed} of {totalProgress.total} steps completed
                    </div>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm text-gray-600">{totalProgress.completed}/{totalProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${totalProgress.percentage}%` }}
                    />
                </div>
            </div>

            {/* Tutorial Sections */}
            <div className="space-y-4">
                {tutorialSections.map(section => {
                    const progress = getSectionProgress(section);
                    const Icon = section.icon;
                    const isExpanded = expandedSection === section.id;

                    return (
                        <Card key={section.id} className="overflow-hidden">
                            <CardHeader 
                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4 flex-1">
                                        <div className={`p-3 rounded-lg ${progress.percentage === 100 ? 'bg-green-100' : 'bg-blue-100'}`}>
                                            <Icon className={`h-6 w-6 ${progress.percentage === 100 ? 'text-green-600' : 'text-blue-600'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-lg">{section.title}</CardTitle>
                                                {progress.percentage === 100 && (
                                                    <CheckCircle className="h-5 w-5 text-green-600" />
                                                )}
                                            </div>
                                            <CardDescription>{section.description}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right mr-4">
                                            <div className="text-sm font-semibold">{progress.percentage}%</div>
                                            <div className="text-xs text-gray-500">{progress.completed}/{progress.total} steps</div>
                                        </div>
                                        <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                </div>
                                
                                {/* Section Progress Bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                                    <div 
                                        className={`h-2 rounded-full transition-all duration-500 ${
                                            progress.percentage === 100 ? 'bg-green-600' : 'bg-blue-600'
                                        }`}
                                        style={{ width: `${progress.percentage}%` }}
                                    />
                                </div>
                            </CardHeader>

                            {isExpanded && (
                                <CardContent className="pt-0 pb-6">
                                    <div className="space-y-4">
                                        {section.steps.map(step => {
                                            const isCompleted = completedSteps.has(step.id);
                                            
                                            return (
                                                <div 
                                                    key={step.id}
                                                    className={`border rounded-lg p-4 transition-all ${
                                                        isCompleted ? 'bg-green-50 border-green-200' : 'bg-white'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <button
                                                            onClick={() => toggleStepComplete(step.id)}
                                                            className="mt-1 flex-shrink-0"
                                                        >
                                                            {isCompleted ? (
                                                                <CheckCircle className="h-6 w-6 text-green-600" />
                                                            ) : (
                                                                <Circle className="h-6 w-6 text-gray-400 hover:text-blue-600" />
                                                            )}
                                                        </button>
                                                        
                                                        <div className="flex-1">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-900">{step.title}</h4>
                                                                    <p className="text-sm text-gray-600">{step.description}</p>
                                                                </div>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => navigateToPage(step.page)}
                                                                    className="ml-4"
                                                                >
                                                                    <Play className="h-4 w-4 mr-1" />
                                                                    Go to Page
                                                                </Button>
                                                            </div>
                                                            
                                                            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mt-3">
                                                                <h5 className="font-semibold text-sm text-blue-900 mb-2">
                                                                    Step-by-Step Instructions:
                                                                </h5>
                                                                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                                                                    {step.instructions.map((instruction, idx) => (
                                                                        <li key={idx}>{instruction}</li>
                                                                    ))}
                                                                </ol>
                                                            </div>
                                                            
                                                            {step.tips && (
                                                                <Alert className="mt-3 bg-yellow-50 border-yellow-200">
                                                                    <AlertDescription className="text-sm text-yellow-800">
                                                                        <strong>💡 Tip:</strong> {step.tips}
                                                                    </AlertDescription>
                                                                </Alert>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Completion Message */}
            {totalProgress.percentage === 100 && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertDescription className="text-green-800">
                        <strong>Congratulations!</strong> You've completed the FieldCalls tutorial. 
                        You're now ready to manage your field service operations efficiently! 🎉
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}