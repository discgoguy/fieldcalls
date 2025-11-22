import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MessageSquare } from 'lucide-react';

export default function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        message: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        // TODO: Implement form submission logic
        alert('Thank you for your message! We\'ll get back to you soon.');
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Hero */}
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-5xl font-bold mb-6">Get in Touch</h1>
                    <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                        Have questions? Need a demo? Want to discuss enterprise options? We're here to help.
                    </p>
                </div>
            </section>

            {/* Contact Options */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* Contact Form */}
                        <div>
                            <h2 className="text-3xl font-bold mb-6">Send Us a Message</h2>
                            <Card>
                                <CardContent className="p-6">
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <Label htmlFor="name">Name *</Label>
                                            <Input 
                                                id="name" 
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                required 
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="email">Email *</Label>
                                            <Input 
                                                id="email" 
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                required 
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="company">Company</Label>
                                            <Input 
                                                id="company"
                                                value={formData.company}
                                                onChange={(e) => setFormData({...formData, company: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="message">Message *</Label>
                                            <Textarea 
                                                id="message" 
                                                rows={6}
                                                value={formData.message}
                                                onChange={(e) => setFormData({...formData, message: e.target.value})}
                                                required 
                                            />
                                        </div>
                                        <Button type="submit" className="w-full" size="lg">
                                            Send Message
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-6">Other Ways to Reach Us</h2>
                                <div className="space-y-6">
                                    <Card>
                                        <CardContent className="p-6 flex items-start gap-4">
                                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Mail className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg mb-1">Email Us</h3>
                                                <p className="text-gray-600 mb-2">
                                                    For general inquiries and support
                                                </p>
                                                <a href="mailto:support@fieldcalls.com" className="text-blue-600 hover:underline">
                                                    support@fieldcalls.com
                                                </a>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-6 flex items-start gap-4">
                                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <MessageSquare className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg mb-1">Live Chat</h3>
                                                <p className="text-gray-600 mb-2">
                                                    Chat with our team in real-time
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    Available Monday - Friday, 9am - 5pm EST
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardContent className="p-6 flex items-start gap-4">
                                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Phone className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg mb-1">Call Us</h3>
                                                <p className="text-gray-600 mb-2">
                                                    For enterprise inquiries
                                                </p>
                                                <a href="tel:+1234567890" className="text-blue-600 hover:underline">
                                                    +1 (234) 567-890
                                                </a>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-6">
                                <h3 className="font-semibold text-lg mb-2">Looking for Support?</h3>
                                <p className="text-gray-600 mb-4">
                                    If you're an existing customer and need technical support, please login to your account and use the support chat feature for faster assistance.
                                </p>
                                <a href="https://app.fieldcalls.com">
                                    <Button variant="outline">Login to Support</Button>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold mb-4">Ready to Try FieldCalls?</h2>
                    <p className="text-xl text-gray-600 mb-8">
                        Start your free 30-day trial today. No credit card required.
                    </p>
                    <a href="https://app.fieldcalls.com/signup">
                        <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                            Start Free Trial
                        </Button>
                    </a>
                </div>
            </section>
        </div>
    );
}