import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X } from 'lucide-react';

export default function Pricing() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero */}
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-5xl font-bold mb-6">Simple, Transparent Pricing</h1>
                    <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                        One plan with everything included. No hidden fees, no per-user charges, no surprises.
                    </p>
                </div>
            </section>

            {/* Pricing Card */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Free Trial */}
                        <Card className="border-2">
                            <CardContent className="p-8">
                                <h3 className="text-2xl font-bold mb-4">Free Trial</h3>
                                <div className="mb-6">
                                    <span className="text-5xl font-bold">$0</span>
                                    <span className="text-gray-600">/30 days</span>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Full access to all features</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Unlimited users</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Mobile app access</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>No credit card required</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Cancel anytime</span>
                                    </li>
                                </ul>
                                <a href="https://app.fieldcalls.com/signup" className="block">
                                    <Button variant="outline" className="w-full" size="lg">
                                        Start Free Trial
                                    </Button>
                                </a>
                            </CardContent>
                        </Card>

                        {/* Pro Plan - Highlighted */}
                        <Card className="border-4 border-blue-600 relative lg:scale-105 shadow-xl">
                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                                    MOST POPULAR
                                </span>
                            </div>
                            <CardContent className="p-8">
                                <h3 className="text-2xl font-bold mb-4">Pro</h3>
                                <div className="mb-6">
                                    <span className="text-5xl font-bold">$14</span>
                                    <span className="text-gray-600">/month</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-6">Billed monthly, cancel anytime</p>
                                <ul className="space-y-3 mb-8">
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span className="font-semibold">Everything in Free Trial, plus:</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Unlimited customers & machines</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Unlimited parts & inventory</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Unlimited transactions</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Priority email support</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Data backup & export</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Regular feature updates</span>
                                    </li>
                                </ul>
                                <a href="https://app.fieldcalls.com/signup" className="block">
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                                        Start Free Trial
                                    </Button>
                                </a>
                            </CardContent>
                        </Card>

                        {/* Enterprise (Contact Sales) */}
                        <Card className="border-2">
                            <CardContent className="p-8">
                                <h3 className="text-2xl font-bold mb-4">Enterprise</h3>
                                <div className="mb-6">
                                    <span className="text-5xl font-bold">Custom</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-6">For larger organizations</p>
                                <ul className="space-y-3 mb-8">
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span className="font-semibold">Everything in Pro, plus:</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Dedicated account manager</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Custom integrations</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>On-site training</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>SLA guarantee</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>Priority phone support</span>
                                    </li>
                                </ul>
                                <a href="/contact" className="block">
                                    <Button variant="outline" className="w-full" size="lg">
                                        Contact Sales
                                    </Button>
                                </a>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Comparison Table */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center mb-12">Feature Comparison</h2>
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left p-4 font-semibold">Feature</th>
                                    <th className="text-center p-4 font-semibold">Free Trial</th>
                                    <th className="text-center p-4 font-semibold bg-blue-50">Pro</th>
                                    <th className="text-center p-4 font-semibold">Enterprise</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                <tr>
                                    <td className="p-4">Unlimited Users</td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Mobile App Access</td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Inventory Management</td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Service Tickets & Calls</td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Quotes & Purchase Orders</td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Reports & Analytics</td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Data Backup & Export</td>
                                    <td className="text-center p-4"><X className="w-5 h-5 text-gray-300 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Email Support</td>
                                    <td className="text-center p-4">Standard</td>
                                    <td className="text-center p-4 bg-blue-50">Priority</td>
                                    <td className="text-center p-4">Priority + Phone</td>
                                </tr>
                                <tr>
                                    <td className="p-4">Dedicated Account Manager</td>
                                    <td className="text-center p-4"><X className="w-5 h-5 text-gray-300 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><X className="w-5 h-5 text-gray-300 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="p-4">Custom Integrations</td>
                                    <td className="text-center p-4"><X className="w-5 h-5 text-gray-300 mx-auto" /></td>
                                    <td className="text-center p-4 bg-blue-50"><X className="w-5 h-5 text-gray-300 mx-auto" /></td>
                                    <td className="text-center p-4"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Do I need a credit card to start the free trial?</h3>
                            <p className="text-gray-600">
                                No! You can start your 30-day free trial without entering any payment information. We'll only ask for payment details if you decide to continue after the trial.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Can I really add unlimited users?</h3>
                            <p className="text-gray-600">
                                Yes. Whether you have 2 users or 200, the price stays the same. Add your entire team – technicians, dispatchers, office staff, and managers.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-2">What happens after the 30-day trial?</h3>
                            <p className="text-gray-600">
                                We'll send you reminders as your trial approaches its end. If you'd like to continue, simply enter your payment information. If not, your account will be paused (we don't delete your data immediately).
                            </p>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Can I cancel anytime?</h3>
                            <p className="text-gray-600">
                                Absolutely. There are no long-term contracts. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Is my data secure?</h3>
                            <p className="text-gray-600">
                                Yes. We use enterprise-grade security with encrypted data transmission and storage. Your data is backed up regularly and is never shared with third parties.
                            </p>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Do you offer discounts for annual billing?</h3>
                            <p className="text-gray-600">
                                Currently, we offer monthly billing at $14/month. Annual billing options may be available in the future. Contact us if you're interested in annual billing.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Join field service businesses who are growing with FieldCalls.
                    </p>
                    <a href="https://app.fieldcalls.com/signup">
                        <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 text-lg px-8 py-6">
                            Start Your Free 30-Day Trial
                        </Button>
                    </a>
                    <p className="text-sm text-blue-100 mt-4">No credit card required • Setup in minutes</p>
                </div>
            </section>
        </div>
    );
}