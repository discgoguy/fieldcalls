import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Sparkles, UserPlus } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function InitializeTrial() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [pendingInvitation, setPendingInvitation] = useState(null);
    const [autoAccepting, setAutoAccepting] = useState(false);

    useEffect(() => {
        checkForInvitationAndLoadUser();
    }, []);

    const checkForInvitationAndLoadUser = async () => {
        try {
            const userData = await base44.auth.me();
            setUser(userData);
            
            // CRITICAL: If user already has a tenant_id, they shouldn't be here
            // Redirect them to Overview immediately
            if (userData?.tenant_id) {
                console.log('✅ User already has tenant_id, redirecting to Overview...');
                window.location.href = createPageUrl('Overview');
                return;
            }

            // Use backend function to check for pending invitations
            const response = await base44.functions.invoke('checkPendingInvitation');

            if (response.data.hasPendingInvitation && response.data.invitation) {
                console.log('🎉 Found pending invitation!', response.data.invitation);
                setPendingInvitation(response.data.invitation);
                setCompanyName(response.data.invitation.company_name);
                
                // Automatically accept the invitation
                setTimeout(() => {
                    handleAcceptInvitation(response.data.invitation);
                }, 1000);
            } else {
                console.log('📝 No pending invitation, showing trial initialization form');
                
                if (userData.company_name) {
                    setCompanyName(userData.company_name);
                }
            }
        } catch (e) {
            console.error('❌ Error loading user or checking invitations:', e);
            setError('Failed to load user data: ' + (e.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptInvitation = async (invitation) => {
        console.log('🚀 Auto-accepting invitation...');
        setAutoAccepting(true);
        setError('');
        setSuccess('');

        try {
            const response = await base44.functions.invoke('acceptInvitation', {
                invitation_token: invitation.invitation_token
            });

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setSuccess(`Welcome to ${invitation.company_name}! Redirecting...`);
            
            // Reload the page to refresh user data with new tenant_id
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (e) {
            console.error('❌ Failed to accept invitation:', e);
            setError('Failed to accept invitation: ' + (e.message || 'Unknown error'));
            setAutoAccepting(false);
        }
    };

    const handleInitializeTrial = async (e) => {
        e.preventDefault();
        
        if (!companyName.trim()) {
            setError('Please enter your company name');
            return;
        }

        setIsInitializing(true);
        setError('');
        setSuccess('');

        try {
            const response = await base44.functions.invoke('initializeTrial', {
                company_name: companyName.trim()
            });
            
            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setSuccess('Trial activated! Redirecting...');
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (e) {
            console.error('💥 ERROR:', e);
            setError(`Failed: ${e.message}`);
            setIsInitializing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="text-sm text-gray-600">Loading...</p>
            </div>
        );
    }

    // If auto-accepting invitation
    if (autoAccepting && pendingInvitation) {
        return (
            <div className="max-w-2xl mx-auto mt-8 p-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                <UserPlus className="w-8 h-8 text-blue-600" />
                            </div>
                        </div>
                        <CardTitle className="text-center">Accepting Invitation</CardTitle>
                        <CardDescription className="text-center">
                            Joining {pendingInvitation.company_name}...
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                            <p className="text-sm text-gray-600">Processing your invitation...</p>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800">{success}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto mt-8 p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Sparkles className="mr-2 h-6 w-6 text-blue-600" />
                        Initialize Your Trial
                    </CardTitle>
                    <CardDescription>
                        Start your 30-day free trial of FieldCalls
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="mb-4 bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">{success}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleInitializeTrial} className="space-y-6">
                        <div>
                            <Label htmlFor="companyName">Company Name *</Label>
                            <Input
                                id="companyName"
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Enter your company name"
                                required
                                disabled={isInitializing}
                            />
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="text-sm text-gray-700">
                                <strong>Email:</strong> {user?.email}
                            </p>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={isInitializing || !companyName.trim()} 
                            className="w-full"
                            size="lg"
                        >
                            {isInitializing ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Initializing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-5 w-5" />
                                    Start My Free Trial
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}