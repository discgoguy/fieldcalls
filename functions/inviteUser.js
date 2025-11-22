import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log('🚀 INVITE USER FUNCTION CALLED');
    
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Authenticate the requesting user
        const inviter = await base44.auth.me();
        if (!inviter) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('👤 Inviter:', inviter.email, 'Tenant:', inviter.tenant_id);

        // 2. Verify the inviter is a tenant owner or admin
        if (!inviter.is_tenant_owner && inviter.role !== 'admin') {
            return Response.json({ 
                error: 'Only tenant owners or admins can invite users' 
            }, { status: 403 });
        }

        // 3. Parse request body
        const { email, full_name } = await req.json();

        if (!email || !full_name) {
            return Response.json({ 
                error: 'Email and full name are required' 
            }, { status: 400 });
        }

        console.log('📧 Invitation request for:', email);

        // 4. Check if user already exists in this tenant
        const allUsers = await base44.asServiceRole.entities.User.list();
        const existingUser = allUsers.find(u => 
            u.email === email && u.tenant_id === inviter.tenant_id
        );

        if (existingUser) {
            return Response.json({ 
                error: 'A user with this email already exists in your organization' 
            }, { status: 400 });
        }

        console.log('✅ User does not exist in tenant, proceeding');

        // 5. Return success with instructions
        // Note: Actual user creation must be done through Base44 platform
        return Response.json({ 
            success: true,
            message: 'Invitation prepared',
            instructions: 'Please complete the invitation through the Base44 dashboard',
            invitee_email: email,
            invitee_name: full_name,
            company_name: inviter.company_name,
            tenant_id: inviter.tenant_id
        });

    } catch (error) {
        console.error('💥 ERROR:', error);
        return Response.json({ 
            error: error?.message || 'Failed to process invitation',
            details: String(error)
        }, { status: 500 });
    }
});