import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Crown, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Upgrade() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [daysRemaining, setDaysRemaining] = useState(null);

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const userData = await base44.auth.me();
            setUser(userData);

            if (userData?.trial_end_date) {
                const endDate = new Date(userData.trial_end_date);
                const today = new Date();
                const diffTime = endDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                setDaysRemaining(diffDays);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async () => {
        setProcessing(true);
        try {
            // Replace with your actual Stripe Price ID from your Stripe dashboard
            const STRIPE_PRICE_ID = 'price_1SMNTh3RVH6hsEgQHVeHvNRU'; // TODO: Replace with your actual price ID
            
            const response = await base44.functions.invoke('createCheckoutSession', {
                priceId: STRIPE_PRICE_ID
            });

            if (response.data.url) {
                // Redirect to Stripe Checkout
                window.location.href = response.data.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (error) {
            console.error('Upgrade error:', error);
            alert('Failed to start checkout. Please try again or contact support.');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const isExpired = daysRemaining !== null && daysRemaining <= 0;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
                    <Crown className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Upgrade to FieldCalls Pro
                </h1>
                <p className="text-xl text-gray-600">
                    {isExpired 
                        ? 'Your trial has ended. Upgrade now to continue using FieldCalls.'
                        : `You have ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining in your trial.`
                    }
                </p>
            </div>

            {user?.subscription_status === 'active' && (
                <Alert className="mb-8 bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                        You're already subscribed to FieldCalls Pro! Enjoy all features.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-8 mb-12">
                {/* Current Plan (Free Trial) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Free Trial</CardTitle>
                        <CardDescription>What you're currently using</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-3xl font-bold">$0</div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span>30 days of full access</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span>All features included</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span>Unlimited users</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <span>Mobile app access</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Pro Plan */}
                <Card className="border-2 border-blue-500 relative">
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1 rounded-bl-lg rounded-tr-lg text-sm font-semibold flex items-center gap-1">
                        <Sparkles className="w-4 h-4" />
                        RECOMMENDED
                    </div>
                    <CardHeader>
                        <CardTitle className="text-blue-600">FieldCalls Pro</CardTitle>
                        <CardDescription>Everything you need, forever</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="text-4xl font-bold text-blue-600">$14</div>
                            <div className="text-gray-600">per month</div>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span className="font-semibold">Everything in Free Trial, plus:</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span>Unlimited customers & machines</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span>Unlimited parts & inventory</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span>Unlimited transactions</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span>Priority support</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <span>No commitments - cancel anytime</span>
                            </li>
                        </ul>
                        <Button 
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" 
                            size="lg"
                            onClick={handleUpgrade}
                            disabled={processing || user?.subscription_status === 'active'}
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : user?.subscription_status === 'active' ? (
                                'Already Subscribed'
                            ) : (
                                'Upgrade Now'
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* FAQ Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-2">Can I really add unlimited users?</h3>
                        <p className="text-gray-600">
                            Yes! Add your entire team – technicians, office staff, managers, dispatchers. No per-user fees, ever.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">What happens if I cancel?</h3>
                        <p className="text-gray-600">
                            You can cancel anytime. You'll continue to have access until the end of your billing period, and your data will be preserved for 30 days.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Is my data secure?</h3>
                        <p className="text-gray-600">
                            Absolutely. We use enterprise-grade security with encrypted data transmission and storage. Your data is backed up regularly.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                        <p className="text-gray-600">
                            We offer a 30-day free trial, so you can try everything before committing. If you have issues after subscribing, contact our support team.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}