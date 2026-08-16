import React, { useState, useEffect } from "react";
import { supabase } from '@/api/supabaseClient';
import { Machine, Ticket } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardCheck, Package, History, ArrowRight, Monitor, Wrench, Box, BookOpen, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function CustomerPortal() {
    const [user, setUser] = useState(null);
    const [activeTickets, setActiveTickets] = useState(0);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const currentUser = await (async () => { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(); return { ...user, ...profile, full_name: profile?.full_name || user.email, role: profile?.role || "admin" }; })();
                setUser(currentUser);

                if (currentUser?.customer_id) {
                    const [tickets, customerMachines] = await Promise.all([
                        Ticket.filter({ customer_id: currentUser.customer_id, status: ['Open', 'In Progress', 'Pending'] }),
                        Machine.filter({ customer_id: currentUser.customer_id })
                    ]);
                    setActiveTickets(tickets?.length || 0);
                    setMachines(customerMachines || []);
                }
            } catch (e) {
                console.error("Failed to load portal data", e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.full_name}</h1>
                    <p className="text-gray-500">Manage your services, orders, and support tickets.</p>
                </div>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Smartphone className="w-4 h-4" />
                            Install App
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Smartphone className="w-5 h-5" />
                                Install as Mobile App
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                            <p className="text-sm text-gray-600">
                                Add the FieldCalls Customer Portal to your phone's home screen for quick access, just like a native app!
                            </p>

                            <div className="space-y-4">
                                <div className="border rounded-lg p-4 bg-blue-50">
                                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Smartphone className="w-5 h-5" />
                                        iPhone (Safari)
                                    </h3>
                                    <ol className="space-y-2 text-sm">
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">1.</span>
                                            <span>Open this page in <strong>Safari</strong> browser</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">2.</span>
                                            <span>Tap the <strong>Share</strong> button (square with arrow pointing up) at the bottom of the screen</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">3.</span>
                                            <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">4.</span>
                                            <span>Tap <strong>"Add"</strong> in the top right corner</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">5.</span>
                                            <span>The app icon will appear on your home screen!</span>
                                        </li>
                                    </ol>
                                </div>

                                <div className="border rounded-lg p-4 bg-green-50">
                                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Smartphone className="w-5 h-5" />
                                        Android (Chrome)
                                    </h3>
                                    <ol className="space-y-2 text-sm">
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">1.</span>
                                            <span>Open this page in <strong>Chrome</strong> browser</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">2.</span>
                                            <span>Tap the <strong>three-dot menu</strong> (⋮) in the top right corner</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">3.</span>
                                            <span>Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">4.</span>
                                            <span>Tap <strong>"Add"</strong> or <strong>"Install"</strong> to confirm</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="font-bold min-w-[20px]">5.</span>
                                            <span>The app icon will appear on your home screen!</span>
                                        </li>
                                    </ol>
                                </div>
                            </div>

                            <div className="bg-gray-100 rounded-lg p-4">
                                <h4 className="font-semibold mb-2">Benefits:</h4>
                                <ul className="space-y-1 text-sm text-gray-700">
                                    <li>• Launch the portal directly from your home screen</li>
                                    <li>• Full-screen experience without browser bars</li>
                                    <li>• Faster access to manage tickets and order parts</li>
                                    <li>• Works offline for viewing cached data</li>
                                </ul>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Active Tickets Card */}
                <Card className="border-0 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <ClipboardCheck className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-gray-800">{activeTickets}</div>
                            </div>
                        </div>
                        <CardTitle className="text-lg font-semibold mt-2 text-gray-800">Active Tickets</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">Support requests currently in progress</p>
                        <Link to={createPageUrl('PortalTickets')} className="w-full block">
                            <Button variant="outline" className="w-full group-hover:border-blue-200 group-hover:bg-blue-50 text-blue-700">
                                View Tickets <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Request Service Call Card */}
                <Card className="border-0 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="h-2 bg-gradient-to-r from-red-500 to-pink-400"></div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="bg-red-50 p-2 rounded-lg">
                                <Wrench className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                        <CardTitle className="text-lg font-semibold mt-2 text-gray-800">Request Service Call</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">Create a new service request ticket</p>
                        <Link to={createPageUrl('PortalTickets') + '?action=new&type=Repair Request'} className="w-full block">
                            <Button variant="outline" className="w-full group-hover:border-red-200 group-hover:bg-red-50 text-red-700">
                                Request Service <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                 {/* Parts Catalog Card */}
                <Card className="border-0 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="bg-emerald-50 p-2 rounded-lg">
                                <Package className="h-6 w-6 text-emerald-600" />
                            </div>
                        </div>
                        <CardTitle className="text-lg font-semibold mt-2 text-gray-800">Parts Catalog</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">Browse our catalog and order new parts</p>
                        <Link to={createPageUrl('PortalParts')} className="w-full block">
                            <Button variant="outline" className="w-full group-hover:border-emerald-200 group-hover:bg-emerald-50 text-emerald-700">
                                Order Parts <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* My Inventory Card */}
                <Card className="border-0 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-400"></div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="bg-cyan-50 p-2 rounded-lg">
                                <Box className="h-6 w-6 text-cyan-600" />
                            </div>
                        </div>
                        <CardTitle className="text-lg font-semibold mt-2 text-gray-800">My Inventory</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">View and manage your spare parts</p>
                        <Link to={createPageUrl('PortalInventory')} className="w-full block">
                            <Button variant="outline" className="w-full group-hover:border-cyan-200 group-hover:bg-cyan-50 text-cyan-700">
                                View Inventory <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* In-House Service Card */}
                <Card className="border-0 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-400"></div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="bg-amber-50 p-2 rounded-lg">
                                <Wrench className="h-6 w-6 text-amber-600" />
                            </div>
                        </div>
                        <CardTitle className="text-lg font-semibold mt-2 text-gray-800">In-House Service</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">Log maintenance using your spare parts</p>
                        <Link to={createPageUrl('PortalInventory') + '?action=log'} className="w-full block">
                            <Button variant="outline" className="w-full group-hover:border-amber-200 group-hover:bg-amber-50 text-amber-700">
                                Log Service <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Service History Report Card */}
                <Card className="border-0 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-400"></div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="bg-indigo-50 p-2 rounded-lg">
                                <History className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-gray-800">{machines.length}</div>
                                <span className="text-xs text-gray-400">Machines</span>
                            </div>
                        </div>
                        <CardTitle className="text-lg font-semibold mt-2 text-gray-800">Service History Report</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">View service history for your machines</p>
                        <Link to={createPageUrl('PortalHistory')} className="w-full block">
                            <Button variant="outline" className="w-full group-hover:border-indigo-200 group-hover:bg-indigo-50 text-indigo-700">
                                View History <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Knowledge Base Card */}
                <Card className="border-0 shadow-lg overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                    <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-400"></div>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="bg-purple-50 p-2 rounded-lg">
                                <BookOpen className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                        <CardTitle className="text-lg font-semibold mt-2 text-gray-800">Knowledge Base</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">Access manuals, guides, and videos</p>
                        <Link to={createPageUrl('KnowledgeBase')} className="w-full block">
                            <Button variant="outline" className="w-full group-hover:border-purple-200 group-hover:bg-purple-50 text-purple-700">
                                Browse Library <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}