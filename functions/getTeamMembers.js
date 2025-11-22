import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    console.log('🚀 GET TEAM MEMBERS FUNCTION CALLED');
    
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Authenticate the requesting user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('👤 User:', user.email, 'Tenant:', user.tenant_id);

        // 2. Check if user has a tenant
        if (!user.tenant_id) {
            return Response.json({ 
                error: 'Your account is not properly initialized with a tenant' 
            }, { status: 400 });
        }

        // 3. Check if user is admin or tenant owner
        const isAdmin = user.role === 'admin' || user.is_tenant_owner === true;

        if (isAdmin) {
            // Get all users in the tenant using service role
            const allUsers = await base44.asServiceRole.entities.User.list();
            const tenantUsers = allUsers.filter(u => u.tenant_id === user.tenant_id);
            
            console.log(`✅ Found ${tenantUsers.length} users in tenant`);
            
            return Response.json({ 
                success: true,
                users: tenantUsers,
                current_user_id: user.id
            });
        } else {
            // Regular users only see themselves
            return Response.json({ 
                success: true,
                users: [user],
                current_user_id: user.id
            });
        }

    } catch (error) {
        console.error('💥 ERROR:', error);
        return Response.json({ 
            error: error?.message || 'Failed to load team members',
            details: String(error)
        }, { status: 500 });
    }
});