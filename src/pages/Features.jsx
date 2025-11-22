import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
    Package, ClipboardList, Wrench, BarChart3, Smartphone, Users, 
    ShoppingCart, FileText, CheckCircle, Clock, DollarSign, TrendingUp,
    Search, Database, Calendar, Truck, AlertTriangle, Settings
} from 'lucide-react';

export default function Features() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero */}
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-5xl font-bold mb-6">Everything You Need in One Platform</h1>
                    <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                        FieldCalls brings together inventory management, service tracking, customer relations, and business intelligence in one powerful, easy-to-use system.
                    </p>
                </div>
            </section>

            {/* Inventory Management */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <Package className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4">Advanced Inventory Management</h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Never run out of critical parts or overstock slow-moving items. Smart inventory tracking keeps you profitable.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <Card>
                            <CardContent className="p-6">
                                <Database className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Real-Time Stock Levels</h3>
                                <p className="text-gray-600">
                                    Automatically track inventory as parts are used in service calls or shipped to customers. Always know what's in stock.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <AlertTriangle className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Reorder Alerts</h3>
                                <p className="text-gray-600">
                                    Set minimum stock levels for each part. Get notified when it's time to reorder before you run out.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Settings className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Assembly & Kit Management</h3>
                                <p className="text-gray-600">
                                    Create assemblies from component parts with virtual inventory. Automatically deduct components when kits are used.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <ShoppingCart className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Purchase Order Management</h3>
                                <p className="text-gray-600">
                                    Create POs, track shipments, and receive items directly into inventory. Multi-currency support for international suppliers.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Search className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Smart Part Search</h3>
                                <p className="text-gray-600">
                                    Find parts instantly by name, number, category, or machine compatibility. Filter and sort your entire inventory.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <TrendingUp className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Dynamic Pricing</h3>
                                <p className="text-gray-600">
                                    Automatically calculate sales prices with markup percentages. Update costs and markups flow through instantly.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Service & Tickets */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <Wrench className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4">Complete Service Management</h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            From the first customer call to service completion, manage every aspect of your field operations.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <Card>
                            <CardContent className="p-6">
                                <ClipboardList className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Support Ticketing System</h3>
                                <p className="text-gray-600">
                                    Create, assign, and track service tickets. Set urgency levels, add notes, and maintain complete communication history.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Wrench className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">On-Site Service Tracking</h3>
                                <p className="text-gray-600">
                                    Log parts used, track technician time (travel & on-site), and record all expenses directly from the field.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Clock className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Time & Expense Tracking</h3>
                                <p className="text-gray-600">
                                    Track travel hours, on-site hours, kilometers, meals, hotels, and tolls. Per-technician expense breakdown included.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Calendar className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Maintenance Scheduling</h3>
                                <p className="text-gray-600">
                                    Create maintenance checklists and templates. Schedule preventive maintenance visits and track completion.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <FileText className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Quote Generation</h3>
                                <p className="text-gray-600">
                                    Create professional quotes with line items, taxes, and terms. Track quote status from draft to accepted.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <CheckCircle className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Seamless Conversions</h3>
                                <p className="text-gray-600">
                                    Convert tickets to service calls or parts orders with one click. Data flows automatically – no re-entering information.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Mobile & Collaboration */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <Smartphone className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4">Mobile-First Design</h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Your team has full access from any device, anywhere. Office, field, or on the road – FieldCalls works perfectly.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Smartphone className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Full Mobile Functionality</h3>
                                    <p className="text-gray-600">
                                        Technicians can create service calls, log parts, check inventory, and view customer history from their phones or tablets.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Unlimited Team Members</h3>
                                    <p className="text-gray-600">
                                        Add everyone – technicians, office staff, managers, dispatchers. No per-user fees, ever.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Database className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Real-Time Sync</h3>
                                    <p className="text-gray-600">
                                        Changes made in the field appear instantly in the office. Everyone works with the same up-to-date information.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8">
                            <img 
                                src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80" 
                                alt="Mobile device" 
                                className="rounded-lg shadow-xl"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Reports & Analytics */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <BarChart3 className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4">Actionable Business Intelligence</h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Make data-driven decisions with comprehensive reports and real-time analytics.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <Card>
                            <CardContent className="p-6">
                                <TrendingUp className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Sales Activity</h3>
                                <p className="text-gray-600">Track revenue trends over time with visual charts.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Users className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Customer Value</h3>
                                <p className="text-gray-600">Identify your most profitable customers and focus your efforts.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Package className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Top Parts</h3>
                                <p className="text-gray-600">See which parts generate the most revenue and margin.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Wrench className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Technician Performance</h3>
                                <p className="text-gray-600">Analyze efficiency, revenue generated, and service call metrics.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <DollarSign className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Inventory Value</h3>
                                <p className="text-gray-600">Track total inventory value and trends over time.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <Settings className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Machine History</h3>
                                <p className="text-gray-600">View complete service history and part usage per machine.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <FileText className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Transaction Log</h3>
                                <p className="text-gray-600">Filter and export all transactions for accounting or audits.</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <BarChart3 className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Custom Date Ranges</h3>
                                <p className="text-gray-600">Analyze any time period with flexible date range selection.</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Try FieldCalls free for 30 days. No credit card required.
                    </p>
                    <a href="https://app.fieldcalls.com/signup">
                        <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 text-lg px-8 py-6">
                            Start Your Free Trial
                        </Button>
                    </a>
                </div>
            </section>
        </div>
    );
}