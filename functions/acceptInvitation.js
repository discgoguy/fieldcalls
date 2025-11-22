import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log('🚀 ACCEPT INVITATION FUNCTION CALLED');
    
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Get the authenticated user
        const user = await base44.auth.me();
        if (!user) {
            console.error('❌ No user authenticated');
            return Response.json({ error: 'You must be logged in to accept an invitation' }, { status: 401 });
        }

        console.log('👤 User accepting invitation:', user.email);

        // 2. Parse request body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error('❌ Failed to parse request body:', e);
            return Response.json({ 
                error: 'Invalid request body' 
            }, { status: 400 });
        }

        const { invitation_token } = body;

        if (!invitation_token) {
            console.error('❌ No invitation token provided');
            return Response.json({ 
                error: 'Invitation token is required' 
            }, { status: 400 });
        }

        console.log('🔍 Looking for invitation with token:', invitation_token);

        // 3. Find the invitation using service role (since new users might not have tenant access yet)
        const allInvitations = await base44.asServiceRole.entities.TenantInvite.list();
        const invitation = allInvitations.find(inv => 
            inv.invitation_token === invitation_token && 
            inv.status === 'pending'
        );

        if (!invitation) {
            console.error('❌ Invitation not found or already used');
            return Response.json({ 
                error: 'This invitation is invalid, has already been accepted, or has expired' 
            }, { status: 404 });
        }

        console.log('✅ Found invitation:', invitation.id);

        // 4. Verify the invitation is for this user's email
        if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
            console.error('❌ Email mismatch:', invitation.email, 'vs', user.email);
            return Response.json({ 
                error: 'This invitation was sent to a different email address' 
            }, { status: 403 });
        }

        // 5. Check if invitation has expired
        if (invitation.expires_at) {
            const expiryDate = new Date(invitation.expires_at);
            const now = new Date();
            if (now > expiryDate) {
                console.error('❌ Invitation expired');
                await base44.asServiceRole.entities.TenantInvite.update(invitation.id, { 
                    status: 'expired' 
                });
                return Response.json({ 
                    error: 'This invitation has expired' 
                }, { status: 410 });
            }
        }

        console.log('➕ Adding user to tenant:', invitation.tenant_id);

        // 6. Update the user with tenant information
        await base44.asServiceRole.entities.User.update(user.id, {
            tenant_id: invitation.tenant_id,
            company_name: invitation.company_name,
            role: invitation.intended_role || 'user'
        });

        console.log('✅ User updated with tenant info');

        // 7. Mark invitation as accepted
        await base44.asServiceRole.entities.TenantInvite.update(invitation.id, {
            status: 'accepted'
        });

        console.log('✅ Invitation marked as accepted');

        // 8. Send welcome email (optional, but nice)
        try {
            await base44.asServiceRole.integrations.Core.SendEmail({
                from_name: invitation.company_name || 'FieldCalls',
                to: user.email,
                subject: `Welcome to ${invitation.company_name}!`,
                body: `Hi ${invitation.full_name},\n\nYou've successfully joined ${invitation.company_name} on FieldCalls!\n\nYou can now access your team's workspace and start collaborating.\n\nBest regards,\nThe FieldCalls Team`
            });
            console.log('✅ Welcome email sent');
        } catch (emailError) {
            console.error('⚠️ Failed to send welcome email:', emailError);
            // Don't fail the whole operation if email fails
        }

        console.log('🎉 Invitation accepted successfully');

        return Response.json({ 
            success: true,
            message: `Welcome to ${invitation.company_name}!`,
            tenant_id: invitation.tenant_id,
            company_name: invitation.company_name
        });

    } catch (error) {
        console.error('💥 ERROR:', error);
        return Response.json({ 
            error: error?.message || 'Failed to accept invitation',
            details: String(error)
        }, { status: 500 });
    }
});