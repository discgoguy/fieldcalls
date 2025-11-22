
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Download, Upload, ArrowRight, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import SetupStep from '@/components/setup/SetupStep';
import { createPageUrl } from '@/utils';
import { withTenantFilter } from '@/components/utils/tenant';

const SETUP_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to FieldCalls!',
        description: 'Let\'s get your account set up with the data you need.',
        entity: null,
        icon: '👋'
    },
    {
        id: 'categories',
        title: 'Part Categories',
        description: 'Organize your parts into categories (e.g., Electrical, Mechanical, Hydraulic)',
        entity: 'Category',
        icon: '📦',
        fields: ['name'],
        sampleData: [
            { name: 'Electrical' },
            { name: 'Mechanical' },
            { name: 'Hydraulic' },
            { name: 'Pneumatic' },
            { name: 'Filters' }
        ],
        csvTemplate: 'name\nElectrical\nMechanical\nHydraulic\nPneumatic\nFilters'
    },
    {
        id: 'machine_types',
        title: 'Machine Types',
        description: 'Define the types of machines you service (e.g., Forklift, Pallet Jack, Reach Truck)',
        entity: 'MachineType',
        icon: '🏗️',
        fields: ['name', 'description'],
        sampleData: [
            { name: 'Forklift - Electric', description: 'Electric powered forklift trucks' },
            { name: 'Forklift - Propane', description: 'Propane powered forklift trucks' },
            { name: 'Pallet Jack', description: 'Manual and electric pallet jacks' },
            { name: 'Reach Truck', description: 'High-reach warehouse trucks' }
        ],
        csvTemplate: 'name,description\n"Forklift - Electric","Electric powered forklift trucks"\n"Forklift - Propane","Propane powered forklift trucks"\n"Pallet Jack","Manual and electric pallet jacks"\n"Reach Truck","High-reach warehouse trucks"'
    },
    {
        id: 'suppliers',
        title: 'Suppliers',
        description: 'Add your parts suppliers and their contact information',
        entity: 'Supplier',
        icon: '🏢',
        fields: ['name', 'phone', 'email', 'is_usd'],
        sampleData: [
            { name: 'ABC Parts Supply', phone: '555-0100', email: 'sales@abcparts.com', is_usd: false },
            { name: 'US Industrial Parts', phone: '555-0200', email: 'orders@usindustrial.com', is_usd: true },
            { name: 'Local Equipment Co', phone: '555-0300', email: 'info@localequip.com', is_usd: false }
        ],
        csvTemplate: 'name,phone,email,is_usd\n"ABC Parts Supply","555-0100","sales@abcparts.com",false\n"US Industrial Parts","555-0200","orders@usindustrial.com",true\n"Local Equipment Co","555-0300","info@localequip.com",false'
    },
    {
        id: 'technicians',
        title: 'Technicians',
        description: 'Add your service technicians who will be performing field work',
        entity: 'Technician',
        icon: '👷',
        fields: ['full_name', 'technician_code', 'specialties'],
        sampleData: [
            { full_name: 'John Smith', technician_code: 'JS001', specialties: ['Electrical', 'Hydraulic'] },
            { full_name: 'Sarah Johnson', technician_code: 'SJ002', specialties: ['Mechanical', 'Pneumatic'] },
            { full_name: 'Mike Davis', technician_code: 'MD003', specialties: ['Electrical', 'Mechanical'] }
        ],
        csvTemplate: 'full_name,technician_code,specialties\n"John Smith","JS001","Electrical;Hydraulic"\n"Sarah Johnson","SJ002","Mechanical;Pneumatic"\n"Mike Davis","MD003","Electrical;Mechanical"'
    },
    {
        id: 'customers',
        title: 'Customers',
        description: 'Import your customer database. Each customer can have multiple machines.',
        entity: 'Customer',
        icon: '👥',
        fields: ['customer_identifier', 'company_name', 'contact_person', 'phone', 'email'],
        sampleData: [
            { customer_identifier: 'CUST001', company_name: 'Acme Warehousing', contact_person: 'Bob Wilson', phone: '555-1000', email: 'bob@acmewarehouse.com' },
            { customer_identifier: 'CUST002', company_name: 'Big Box Logistics', contact_person: 'Jane Doe', phone: '555-2000', email: 'jane@bigboxlogistics.com' },
            { customer_identifier: 'CUST003', company_name: 'Fast Freight Inc', contact_person: 'Tom Brown', phone: '555-3000', email: 'tom@fastfreight.com' }
        ],
        csvTemplate: 'customer_identifier,company_name,contact_person,phone,email\n"CUST001","Acme Warehousing","Bob Wilson","555-1000","bob@acmewarehouse.com"\n"CUST002","Big Box Logistics","Jane Doe","555-2000","jane@bigboxlogistics.com"\n"CUST003","Fast Freight Inc","Tom Brown","555-3000","tom@fastfreight.com"'
    },
    {
        id: 'settings',
        title: 'Settings',
        description: 'Configure your system settings, including currency exchange rates',
        entity: 'Setting',
        icon: '⚙️',
        fields: ['key', 'value'],
        sampleData: [
            { key: 'usd_cad_exchange_rate', value: '1.35' }
        ],
        csvTemplate: 'key,value\n"usd_cad_exchange_rate","1.35"',
        note: 'The USD to CAD exchange rate is used when your suppliers sell in US Dollars'
    },
    {
        id: 'complete',
        title: 'Setup Complete!',
        description: 'Your FieldCalls account is ready to use.',
        entity: null,
        icon: '🎉'
    }
];

