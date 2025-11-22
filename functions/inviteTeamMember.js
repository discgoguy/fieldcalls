import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log('🚀 INVITE TEAM MEMBER FUNCTION CALLED');
    
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Authenticate the requesting user
        const inviter = await base44.auth.me();
        if (!inviter) {
            console.error('❌ No user authenticated');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('👤 Inviter:', inviter.email, 'Tenant:', inviter.tenant_id);

        // 2. Verify the inviter is a tenant owner or admin
        if (!inviter.is_tenant_owner && inviter.role !== 'admin') {
            console.error('❌ User is not admin or tenant owner');
            return Response.json({ 
                error: 'Only tenant owners or admins can invite users' 
            }, { status: 403 });
        }

        if (!inviter.tenant_id) {
            console.error('❌ Inviter has no tenant_id');
            return Response.json({ 
                error: 'Your account is not properly initialized with a tenant' 
            }, { status: 400 });
        }

        // 3. Parse request body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error('❌ Failed to parse request body:', e);
            return Response.json({ 
                error: 'Invalid request body' 
            }, { status: 400 });
        }

        const { email, full_name, intended_role = 'user' } = body;

        if (!email || !full_name) {
            console.error('❌ Missing email or full_name');
            return Response.json({ 
                error: 'Email and full name are required' 
            }, { status: 400 });
        }

        console.log('📧 Invitation request for:', email);

        // 4. Check if user already exists in Base44
        console.log('🔍 Checking if user exists...');
        const allUsers = await base44.asServiceRole.entities.User.list();
        const existingUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (existingUser) {
            console.log('✅ User exists in Base44');
            
            // Check if they're already in this tenant
            if (existingUser.tenant_id === inviter.tenant_id) {
                console.error('⚠️ User already in this tenant');
                return Response.json({ 
                    error: 'This user is already a member of your organization' 
                }, { status: 400 });
            }

            // User exists but not in this tenant - add them
            console.log('➕ Adding existing user to tenant');
            await base44.asServiceRole.entities.User.update(existingUser.id, {
                tenant_id: inviter.tenant_id,
                company_name: inviter.company_name
            });
            console.log('✅ User added to tenant');

            // Send notification email using Base44 (works for existing users)
            try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    from_name: inviter.company_name || 'FieldCalls',
                    to: email,
                    subject: `You've been added to ${inviter.company_name}`,
                    body: `Hi ${full_name},\n\n${inviter.full_name} has added you to ${inviter.company_name} on FieldCalls.\n\nYou can now log in to access the team workspace.\n\nBest regards,\nThe FieldCalls Team`
                });
                console.log('✅ Notification email sent');
            } catch (emailError) {
                console.error('⚠️ Failed to send notification email:', emailError);
            }

            return Response.json({ 
                success: true,
                message: `${full_name} has been added to your organization`,
                user_existed: true
            });
        }

        // 5. User doesn't exist - create invitation
        console.log('📨 Creating pending invitation for new user');

        const invitationToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invitationData = {
            tenant_id: inviter.tenant_id,
            email: email.toLowerCase(),
            full_name: full_name,
            inviter_id: inviter.id,
            inviter_name: inviter.full_name,
            company_name: inviter.company_name,
            invitation_token: invitationToken,
            intended_role: intended_role,
            status: 'pending',
            expires_at: expiresAt.toISOString()
        };

        console.log('📝 Creating invitation record');
        let invitation;
        try {
            invitation = await base44.asServiceRole.entities.TenantInvite.create(invitationData);
            console.log('✅ Invitation created:', invitation.id);
        } catch (createError) {
            console.error('❌ Failed to create invitation:', createError);
            return Response.json({ 
                error: 'Failed to create invitation: ' + (createError.message || String(createError))
            }, { status: 500 });
        }

        // Build invitation link - go through Base44 login with AcceptInvitation as the next URL
        const origin = req.headers.get('origin') || req.headers.get('referer') || '';
        const appUrl = origin.split('/#')[0].replace(/\/$/, '');
        const acceptUrl = `${appUrl}/#/AcceptInvitation?token=${invitationToken}`;
        
        // IMPORTANT: Base44 apps require authentication, so we need to redirect through login
        // The login page will redirect back to AcceptInvitation after successful authentication
        const invitationLink = `${appUrl}/login?next=${encodeURIComponent('/#/AcceptInvitation?token=' + invitationToken)}`;

        console.log('🔗 Invitation link (via login):', invitationLink);
        console.log('📧 Sending email via Resend');

        // Send invitation email using Resend (for new users)
        try {
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (!resendApiKey) {
                throw new Error('RESEND_API_KEY not configured');
            }

            const emailResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'FieldCalls <invitations@fieldcalls.com>',
                    to: [email],
                    subject: `${inviter.full_name} invited you to ${inviter.company_name}`,
                    html: `
                        <h2>You've been invited to join ${inviter.company_name}!</h2>
                        <p>Hi ${full_name},</p>
                        <p>${inviter.full_name} has invited you to join their team on FieldCalls.</p>
                        <p><strong>Company:</strong> ${inviter.company_name}</p>
                        <p style="margin: 30px 0;">
                            <a href="${invitationLink}" 
                               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                Accept Invitation
                            </a>
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            If you don't have an account yet, you'll be able to create one after clicking the link above.
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            This invitation expires in 7 days.
                        </p>
                        <p>Best regards,<br/>The FieldCalls Team</p>
                    `,
                }),
            });

            if (!emailResponse.ok) {
                const errorData = await emailResponse.json();
                throw new Error(`Resend error: ${errorData.message || emailResponse.statusText}`);
            }

            console.log('✅ Invitation email sent via Resend');
        } catch (emailError) {
            console.error('❌ Failed to send email:', emailError);
            // Clean up invitation
            try {
                await base44.asServiceRole.entities.TenantInvite.delete(invitation.id);
                console.log('🗑️ Cleaned up invitation');
            } catch (deleteError) {
                console.error('⚠️ Failed to clean up:', deleteError);
            }
            return Response.json({ 
                error: 'Failed to send invitation email: ' + (emailError.message || String(emailError))
            }, { status: 500 });
        }

        console.log('🎉 Invitation completed');

        return Response.json({ 
            success: true,
            message: `Invitation sent to ${email}`,
            user_existed: false,
            invitation_link: invitationLink
        });

    } catch (error) {
        console.error('💥 ERROR:', error);
        return Response.json({ 
            error: error?.message || 'Failed to process invitation',
            details: String(error)
        }, { status: 500 });
    }
});