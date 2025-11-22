import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, UserPlus } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function AcceptInvitation() {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [invitation, setInvitation] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [token, setToken] = useState('');

    useEffect(() => {
        console.log('🎯 AcceptInvitation PAGE LOADED');
        console.log('📍 Current URL:', window.location.href);
        console.log('📍 Hash:', window.location.hash);
        console.log('📍 Search:', window.location.search);
        
        const loadInvitationAndAccept = async () => {
            try {
                // Get token from URL - handle both hash-based and regular routing
                let invitationToken = null;
                
                // Try getting from hash fragment first (for hash-based routing like /#/AcceptInvitation?token=...)
                const hash = window.location.hash;
                if (hash.includes('?')) {
                    const hashParams = new URLSearchParams(hash.split('?')[1]);
                    invitationToken = hashParams.get('token');
                }
                
                // Fallback to regular query string
                if (!invitationToken) {
                    const urlParams = new URLSearchParams(window.location.search);
                    invitationToken = urlParams.get('token');
                }
                
                console.log('🔑 Extracted token:', invitationToken);
                
                if (!invitationToken) {
                    setError('Invalid invitation link - no token provided');
                    setLoading(false);
                    return;
                }

                setToken(invitationToken);

                // Check if user is authenticated
                const isAuth = await base44.auth.isAuthenticated();
                console.log('🔐 Is authenticated:', isAuth);
                
                if (!isAuth) {
                    setError('Please log in or create an account to accept this invitation.');
                    setLoading(false);
                    return;
                }

                // Load invitation details to show who invited them
                try {
                    const invitations = await base44.entities.TenantInvite.list();
                    const invite = invitations.find(inv => 
                        inv.invitation_token === invitationToken && 
                        inv.status === 'pending'
                    );
                    
                    if (invite) {
                        console.log('✅ Found invitation:', invite);
                        setInvitation(invite);
                        // Automatically accept the invitation after a brief delay
                        setTimeout(() => {
                            handleAcceptInvitation(invitationToken);
                        }, 1000);
                    } else {
                        console.error('❌ Invitation not found');
                        setError('This invitation is invalid, has already been accepted, or has expired.');
                        setLoading(false);
                    }
                } catch (e) {
                    console.error('❌ Could not load invitation details:', e);
                    setError('Failed to load invitation details.');
                    setLoading(false);
                }

            } catch (e) {
                console.error('💥 Error:', e);
                setError('Failed to process invitation');
                setLoading(false);
            }
        };

        loadInvitationAndAccept();
    }, []);

    const handleAcceptInvitation = async (tokenToUse) => {
        console.log('🚀 Accepting invitation...');
        setProcessing(true);
        setError('');
        setSuccess('');

        try {
            const response = await base44.functions.invoke('acceptInvitation', {
                invitation_token: tokenToUse || token
            });

            console.log('📨 Backend response:', response.data);

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            setSuccess(response.data.message || 'Invitation accepted! Redirecting...');
            
            // Redirect to the app after 2 seconds
            setTimeout(() => {
                console.log('🎯 Redirecting to Overview...');
                window.location.href = createPageUrl('Overview');
            }, 2000);
        } catch (e) {
            console.error('❌ Failed to accept invitation:', e);
            setError(e.message || 'Failed to accept invitation');
            setProcessing(false);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                <UserPlus className="w-8 h-8 text-blue-600" />
                            </div>
                        </div>
                        <CardTitle className="text-center">Team Invitation</CardTitle>
                        <CardDescription className="text-center">
                            {invitation ? 
                                `Join ${invitation.company_name}` : 
                                'Processing your invitation...'
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading && !error && !success && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                                <p className="text-sm text-gray-600">Loading invitation details...</p>
                            </div>
                        )}

                        {processing && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                                <p className="text-sm text-gray-600">Accepting invitation...</p>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {success && (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-900">Success!</AlertTitle>
                                <AlertDescription className="text-green-800">{success}</AlertDescription>
                            </Alert>
                        )}

                        {invitation && !processing && !success && !error && (
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Company:</span>
                                        <span className="text-sm font-semibold">{invitation.company_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Invited by:</span>
                                        <span className="text-sm font-semibold">{invitation.inviter_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Your email:</span>
                                        <span className="text-sm font-semibold">{invitation.email}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Role:</span>
                                        <span className="text-sm font-semibold capitalize">{invitation.intended_role}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}