export default function SetupWizard() {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [stepData, setStepData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkExistingData();
    }, []);

    const checkExistingData = async () => {
        setLoading(true);
        const completed = new Set();
        
        for (const step of SETUP_STEPS) {
            if (step.entity) {
                try {
                    // Filter by tenant_id
                    const filter = await withTenantFilter();
                    const data = await base44.entities[step.entity].filter(filter);
                    if (data && data.length > 0) {
                        completed.add(step.id);
                        setStepData(prev => ({ ...prev, [step.id]: data }));
                    }
                } catch (error) {
                    console.error(`Error checking ${step.entity}:`, error);
                }
            }
        }
        
        setCompletedSteps(completed);
        setLoading(false);
    };

    const handleStepComplete = async (stepId, data) => {
        setCompletedSteps(prev => new Set([...prev, stepId]));
        setStepData(prev => ({ ...prev, [stepId]: data }));
        
        // Auto-advance to next step
        if (currentStep < SETUP_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleSkipStep = () => {
        if (currentStep < SETUP_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const progress = (completedSteps.size / (SETUP_STEPS.length - 2)) * 100; // -2 for welcome and complete steps
    const step = SETUP_STEPS[currentStep];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-lg">Checking existing data...</span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-blue-600 mr-2" />
                        <h1 className="text-4xl font-bold text-gray-900">Setup Wizard</h1>
                    </div>
                    <p className="text-lg text-gray-600">Let's get your FieldCalls account configured and ready to use</p>
                </div>

                {/* Progress Bar */}
                {step.id !== 'welcome' && step.id !== 'complete' && (
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">
                                Step {currentStep} of {SETUP_STEPS.length - 2}
                            </span>
                            <span className="text-sm font-medium text-blue-600">
                                {completedSteps.size} of {SETUP_STEPS.length - 2} completed
                            </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                    </div>
                )}

                {/* Step Navigation Breadcrumbs */}
                <div className="flex justify-center mb-8 overflow-x-auto pb-4">
                    <div className="flex items-center space-x-2">
                        {SETUP_STEPS.map((s, idx) => {
                            if (s.id === 'welcome' || s.id === 'complete') return null;
                            const isCompleted = completedSteps.has(s.id);
                            const isCurrent = idx === currentStep;
                            
                            return (
                                <React.Fragment key={s.id}>
                                    <button
                                        onClick={() => setCurrentStep(idx)}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                                            isCurrent
                                                ? 'bg-blue-600 text-white'
                                                : isCompleted
                                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {isCompleted && <CheckCircle className="w-4 h-4" />}
                                        <span className="text-sm font-medium hidden sm:inline">{s.title}</span>
                                        <span className="text-lg sm:hidden">{s.icon}</span>
                                    </button>
                                    {idx < SETUP_STEPS.length - 2 && (
                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content Card */}
                <Card className="shadow-xl">
                    <CardHeader className="text-center">
                        <div className="text-6xl mb-4">{step.icon}</div>
                        <CardTitle className="text-3xl">{step.title}</CardTitle>
                        <CardDescription className="text-lg">{step.description}</CardDescription>
                        {completedSteps.has(step.id) && step.id !== 'complete' && (
                            <Badge className="mt-4 bg-green-100 text-green-800">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Completed
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent>
                        {step.id === 'welcome' ? (
                            <div className="text-center space-y-6">
                                <p className="text-lg text-gray-700">
                                    This wizard will guide you through setting up your essential data tables. 
                                    Don't worry - you can always add, edit, or delete data later!
                                </p>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left">
                                    <h3 className="font-semibold text-lg mb-3">What we'll set up:</h3>
                                    <ul className="space-y-2">
                                        {SETUP_STEPS.filter(s => s.entity).map(s => (
                                            <li key={s.id} className="flex items-center">
                                                <span className="text-2xl mr-3">{s.icon}</span>
                                                <div>
                                                    <div className="font-medium">{s.title}</div>
                                                    <div className="text-sm text-gray-600">{s.description}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <Button size="lg" onClick={() => setCurrentStep(1)} className="px-8">
                                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        ) : step.id === 'complete' ? (
                            <div className="text-center space-y-6 py-8">
                                <div className="text-6xl mb-4">🎉</div>
                                <p className="text-xl text-gray-700">
                                    Congratulations! Your FieldCalls account is now set up and ready to use.
                                </p>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                                    <h3 className="font-semibold text-lg mb-3 text-green-900">What's Next?</h3>
                                    <ul className="text-left space-y-2 text-gray-700">
                                        <li>✅ Add more customers, parts, and machines as needed</li>
                                        <li>✅ Create your first service call or parts order</li>
                                        <li>✅ Set up maintenance schedules for your customers</li>
                                        <li>✅ Invite team members to collaborate</li>
                                    </ul>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                                    <Button size="lg" onClick={() => window.location.href = createPageUrl('Overview')}>
                                        Go to Dashboard
                                    </Button>
                                    <Button size="lg" variant="outline" onClick={() => setCurrentStep(0)}>
                                        Review Setup
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <SetupStep
                                step={step}
                                onComplete={handleStepComplete}
                                onSkip={handleSkipStep}
                                existingData={stepData[step.id]}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Navigation Buttons */}
                {step.id !== 'welcome' && step.id !== 'complete' && (
                    <div className="flex justify-between mt-6">
                        <Button
                            variant="outline"
                            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                            disabled={currentStep === 0}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setCurrentStep(Math.min(SETUP_STEPS.length - 1, currentStep + 1))}
                            disabled={currentStep === SETUP_STEPS.length - 1}
                        >
                            Skip for Now <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
