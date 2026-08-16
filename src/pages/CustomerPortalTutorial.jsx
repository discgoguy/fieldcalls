import React from "react";
import { 
    LayoutDashboard, 
    ClipboardCheck, 
    Package, 
    Box, 
    Wrench, 
    History, 
    BookOpen, 
    Contact,
    HelpCircle,
    ArrowRight,
    CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { createPageUrl } from '@/utils';
import { Link } from "react-router-dom";

export default function CustomerPortalTutorial() {
    const sections = [
        {
            title: "Dashboard Overview",
            icon: LayoutDashboard,
            color: "text-blue-600",
            bgColor: "bg-blue-50",
            description: "Your central hub for all service activities.",
            details: [
                "The Dashboard provides a quick snapshot of your account status.",
                "You can see the count of active tickets and your connected machines.",
                "Quick access cards allow you to jump directly to common tasks like ordering parts or requesting service."
            ]
        },
        {
            title: "Ticket Management",
            icon: ClipboardCheck,
            color: "text-indigo-600",
            bgColor: "bg-indigo-50",
            description: "Track requests and communicate with support.",
            details: [
                "**Active Tickets:** View all your open support requests in one place.",
                "**Request Service:** Easily submit new tickets for repairs, maintenance, or information.",
                "**Communication:** Chat directly with technicians within the ticket. You'll receive email notifications when they reply.",
                "**Status Tracking:** Monitor the progress of your tickets from 'Open' to 'Resolved'."
            ]
        },
        {
            title: "Parts Catalog & Ordering",
            icon: Package,
            color: "text-emerald-600",
            bgColor: "bg-emerald-50",
            description: "Browse and order spare parts for your machines.",
            details: [
                "**Search & Filter:** Find parts by name, number, category, or compatible machine type.",
                "**Stock Visibility:** See real-time availability of parts.",
                "**Easy Ordering:** Add items to your cart and submit purchase requests directly through the portal.",
                "**Inventory Integration:** You can also choose to simply add parts to your own local inventory tracking."
            ]
        },
        {
            title: "My Inventory",
            icon: Box,
            color: "text-cyan-600",
            bgColor: "bg-cyan-50",
            description: "Manage your local stock of spare parts.",
            details: [
                "**Track Quantities:** Keep a digital record of the parts you have on hand at your facility.",
                "**Update Stock:** Manually adjust quantities when you receive shipments or use parts.",
                "**Low Stock Alerts:** Easily see when you need to reorder critical components."
            ]
        },
        {
            title: "In-House Service Logging",
            icon: Wrench,
            color: "text-amber-600",
            bgColor: "bg-amber-50",
            description: "Record maintenance performed by your own team.",
            details: [
                "**Log Maintenance:** Document repairs or maintenance done by your internal staff.",
                "**Consume Parts:** Automatically deduct used parts from your 'My Inventory' when you log a service.",
                "**Service History:** These logs become part of the machine's permanent service history alongside professional service calls."
            ]
        },
        {
            title: "Service History & Reports",
            icon: History,
            color: "text-purple-600",
            bgColor: "bg-purple-50",
            description: "Audit trails and machine documentation.",
            details: [
                "**Full History:** View a complete timeline of all service calls, part replacements, and in-house maintenance for each machine.",
                "**Export:** Print or save service reports for compliance and record-keeping.",
                "**Cost Tracking:** Understand part usage and service frequency over time."
            ]
        },
        {
            title: "Knowledge Base",
            icon: BookOpen,
            color: "text-pink-600",
            bgColor: "bg-pink-50",
            description: "Self-help resources and manuals.",
            details: [
                "**Manuals & Guides:** Access PDF manuals and technical documents for your machines.",
                "**Video Tutorials:** Watch instructional videos for common maintenance tasks.",
                "**Searchable:** Quickly find the information you need to solve problems on your own."
            ]
        }
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div className="text-center space-y-4 py-8">
                <h1 className="text-4xl font-bold text-gray-900">Customer Portal Guide</h1>
                <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                    Learn how to get the most out of the FieldCalls Customer Portal to manage your machines, service, and parts efficiently.
                </p>
                <Link to={createPageUrl('CustomerPortal')}>
                    <Button className="mt-4">
                        Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {sections.map((section, index) => (
                    <Card key={index} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200">
                        <CardHeader className="flex flex-row gap-4 items-start space-y-0 pb-2">
                            <div className={`p-3 rounded-xl ${section.bgColor}`}>
                                <section.icon className={`w-6 h-6 ${section.color}`} />
                            </div>
                            <div className="flex-1">
                                <CardTitle className="text-xl">{section.title}</CardTitle>
                                <CardDescription className="mt-1 text-base">
                                    {section.description}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <ul className="space-y-3">
                                {section.details.map((detail, i) => (
                                    <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                                        <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${section.color} opacity-50`} />
                                        <div>
                                            {detail.split('**').map((part, j) => 
                                                j % 2 === 1 ? <strong key={j} className="text-gray-900 font-semibold">{part}</strong> : part
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
                
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                    <CardHeader className="flex flex-row gap-4 items-start space-y-0">
                        <div className="p-3 rounded-xl bg-white/10">
                            <Contact className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-xl text-white">Need More Help?</CardTitle>
                            <CardDescription className="text-gray-300 mt-1">
                                Our support team is always here to assist you.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-300">
                            If you can't find what you're looking for in the Knowledge Base or this guide, don't hesitate to reach out directly.
                        </p>
                        <div className="pt-2">
                            <Link to={createPageUrl('ServiceContacts')}>
                                <Button variant="secondary" className="w-full">
                                    Contact Support
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <div className="bg-blue-50 rounded-2xl p-8 text-center space-y-4">
                <HelpCircle className="w-12 h-12 text-blue-600 mx-auto" />
                <h2 className="text-2xl font-bold text-gray-900">Ready to get started?</h2>
                <p className="text-gray-600">
                    Head back to your dashboard to start managing your services.
                </p>
                <Link to={createPageUrl('CustomerPortal')}>
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                        Go to Dashboard
                    </Button>
                </Link>
            </div>
        </div>
    );
}