import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log('🔍 CHECK PENDING INVITATION FUNCTION CALLED');
    
    try {
        const base44 = createClientFromRequest(req);
        
        // Get the authenticated user
        const user = await base44.auth.me();
        if (!user) {
            console.error('❌ No user authenticated');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('👤 Checking for invitations for:', user.email);

        // Use service role to search for pending invitations (user might not have tenant access yet)
        const allInvitations = await base44.asServiceRole.entities.TenantInvite.list();
        console.log(`📊 Total invitations in system: ${allInvitations.length}`);
        
        // Log all pending invitations for debugging
        const pendingInvitations = allInvitations.filter(inv => inv.status === 'pending');
        console.log(`📋 Pending invitations: ${pendingInvitations.length}`);
        pendingInvitations.forEach(inv => {
            console.log(`  - Email: ${inv.email}, Company: ${inv.company_name}, Status: ${inv.status}`);
        });

        const pendingInvitation = allInvitations.find(inv => 
            inv.email.toLowerCase().trim() === user.email.toLowerCase().trim() && 
            inv.status === 'pending'
        );

        if (pendingInvitation) {
            console.log('✅ Found pending invitation:', pendingInvitation.id);
            
            // Check if invitation has expired
            if (pendingInvitation.expires_at) {
                const expiryDate = new Date(pendingInvitation.expires_at);
                const now = new Date();
                if (now > expiryDate) {
                    console.log('⚠️ Invitation has expired');
                    await base44.asServiceRole.entities.TenantInvite.update(pendingInvitation.id, { 
                        status: 'expired' 
                    });
                    return Response.json({ 
                        hasPendingInvitation: false,
                        reason: 'expired',
                        debugInfo: {
                            userEmail: user.email,
                            totalInvitations: allInvitations.length,
                            pendingInvitations: pendingInvitations.length,
                            foundButExpired: true
                        }
                    });
                }
            }

            return Response.json({ 
                hasPendingInvitation: true,
                invitation: {
                    id: pendingInvitation.id,
                    invitation_token: pendingInvitation.invitation_token,
                    company_name: pendingInvitation.company_name,
                    inviter_name: pendingInvitation.inviter_name,
                    intended_role: pendingInvitation.intended_role
                },
                debugInfo: {
                    userEmail: user.email,
                    totalInvitations: allInvitations.length,
                    pendingInvitations: pendingInvitations.length
                }
            });
        }

        console.log('📝 No pending invitation found for user:', user.email);
        return Response.json({ 
            hasPendingInvitation: false,
            debugInfo: {
                userEmail: user.email,
                totalInvitations: allInvitations.length,
                pendingInvitations: pendingInvitations.length,
                pendingEmails: pendingInvitations.map(inv => inv.email)
            }
        });

    } catch (error) {
        console.error('💥 ERROR:', error);
        return Response.json({ 
            error: error?.message || 'Failed to check for invitations',
            details: String(error)
        }, { status: 500 });
    }
});