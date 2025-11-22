
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Wrench, Package, ClipboardList, BarChart3, Smartphone, Users, DollarSign } from 'lucide-react';
import { COMPANY_LOGO_URL } from '@/components/constants';
import { base44 } from '@/api/base44Client';

export default function Home() {
    const handleGetStarted = async () => {
        // Check if user is already logged in
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
            // Already logged in, go to app
            window.location.href = '/overview';
        } else {
            // Not logged in, redirect to login/signup
            base44.auth.redirectToLogin('/overview');
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                                Streamline Your Field Service Operations
                            </h1>
                            <p className="text-xl md:text-2xl text-blue-100">
                                Manage inventory, service calls, tickets, and quotes effortlessly. Built for small equipment service businesses.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button 
                                    size="lg" 
                                    className="w-full sm:w-auto bg-white text-blue-700 hover:bg-blue-50 text-lg px-8 py-6"
                                    onClick={handleGetStarted}
                                >
                                    Start Free 30-Day Trial
                                </Button>
                                <a href="/features">
                                    <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white/10 text-lg px-8 py-6">
                                        Explore Features
                                    </Button>
                                </a>
                            </div>
                            <div className="flex items-center gap-2 text-blue-100">
                                <Check className="w-5 h-5" />
                                <span>No credit card required • Unlimited users • Full mobile access</span>
                            </div>
                        </div>
                        <div className="hidden lg:block">
                            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-2xl">
                                <img 
                                    src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80" 
                                    alt="FieldCalls Dashboard" 
                                    className="rounded-lg shadow-xl"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Indicators */}
            <section className="border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-3xl font-bold text-blue-600">$14/mo</div>
                            <div className="text-gray-600 mt-1">Simple Pricing</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-blue-600">∞</div>
                            <div className="text-gray-600 mt-1">Unlimited Users</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-blue-600">30 Days</div>
                            <div className="text-gray-600 mt-1">Free Trial</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-blue-600">100%</div>
                            <div className="text-gray-600 mt-1">Mobile Ready</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Key Features Section */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">
                            Everything You Need to Run Your Business
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            From the first customer call to final invoice, FieldCalls handles every step of your field service workflow.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <Card className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                    <Package className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Smart Inventory Management</h3>
                                <p className="text-gray-600">
                                    Track parts from purchase to sale. Manage stock levels, reorder alerts, and assembly kits with virtual inventory.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                    <ClipboardList className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Support Tickets & Service Calls</h3>
                                <p className="text-gray-600">
                                    Create tickets, assign technicians, track time and expenses. Seamlessly convert tickets to service calls or parts orders.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                    <Wrench className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">On-Site Service Tracking</h3>
                                <p className="text-gray-600">
                                    Log parts used, track technician hours (travel & on-site), and record all expenses in real-time from the field.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                    <BarChart3 className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Business Intelligence</h3>
                                <p className="text-gray-600">
                                    Real-time reports on customer value, part usage, technician performance, and inventory trends.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                    <Smartphone className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Full Mobile Access</h3>
                                <p className="text-gray-600">
                                    Your field technicians get full functionality on any device. Update service calls, check inventory, and more.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Unlimited Team Members</h3>
                                <p className="text-gray-600">
                                    Add your entire team at no extra cost. Office staff, field technicians, managers – everyone stays connected.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">
                            Simple Workflow, Powerful Results
                        </h2>
                        <p className="text-xl text-gray-600">
                            FieldCalls automates your processes so you can focus on serving customers.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                                1
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Receive Request</h3>
                            <p className="text-gray-600">Customer calls or submits a service ticket through your system.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                                2
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Assign & Dispatch</h3>
                            <p className="text-gray-600">Assign technician, check part availability, and send them to the field.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                                3
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Complete Service</h3>
                            <p className="text-gray-600">Technician logs parts used, time spent, and completes the job on mobile.</p>
                        </div>

                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                                4
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Analyze & Improve</h3>
                            <p className="text-gray-600">Review reports to optimize inventory, pricing, and technician efficiency.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 bg-blue-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-4xl font-bold text-gray-900 mb-6">
                                Why Small Businesses Choose FieldCalls
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">No More Double Entry</h3>
                                        <p className="text-gray-600">Data flows seamlessly from tickets to service calls to invoices. Enter information once.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">Predictable, Affordable Pricing</h3>
                                        <p className="text-gray-600">$14/month for your entire team. No hidden fees, no per-user charges, no surprises.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">Complete Service History</h3>
                                        <p className="text-gray-600">Track every part used, every service call, every expense for each customer and machine.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">Works Anywhere</h3>
                                        <p className="text-gray-600">Your technicians have full access from tablets or phones, even in the field with spotty coverage.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">Data You Can Trust</h3>
                                        <p className="text-gray-600">Make informed decisions with real-time insights into your most profitable customers and parts.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-8 shadow-xl">
                            <img 
                                src="https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800&q=80" 
                                alt="Team collaboration" 
                                className="rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing CTA */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-12 text-white">
                        <div className="flex items-center justify-center mb-6">
                            <DollarSign className="w-16 h-16" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
                        <div className="text-6xl font-bold mb-2">$14<span className="text-2xl font-normal">/month</span></div>
                        <p className="text-xl text-blue-100 mb-8">Unlimited users • All features included • No contracts</p>
                        <a href="https://app.fieldcalls.com/signup">
                            <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 text-lg px-8 py-6">
                                Start Your Free 30-Day Trial
                            </Button>
                        </a>
                        <p className="text-sm text-blue-100 mt-4">No credit card required • Cancel anytime</p>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-gray-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Field Service Business?</h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Join small businesses who are streamlining operations and growing with FieldCalls.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="https://app.fieldcalls.com/signup">
                            <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
                                Start Free Trial
                            </Button>
                        </a>
                        <a href="/pricing">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white/10 text-lg px-8 py-6">
                                View Pricing
                            </Button>
                        </a>
                    </div>
                </div>
            </section>
        </div>
    );
}
